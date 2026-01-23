import fetch from "node-fetch";

/**
 * Get current authenticated user information
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Handle CORS - allow requests from Sigma and same domain
  const allowedOriginEnv = process.env.ALLOWED_ORIGIN || "https://app.sigmacomputing.com";
  const requestOrigin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/');
  
  let originToUse = allowedOriginEnv;
  if (allowedOriginEnv === "*") {
    originToUse = "*";
  } else if (requestOrigin) {
    const isAllowedOrigin = requestOrigin === allowedOriginEnv;
    const isSameDomain = requestOrigin.includes("vercel.app") || requestOrigin.includes("localhost");
    const isSigmaDomain = requestOrigin.includes("sigmacomputing.com");
    if (isAllowedOrigin || isSameDomain || isSigmaDomain) {
      originToUse = requestOrigin;
    }
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", originToUse);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    return res.status(200).end();
  }

  // Get access token from cookie
  const accessToken = req.cookies?.intercom_access_token;

  if (!accessToken) {
    res.setHeader("Access-Control-Allow-Origin", originToUse);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    return res.status(401).json({ error: "Not authenticated", authenticated: false });
  }

  try {
    // Verify token and get user info
    const userResponse = await fetch('https://api.intercom.io/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Intercom-Version': '2.10',
      },
    });

    if (!userResponse.ok) {
      // Token might be expired or invalid
      if (userResponse.status === 401) {
        res.setHeader("Access-Control-Allow-Origin", originToUse);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        return res.status(401).json({ error: "Invalid or expired token", authenticated: false });
      }
      throw new Error(`Intercom API error: ${userResponse.status}`);
    }

    const userInfo = await userResponse.json();

    res.setHeader("Access-Control-Allow-Origin", originToUse);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.json({
      authenticated: true,
      user: userInfo,
    });
  } catch (err) {
    console.error('Error fetching user info:', err);
    res.setHeader("Access-Control-Allow-Origin", originToUse);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.status(500).json({ error: err.message, authenticated: false });
  }
}
