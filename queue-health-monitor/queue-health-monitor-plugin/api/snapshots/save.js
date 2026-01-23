import pkg from 'pg';
const { Pool } = pkg;

// Disable TLS certificate verification for Supabase (required for self-signed certs)
// This is safe for Supabase as they use their own certificate infrastructure
if (process.env.POSTGRES_URL?.includes('supabase.co') || 
    process.env.POSTGRES_URL_NON_POOLING?.includes('supabase.co')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Create a connection pool
let pool = null;

function getPool() {
  if (!pool) {
    // Try POSTGRES_URL first (pooler), then POSTGRES_URL_NON_POOLING, then POSTGRES_PRISMA_URL
    // Pooler URL often handles SSL better
    let connectionString = process.env.POSTGRES_URL || 
                          process.env.POSTGRES_URL_NON_POOLING || 
                          process.env.POSTGRES_PRISMA_URL;
    
    if (!connectionString) {
      throw new Error('No Postgres connection string found');
    }
    
    const isSupabase = connectionString.includes('supabase.co');
    
    // For Supabase, ensure SSL mode is set correctly in connection string
    if (isSupabase) {
      // Replace sslmode if present, or add it
      if (connectionString.includes('sslmode=')) {
        connectionString = connectionString.replace(/sslmode=[^&]*/, 'sslmode=require');
      } else {
        connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=require';
      }
    }
    
    // Configure SSL for Supabase
    const sslConfig = isSupabase ? {
      rejectUnauthorized: false
    } : undefined;
    
    pool = new Pool({
      connectionString,
      ssl: sslConfig,
      // Additional options for better compatibility
      max: 1, // Limit connections for serverless
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  }
  return pool;
}

export default async function handler(req, res) {
  // Set CORS headers
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
  
  res.setHeader("Access-Control-Allow-Origin", originToUse);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "POST") {
    try {
      // Check if Postgres environment variables are set
      if (!process.env.POSTGRES_URL && !process.env.POSTGRES_PRISMA_URL) {
        return res.status(500).json({ 
          error: "Database not configured. Please connect the Supabase database to your Vercel project in the Production environment." 
        });
      }

      const snapshot = req.body;
      
      // Validate snapshot data
      if (!snapshot.date || !snapshot.tseData) {
        return res.status(400).json({ error: "Invalid snapshot data" });
      }

      const db = getPool();
      
      // Initialize table if it doesn't exist
      await db.query(`
        CREATE TABLE IF NOT EXISTS tse_snapshots (
          id SERIAL PRIMARY KEY,
          date VARCHAR(10) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          tse_data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(date)
        );
      `);

      // Insert or update snapshot
      await db.query(`
        INSERT INTO tse_snapshots (date, timestamp, tse_data)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (date) 
        DO UPDATE SET 
          timestamp = EXCLUDED.timestamp,
          tse_data = EXCLUDED.tse_data,
          created_at = NOW();
      `, [snapshot.date, snapshot.timestamp, JSON.stringify(snapshot.tseData)]);

      return res.status(200).json({ success: true, message: "Snapshot saved" });
    } catch (error) {
      console.error("Error saving snapshot:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail
      });
      return res.status(500).json({ 
        error: error.message,
        detail: error.detail || error.code || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
