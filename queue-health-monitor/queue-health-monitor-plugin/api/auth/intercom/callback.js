import fetch from "node-fetch";
import pkg from 'pg';
const { Pool } = pkg;

// Disable TLS certificate verification for Supabase (required for self-signed certs)
// This is safe for Supabase as they use their own certificate infrastructure
if (process.env.POSTGRES_URL?.includes('supabase.co') || 
    process.env.POSTGRES_URL_NON_POOLING?.includes('supabase.co')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Database connection pool for audit logging
let auditPool = null;

function getAuditPool() {
  if (!auditPool) {
    let connectionString = process.env.POSTGRES_URL || 
                          process.env.POSTGRES_URL_NON_POOLING || 
                          process.env.POSTGRES_PRISMA_URL;
    
    if (!connectionString) {
      console.warn('No Postgres connection string found for audit logging');
      return null;
    }
    
    const isSupabase = connectionString.includes('supabase.co');
    
    if (isSupabase) {
      if (connectionString.includes('sslmode=')) {
        connectionString = connectionString.replace(/sslmode=[^&]*/, 'sslmode=require');
      } else {
        connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=require';
      }
    }
    
    const sslConfig = isSupabase ? { rejectUnauthorized: false } : undefined;
    
    auditPool = new Pool({
      connectionString,
      ssl: sslConfig,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  }
  return auditPool;
}

async function logAuditEvent(action, userInfo, req) {
  try {
    const pool = getAuditPool();
    if (!pool) return; // Silently fail if DB not available
    
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.headers['x-real-ip'] || 
                     req.connection?.remoteAddress || 
                     'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, user_email, action, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        userInfo?.id?.toString() || null,
        userInfo?.name || null,
        userInfo?.email || null,
        action,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    // Log error but don't fail the request
    console.error('Audit logging error:', error);
  }
}

/**
 * Handle Intercom OAuth callback
 * Exchange authorization code for access token
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, state, error } = req.query;

  // Check for OAuth errors
  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }

  // Verify state parameter (CSRF protection)
  const cookieState = req.cookies?.oauth_state;
  if (!state || state !== cookieState) {
    return res.redirect(`/?error=${encodeURIComponent('Invalid state parameter')}`);
  }

  if (!code) {
    return res.redirect(`/?error=${encodeURIComponent('No authorization code received')}`);
  }

  const INTERCOM_CLIENT_ID = process.env.INTERCOM_CLIENT_ID;
  const INTERCOM_CLIENT_SECRET = process.env.INTERCOM_CLIENT_SECRET;
  const REDIRECT_URI = process.env.INTERCOM_REDIRECT_URI || 
    `${req.headers.origin || process.env.VERCEL_URL || 'http://localhost:3000'}/api/auth/intercom/callback`;

  if (!INTERCOM_CLIENT_ID || !INTERCOM_CLIENT_SECRET) {
    return res.redirect(`/?error=${encodeURIComponent('OAuth not configured')}`);
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.intercom.io/auth/eagle/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: INTERCOM_CLIENT_ID,
        client_secret: INTERCOM_CLIENT_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange error:', errorText);
      return res.redirect(`/?error=${encodeURIComponent('Failed to exchange authorization code')}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in } = tokenData;

    if (!access_token) {
      return res.redirect(`/?error=${encodeURIComponent('No access token received')}`);
    }

    // Fetch user info to verify token and get user details
    const userResponse = await fetch('https://api.intercom.io/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
        'Intercom-Version': '2.10',
      },
    });

    let userInfo = null;
    if (userResponse.ok) {
      userInfo = await userResponse.json();
    }

    // Log sign-in event
    if (userInfo) {
      await logAuditEvent('sign_in', userInfo, req);
    }

    // Store access token in secure httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = expires_in || 60 * 60 * 24 * 30; // Default to 30 days if not specified

    // Get redirect URL from cookie (stored during login)
    let redirectUrl = req.cookies?.oauth_redirect || '/';
    try {
      redirectUrl = decodeURIComponent(redirectUrl);
    } catch (e) {
      // If decode fails, use default
      redirectUrl = '/';
    }
    
    // Set cookies (isProduction already declared above)
    // Use SameSite=None; Secure for cross-site cookie sharing (needed for iframe in Sigma)
    const cookieOptions = isProduction 
      ? 'HttpOnly; SameSite=None; Secure; Path=/'
      : 'HttpOnly; SameSite=Lax; Path=/';
    
    const cookiesToSet = [
      `intercom_access_token=${access_token}; ${cookieOptions}; Max-Age=${maxAge}`,
      `oauth_state=; ${cookieOptions}; Max-Age=0`, // Clear state cookie
      `oauth_redirect=; ${cookieOptions}; Max-Age=0`, // Clear redirect cookie
      `oauth_popup=; ${cookieOptions}; Max-Age=0`, // Clear popup flag
    ];
    res.setHeader('Set-Cookie', cookiesToSet);
    
    // Check if this is a popup request (via query param or cookie)
    const isPopup = req.query.popup === 'true' || req.cookies?.oauth_popup === 'true';
    
    if (isPopup) {
      // Return HTML that sends message to parent and closes popup
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Authentication Successful</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                // Wait a moment for cookies to be set, then send message
                setTimeout(() => {
                  // Send success message to parent window with origin
                  const origin = window.location.origin;
                  window.opener.postMessage({
                    type: 'OAUTH_SUCCESS',
                    user: ${userInfo ? JSON.stringify(userInfo) : 'null'},
                    origin: origin
                  }, origin);
                  // Close popup after a short delay
                  setTimeout(() => window.close(), 500);
                }, 200);
              } else {
                // Not in popup, redirect normally
                window.location.href = '${redirectUrl}?authenticated=true';
              }
            </script>
            <p>Authentication successful. This window will close automatically.</p>
          </body>
        </html>
      `);
    } else {
      // Regular redirect flow
      const separator = redirectUrl.includes('?') ? '&' : '?';
      res.redirect(302, `${redirectUrl}${separator}authenticated=true`);
    }
  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
  }
}
