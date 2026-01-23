/**
 * Initiate Intercom OAuth login flow
 * Redirects user to Intercom authorization page
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const INTERCOM_CLIENT_ID = process.env.INTERCOM_CLIENT_ID;
  const INTERCOM_CLIENT_SECRET = process.env.INTERCOM_CLIENT_SECRET;
  const REDIRECT_URI = process.env.INTERCOM_REDIRECT_URI || 
    `${req.headers.origin || process.env.VERCEL_URL || 'http://localhost:3000'}/api/auth/intercom/callback`;

  if (!INTERCOM_CLIENT_ID) {
    return res.status(500).json({ error: "INTERCOM_CLIENT_ID not configured" });
  }

  // Generate state parameter for CSRF protection
  const state = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);
  
  // Get redirect URL from query parameter
  const redirectUrl = req.query.redirect || '/';
  
  // Check if this is a popup request (redirect URL contains popup=true)
  const isPopup = redirectUrl.includes('popup=true');
  
  // Store state, redirect URL, and popup flag in secure cookies
  // Use SameSite=None; Secure for cross-site cookie sharing (needed for iframe in Sigma)
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = isProduction 
    ? 'HttpOnly; SameSite=None; Secure; Path=/'
    : 'HttpOnly; SameSite=Lax; Path=/';
  
  res.setHeader('Set-Cookie', [
    `oauth_state=${state}; ${cookieOptions}; Max-Age=600`,
    `oauth_redirect=${encodeURIComponent(redirectUrl)}; ${cookieOptions}; Max-Age=600`,
    `oauth_popup=${isPopup ? 'true' : 'false'}; ${cookieOptions}; Max-Age=600`
  ]);

  // Intercom OAuth authorization URL
  const authUrl = new URL('https://app.intercom.com/oauth');
  authUrl.searchParams.append('client_id', INTERCOM_CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('state', state);
  // Request scopes needed for the app
  authUrl.searchParams.append('scope', 'conversations.read conversations.list teams.read admins.read');

  // Redirect to Intercom authorization page
  res.redirect(302, authUrl.toString());
}
