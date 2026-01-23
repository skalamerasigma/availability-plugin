import pkg from 'pg';
const { Pool } = pkg;

// Disable TLS certificate verification for Supabase (required for self-signed certs)
// This is safe for Supabase as they use their own certificate infrastructure
if (process.env.POSTGRES_URL?.includes('supabase.co') || 
    process.env.POSTGRES_URL_NON_POOLING?.includes('supabase.co')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Database connection pool
let pool = null;

function getPool() {
  if (!pool) {
    let connectionString = process.env.POSTGRES_URL || 
                          process.env.POSTGRES_URL_NON_POOLING || 
                          process.env.POSTGRES_PRISMA_URL;
    
    if (!connectionString) {
      throw new Error('No Postgres connection string found');
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
    
    pool = new Pool({
      connectionString,
      ssl: sslConfig,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  }
  return pool;
}

/**
 * Get audit logs
 * Only accessible to authenticated users
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Handle CORS
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

  // Verify authentication
  const accessToken = req.cookies?.intercom_access_token;
  if (!accessToken) {
    res.setHeader("Access-Control-Allow-Origin", originToUse);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Verify token and get user info
    const fetch = (await import('node-fetch')).default;
    const userResponse = await fetch('https://api.intercom.io/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Intercom-Version': '2.10',
      },
    });

    if (!userResponse.ok) {
      res.setHeader("Access-Control-Allow-Origin", originToUse);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userInfo = await userResponse.json();

    // Get query parameters
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const action = req.query.action; // Optional filter: 'sign_in' or 'sign_out'
    const userId = req.query.user_id; // Optional filter by user ID

    // Build query
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (action) {
      query += ` AND action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const db = getPool();
    const result = await db.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (action) {
      countQuery += ` AND action = $${countParamIndex}`;
      countParams.push(action);
      countParamIndex++;
    }

    if (userId) {
      countQuery += ` AND user_id = $${countParamIndex}`;
      countParams.push(userId);
      countParamIndex++;
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.setHeader("Access-Control-Allow-Origin", originToUse);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.json({
      logs: result.rows,
      total: totalCount,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.setHeader("Access-Control-Allow-Origin", originToUse);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.status(500).json({ error: 'Failed to fetch audit logs', details: error.message });
  }
}
