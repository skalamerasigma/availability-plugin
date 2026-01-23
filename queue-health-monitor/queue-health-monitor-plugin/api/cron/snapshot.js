import fetch from "node-fetch";
import pkg from 'pg';
const { Pool } = pkg;

const INTERCOM_BASE_URL = "https://api.intercom.io";

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

// Force dynamic execution (no caching)
export const dynamic = 'force-dynamic';

export default async function handler(req, res) {
  // Verify this is a cron job request (Vercel Cron)
  // Vercel automatically sends Authorization header for cron jobs
  // Allow if CRON_SECRET matches or if no secret is set (for testing)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  // If CRON_SECRET is set, verify the authorization header
  // Vercel sends: Authorization: Bearer <CRON_SECRET>
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  // If no CRON_SECRET is set, allow the request (for testing)

  try {
    const INTERCOM_TOKEN = process.env.INTERCOM_TOKEN;
    if (!INTERCOM_TOKEN) {
      throw new Error("INTERCOM_TOKEN not configured");
    }

    const authHeaderValue = INTERCOM_TOKEN.startsWith('Bearer ')
      ? INTERCOM_TOKEN
      : `Bearer ${INTERCOM_TOKEN}`;

    // Fetch current conversations and team members
    const [conversations, teamMembers] = await Promise.all([
      fetchAllOpenTeamConversations(authHeaderValue),
      fetchTeamMembers(authHeaderValue)
    ]);

    // Calculate TSE metrics (similar to Dashboard logic)
    const EXCLUDED_TSE_NAMES = [
      "Zen Junior", "Nathan Parrish", "Leticia Esparza",
      "Rob Woollen", "Brett Bedevian", "Viswa Jeyaraman", "Brandon Yee",
      "Holly Coxon", "Chetana Shinde", "Matt Morgenroth", "Grace Sanford",
      "Prerit Sachdeva", "svc-prd-tse-intercom SVC"
    ];

    const byTSE = {};
    teamMembers.forEach(admin => {
      const tseId = admin.id;
      if (tseId && !EXCLUDED_TSE_NAMES.includes(admin.name)) {
        byTSE[tseId] = {
          id: tseId,
          name: admin.name || admin.email?.split("@")[0] || `TSE ${tseId}`,
          open: 0,
          actionableSnoozed: 0,
          customerWaitSnoozed: 0,
          snoozedForOnTrack: 0 // All snoozed EXCEPT customer-waiting tags
        };
      }
    });

    conversations.forEach((conv) => {
      const hasAssigneeId = conv.admin_assignee_id && conv.admin_assignee_id !== null;
      const hasAssigneeObject = conv.admin_assignee && 
                                (typeof conv.admin_assignee === "object" ? (conv.admin_assignee.id || conv.admin_assignee.name) : true);
      const isUnassigned = !hasAssigneeId && !hasAssigneeObject;
      
      if (isUnassigned) return;

      const tseId = conv.admin_assignee_id || 
                    (conv.admin_assignee && typeof conv.admin_assignee === "object" ? conv.admin_assignee.id : null);
      
      if (!tseId || !byTSE[tseId]) return;

      const assigneeName = conv.admin_assignee?.name || 
                          (typeof conv.admin_assignee === "string" ? conv.admin_assignee : null);
      if (assigneeName && EXCLUDED_TSE_NAMES.includes(assigneeName)) return;

      const isSnoozed = conv.state === "snoozed" || conv.snoozed_until;
      // Ensure tags is always an array (handle both array and object formats)
      const tags = Array.isArray(conv.tags) 
        ? conv.tags 
        : (conv.tags && Array.isArray(conv.tags.tags)) 
          ? conv.tags.tags 
          : [];
      
      const hasWaitingOnTSETag = tags.some(t => 
        (t.name && t.name.toLowerCase() === "snooze.waiting-on-tse") || 
        (typeof t === "string" && t.toLowerCase() === "snooze.waiting-on-tse")
      );
      const hasWaitingOnCustomerTag = tags.some(t => 
        (t.name && (t.name.toLowerCase() === "snooze.waiting-on-customer-resolved" || t.name.toLowerCase() === "snooze.waiting-on-customer-unresolved")) || 
        (typeof t === "string" && (t.toLowerCase() === "snooze.waiting-on-customer-resolved" || t.toLowerCase() === "snooze.waiting-on-customer-unresolved"))
      );

      if (isSnoozed) {
        byTSE[tseId].totalSnoozed = (byTSE[tseId].totalSnoozed || 0) + 1;
        if (hasWaitingOnTSETag) {
          byTSE[tseId].actionableSnoozed++; // This field represents "Waiting On TSE" (for backward compatibility)
        } else if (hasWaitingOnCustomerTag) {
          byTSE[tseId].customerWaitSnoozed++; // This field represents "Waiting On Customer"
        }
        // Snoozed conversations without specific tags are only counted in totalSnoozed
        
        // For "snoozed on track" metric: count all snoozed EXCEPT customer-waiting tags
        // This includes: waiting-on-tse tagged, and snoozed without tags
        // Excludes: waiting-on-customer-resolved and waiting-on-customer-unresolved
        if (!hasWaitingOnCustomerTag) {
          byTSE[tseId].snoozedForOnTrack = (byTSE[tseId].snoozedForOnTrack || 0) + 1;
        }
      }

      if (conv.state === "open" && !isSnoozed) {
        byTSE[tseId].open++;
      }
    });

    // Create snapshot - use previous UTC day
    // When cron runs, capture current state and store with previous UTC day's date
    const now = new Date();
    
    // Get the previous UTC day (yesterday in UTC)
    const prevUTCDay = new Date(now);
    prevUTCDay.setUTCDate(prevUTCDay.getUTCDate() - 1);
    prevUTCDay.setUTCHours(0, 0, 0, 0);
    
    const year = prevUTCDay.getUTCFullYear();
    const month = String(prevUTCDay.getUTCMonth() + 1).padStart(2, '0');
    const day = String(prevUTCDay.getUTCDate()).padStart(2, '0');
    const snapshotDate = `${year}-${month}-${day}`;
    
    console.log(`[Snapshot] Capturing snapshot for UTC date: ${snapshotDate}`);

    const snapshot = {
      date: snapshotDate,
      timestamp: now.toISOString(),
      tseData: Object.values(byTSE).map(tse => ({
        id: tse.id,
        name: tse.name,
        open: tse.open,
        actionableSnoozed: tse.actionableSnoozed,
        customerWaitSnoozed: tse.customerWaitSnoozed,
        totalSnoozed: tse.totalSnoozed || 0,
        snoozedForOnTrack: tse.snoozedForOnTrack || 0 // All snoozed EXCEPT customer-waiting tags
      }))
    };

    // Save snapshot directly to database
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

    return res.status(200).json({ success: true, snapshot });
  } catch (error) {
    console.error("Cron job error:", error);
    return res.status(500).json({ error: error.message });
  }
}

// Helper functions (simplified versions from main API)
async function fetchTeamMembers(authHeader) {
  try {
    const teamResp = await fetch(`${INTERCOM_BASE_URL}/teams/5480079`, {
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
        "Intercom-Version": "2.10"
      }
    });
    
    if (teamResp.ok) {
      const teamData = await teamResp.json();
      const adminIds = teamData.admin_ids || [];
      const admins = [];
      
      for (const adminId of adminIds) {
        try {
          const adminResp = await fetch(`${INTERCOM_BASE_URL}/admins/${adminId}`, {
            headers: {
              "Authorization": authHeader,
              "Accept": "application/json",
              "Intercom-Version": "2.10"
            }
          });
          if (adminResp.ok) {
            admins.push(await adminResp.json());
          }
        } catch (err) {
          console.warn(`Failed to fetch admin ${adminId}:`, err.message);
        }
      }
      return admins;
    }
  } catch (err) {
    console.warn("Failed to fetch team members:", err.message);
  }
  return [];
}

async function fetchAllOpenTeamConversations(authHeader) {
  let all = [];
  let startingAfter = null;
  let pageCount = 0;
  const MAX_PAGES = 50;
  const BATCH_SIZE = 10;

  while (pageCount < MAX_PAGES) {
    const body = {
      query: {
        operator: "AND",
        value: [
          {
            field: "state",
            operator: "IN",
            value: ["open", "snoozed"]
          },
          {
            field: "team_assignee_id",
            operator: "=",
            value: "5480079"
          }
        ]
      },
      pagination: {
        per_page: 150,
        ...(startingAfter ? { starting_after: startingAfter } : {})
      }
    };

    const resp = await fetch(`${INTERCOM_BASE_URL}/conversations/search`, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Intercom-Version": "2.10"
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Intercom error ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    const items = data.data || data.conversations || [];
    
    // Fetch full conversation details in batches
    const enrichedItems = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (item) => {
        try {
          const convResp = await fetch(`${INTERCOM_BASE_URL}/conversations/${item.id}`, {
            headers: {
              "Authorization": authHeader,
              "Accept": "application/json",
              "Intercom-Version": "2.10"
            }
          });
          
          if (convResp.ok) {
            const fullConv = await convResp.json();
            let adminAssignee = fullConv.admin_assignee || item.admin_assignee;
            
            if (fullConv.admin_assignee_id && !adminAssignee) {
              try {
                const adminResp = await fetch(`${INTERCOM_BASE_URL}/admins/${fullConv.admin_assignee_id}`, {
                  headers: {
                    "Authorization": authHeader,
                    "Accept": "application/json",
                    "Intercom-Version": "2.10"
                  }
                });
                if (adminResp.ok) {
                  adminAssignee = await adminResp.json();
                }
              } catch (err) {
                console.warn(`Failed to fetch admin ${fullConv.admin_assignee_id}:`, err.message);
              }
            }
            
            // Extract tags ensuring it's always an array
            let tags = [];
            if (Array.isArray(fullConv.tags)) {
              tags = fullConv.tags;
            } else if (fullConv.tags && Array.isArray(fullConv.tags.tags)) {
              tags = fullConv.tags.tags;
            } else if (Array.isArray(item.tags)) {
              tags = item.tags;
            }
            
            return {
              ...item,
              tags: tags,
              admin_assignee_id: fullConv.admin_assignee_id,
              admin_assignee: adminAssignee,
              state: fullConv.state || item.state || "open",
              snoozed_until: fullConv.snoozed_until || item.snoozed_until
            };
          }
        } catch (err) {
          console.warn(`Failed to fetch details for conversation ${item.id}:`, err.message);
        }
        // Ensure tags is always an array in fallback case
        const fallbackTags = Array.isArray(item.tags) 
          ? item.tags 
          : (item.tags && Array.isArray(item.tags.tags)) 
            ? item.tags.tags 
            : [];
        return {
          ...item,
          tags: fallbackTags,
          state: item.state || "open"
        };
      });
      
      const batchResults = await Promise.all(batchPromises);
      enrichedItems.push(...batchResults);
      
      if (i + BATCH_SIZE < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    all = all.concat(enrichedItems);
    pageCount++;

    const pages = data.pages || {};
    const next = pages.next;
    if (!next) break;
    startingAfter = typeof next === "string" ? next : next.starting_after;
  }

  return all;
}

