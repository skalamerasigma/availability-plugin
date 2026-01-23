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
 * Logout endpoint - clears authentication cookies
 */
export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Handle CORS
  const allowedOriginEnv = process.env.ALLOWED_ORIGIN || "https://app.sigmacomputing.com";
  const requestOrigin = req.headers.origin;
  
  let originToUse = allowedOriginEnv;
  if (allowedOriginEnv === "*") {
    originToUse = "*";
  } else if (requestOrigin) {
    const isAllowedOrigin = requestOrigin === allowedOriginEnv;
    const isSameDomain = requestOrigin.includes("vercel.app") || requestOrigin.includes("localhost");
    if (isAllowedOrigin || isSameDomain) {
      originToUse = requestOrigin;
    }
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", originToUse);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    return res.status(200).end();
  }

  // Get user info before clearing cookies for audit logging
  let userInfo = null;
  const accessToken = req.cookies?.intercom_access_token;
  if (accessToken) {
    try {
      const fetch = (await import('node-fetch')).default;
      const userResponse = await fetch('https://api.intercom.io/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Intercom-Version': '2.10',
        },
      });
      if (userResponse.ok) {
        userInfo = await userResponse.json();
      }
    } catch (err) {
      console.error('Error fetching user info for audit log:', err);
    }
  }

  // Log sign-out event before clearing cookies
  if (userInfo) {
    await logAuditEvent('sign_out', userInfo, req);
  }

  // Clear authentication cookies
  // Use SameSite=None; Secure for cross-site cookie clearing (matches how cookies are set)
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = isProduction 
    ? 'HttpOnly; SameSite=None; Secure; Path=/'
    : 'HttpOnly; SameSite=Lax; Path=/';
  
  res.setHeader('Set-Cookie', [
    `intercom_access_token=; ${cookieOptions}; Max-Age=0`,
    `oauth_state=; ${cookieOptions}; Max-Age=0`,
    `oauth_redirect=; ${cookieOptions}; Max-Age=0`,
    `oauth_popup=; ${cookieOptions}; Max-Age=0`,
  ]);

  res.setHeader("Access-Control-Allow-Origin", originToUse);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  
  if (req.method === "GET") {
    // Redirect to home page
    res.redirect(302, '/?logged_out=true');
  } else {
    res.json({ success: true, message: "Logged out successfully" });
  }
}
