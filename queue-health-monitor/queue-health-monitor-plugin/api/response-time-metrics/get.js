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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    try {
      const db = getPool();
      
      // Initialize table if it doesn't exist
      await db.query(`
        CREATE TABLE IF NOT EXISTS response_time_metrics (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          date VARCHAR(10) NOT NULL,
          count_5_plus_min INTEGER NOT NULL DEFAULT 0,
          count_5_to_10_min INTEGER NOT NULL DEFAULT 0,
          count_10_plus_min INTEGER NOT NULL,
          total_conversations INTEGER NOT NULL,
          percentage_5_plus_min DECIMAL(5,2) NOT NULL DEFAULT 0,
          percentage_5_to_10_min DECIMAL(5,2) NOT NULL DEFAULT 0,
          percentage_10_plus_min DECIMAL(5,2) NOT NULL,
          conversation_ids_5_plus_min JSONB,
          conversation_ids_10_plus_min JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(date)
        );
      `);

      const { startDate, endDate, all } = req.query;
      
      let result;
      
      // If all=true, return all records regardless of date filters
      if (all === 'true') {
        result = await db.query(`
          SELECT timestamp, date, count_5_plus_min, count_5_to_10_min, count_10_plus_min, total_conversations, percentage_5_plus_min, percentage_5_to_10_min, percentage_10_plus_min, conversation_ids_5_plus_min, conversation_ids_10_plus_min
          FROM response_time_metrics
          ORDER BY date DESC, timestamp DESC
        `);
      } else if (startDate && endDate) {
        result = await db.query(`
          SELECT timestamp, date, count_5_plus_min, count_5_to_10_min, count_10_plus_min, total_conversations, percentage_5_plus_min, percentage_5_to_10_min, percentage_10_plus_min, conversation_ids_5_plus_min, conversation_ids_10_plus_min
          FROM response_time_metrics
          WHERE date >= $1 AND date <= $2
          ORDER BY timestamp ASC
        `, [startDate, endDate]);
      } else if (startDate) {
        result = await db.query(`
          SELECT timestamp, date, count_5_plus_min, count_5_to_10_min, count_10_plus_min, total_conversations, percentage_5_plus_min, percentage_5_to_10_min, percentage_10_plus_min, conversation_ids_5_plus_min, conversation_ids_10_plus_min
          FROM response_time_metrics
          WHERE date >= $1
          ORDER BY timestamp ASC
        `, [startDate]);
      } else if (endDate) {
        result = await db.query(`
          SELECT timestamp, date, count_5_plus_min, count_5_to_10_min, count_10_plus_min, total_conversations, percentage_5_plus_min, percentage_5_to_10_min, percentage_10_plus_min, conversation_ids_5_plus_min, conversation_ids_10_plus_min
          FROM response_time_metrics
          WHERE date <= $1
          ORDER BY timestamp ASC
        `, [endDate]);
      } else {
        // Default: last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const startDateStr = sevenDaysAgo.toISOString().slice(0, 10);
        
        result = await db.query(`
          SELECT timestamp, date, count_5_plus_min, count_5_to_10_min, count_10_plus_min, total_conversations, percentage_5_plus_min, percentage_5_to_10_min, percentage_10_plus_min, conversation_ids_5_plus_min, conversation_ids_10_plus_min
          FROM response_time_metrics
          WHERE date >= $1
          ORDER BY timestamp ASC
        `, [startDateStr]);
      }
      
      const metrics = result.rows.map(row => ({
        timestamp: row.timestamp,
        date: row.date,
        count5PlusMin: parseInt(row.count_5_plus_min) || 0,
        count5to10Min: parseInt(row.count_5_to_10_min) || 0,
        count10PlusMin: parseInt(row.count_10_plus_min) || 0,
        totalConversations: parseInt(row.total_conversations) || 0,
        percentage5PlusMin: parseFloat(row.percentage_5_plus_min) || 0,
        percentage5to10Min: parseFloat(row.percentage_5_to_10_min) || 0,
        percentage10PlusMin: parseFloat(row.percentage_10_plus_min) || 0,
        conversationIds5PlusMin: row.conversation_ids_5_plus_min || [],
        conversationIds10PlusMin: row.conversation_ids_10_plus_min || []
      }));

      return res.status(200).json({ metrics });
    } catch (error) {
      console.error("Error reading response time metrics:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

