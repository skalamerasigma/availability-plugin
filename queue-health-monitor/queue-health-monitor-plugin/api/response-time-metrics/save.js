import pkg from 'pg';
const { Pool } = pkg;

// Disable TLS certificate verification for Supabase (required for self-signed certs)
if (process.env.POSTGRES_URL?.includes('supabase.co') || 
    process.env.POSTGRES_URL_NON_POOLING?.includes('supabase.co')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Create a connection pool
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
    
    const sslConfig = isSupabase ? {
      rejectUnauthorized: false
    } : undefined;
    
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

export const dynamic = 'force-dynamic';

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
      if (!process.env.POSTGRES_URL && !process.env.POSTGRES_PRISMA_URL) {
        return res.status(500).json({ 
          error: "Database not configured" 
        });
      }

      const metric = req.body;
      
      if (!metric.timestamp || !metric.date || metric.count10PlusMin === undefined) {
        return res.status(400).json({ error: "Invalid metric data: timestamp, date, and count10PlusMin are required" });
      }

      const db = getPool();
      
      // Initialize table if it doesn't exist
      // Note: Using date (YYYY-MM-DD) instead of date_hour for one entry per day
      await db.query(`
        CREATE TABLE IF NOT EXISTS response_time_metrics (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          date VARCHAR(10) NOT NULL,
          count_10_plus_min INTEGER NOT NULL,
          total_conversations INTEGER NOT NULL,
          percentage_10_plus_min DECIMAL(5,2) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(date)
        );
      `);

      // Migrate from old schema (date_hour) to new schema (date) if needed
      try {
        const columnCheck = await db.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'response_time_metrics' 
          AND column_name = 'date_hour'
        `);
        
        if (columnCheck.rows.length > 0) {
          // Old schema exists, migrate data
          await db.query(`
            ALTER TABLE response_time_metrics 
            ADD COLUMN IF NOT EXISTS date VARCHAR(10);
          `);
          
          // Migrate existing data: extract date from date_hour (format: YYYY-MM-DD-HH -> YYYY-MM-DD)
          await db.query(`
            UPDATE response_time_metrics 
            SET date = SUBSTRING(date_hour, 1, 10)
            WHERE date IS NULL AND date_hour IS NOT NULL;
          `);
          
          // Drop old column and constraint
          await db.query(`
            ALTER TABLE response_time_metrics 
            DROP CONSTRAINT IF EXISTS response_time_metrics_date_hour_key;
          `);
          
          await db.query(`
            ALTER TABLE response_time_metrics 
            DROP COLUMN IF EXISTS date_hour;
          `);
          
          // Add new unique constraint on date
          await db.query(`
            ALTER TABLE response_time_metrics 
            ADD CONSTRAINT response_time_metrics_date_key UNIQUE (date);
          `);
        }
      } catch (migrationError) {
        console.warn('Migration warning (may be safe to ignore):', migrationError.message);
      }

      // Insert or update metric (one entry per day, overwrites if exists)
      await db.query(`
        INSERT INTO response_time_metrics (timestamp, date, count_10_plus_min, total_conversations, percentage_10_plus_min)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (date) 
        DO UPDATE SET 
          timestamp = EXCLUDED.timestamp,
          count_10_plus_min = EXCLUDED.count_10_plus_min,
          total_conversations = EXCLUDED.total_conversations,
          percentage_10_plus_min = EXCLUDED.percentage_10_plus_min,
          created_at = NOW();
      `, [
        metric.timestamp,
        metric.date,
        metric.count10PlusMin,
        metric.totalConversations,
        metric.percentage10PlusMin
      ]);

      return res.status(200).json({ success: true, message: "Response time metric saved" });
    } catch (error) {
      console.error("Error saving response time metric:", error);
      return res.status(500).json({ 
        error: error.message,
        detail: error.detail || error.code || 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

