import fetch from "node-fetch";

const INTERCOM_TOKEN = process.env.INTERCOM_TOKEN;
const INTERCOM_BASE_URL = "https://api.intercom.io";
const MAX_PAGES = 100; // safety guard

if (!INTERCOM_TOKEN) {
  throw new Error("INTERCOM_TOKEN env var is required");
}

/**
 * Fetch only unassigned conversations for team 5480079
 * Lightweight endpoint - only returns minimal data needed for Reso Queue
 */
async function fetchUnassignedConversations(authHeader) {
  const startTime = Date.now();
  let all = [];
  let startingAfter = null;
  let pageCount = 0;
  
  console.log(`[Unassigned API] Starting fetch at ${new Date().toISOString()}`);
  
  while (pageCount < MAX_PAGES) {
    const pageStartTime = Date.now();
    
    // Search for conversations that are:
    // 1. Open or snoozed (not closed)
    // 2. Assigned to team 5480079
    // Note: Intercom API doesn't support filtering by null admin_assignee_id directly,
    // so we'll fetch all open/snoozed conversations and filter server-side
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

    const resp = await fetch(
      `${INTERCOM_BASE_URL}/conversations/search`,
      {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Intercom-Version": "2.10"
        },
        body: JSON.stringify(body)
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Intercom error ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    const searchTime = Date.now() - pageStartTime;
    console.log(`[Unassigned API] Page ${pageCount + 1} search completed in ${searchTime}ms`);

    // Intercom search responses typically use `data` for items
    const items = data.data || data.conversations || [];
    console.log(`[Unassigned API] Page ${pageCount + 1}: Found ${items.length} conversations, filtering for unassigned...`);

    // Filter for unassigned conversations and extract only minimal data
    const unassignedItems = items.filter(item => {
      // Check if conversation is unassigned
      const hasAssigneeId = item.admin_assignee_id && 
                          item.admin_assignee_id !== null && 
                          item.admin_assignee_id !== undefined &&
                          item.admin_assignee_id !== "";
      const hasAssigneeObject = item.admin_assignee && 
                              (typeof item.admin_assignee === "object" ? (item.admin_assignee.id || item.admin_assignee.name) : true);
      return !hasAssigneeId && !hasAssigneeObject;
    });

    // Extract only the minimal data we need
    const minimalData = unassignedItems.map(item => ({
      id: item.id,
      conversation_id: item.id,
      created_at: item.created_at,
      createdAt: item.created_at,
      first_opened_at: item.first_opened_at,
      admin_assignee_id: null,
      admin_assignee: null,
      state: item.state || "open"
    }));

    all = all.concat(minimalData);
    console.log(`[Unassigned API] Page ${pageCount + 1}: Filtered to ${unassignedItems.length} unassigned conversations (total: ${all.length})`);
    pageCount += 1;

    const pageTotalTime = Date.now() - pageStartTime;
    console.log(`[Unassigned API] Page ${pageCount}: fetched ${items.length} conversations (total: ${all.length}) in ${pageTotalTime}ms`);

    if (pageCount >= MAX_PAGES) {
      console.warn("[Unassigned API] Reached MAX_PAGES; stopping pagination");
      break;
    }

    const pages = data.pages || {};
    const next = pages.next;

    // If there's no `next`, we've reached the last page
    if (!next) {
      break;
    }

    // In the search API, pages.next is usually a cursor string
    if (typeof next === "string") {
      startingAfter = next;
    } else if (next && typeof next.starting_after === "string") {
      startingAfter = next.starting_after;
    } else {
      // Unrecognized structure; stop to avoid infinite loop
      break;
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`[Unassigned API] Completed: ${all.length} unassigned conversations in ${totalTime}ms (${Math.round(totalTime/1000)}s)`);
  
  return all;
}

export default async function handler(req, res) {
  // Handle CORS - allow Sigma Computing domain and plugin's own domain
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

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get user's access token from cookie (preferred) or fall back to server token
    const userAccessToken = req.cookies?.intercom_access_token;
    let authHeader;
    
    if (userAccessToken) {
      authHeader = `Bearer ${userAccessToken}`;
    } else if (INTERCOM_TOKEN) {
      authHeader = INTERCOM_TOKEN.startsWith('Bearer ')
        ? INTERCOM_TOKEN
        : `Bearer ${INTERCOM_TOKEN}`;
    } else {
      res.setHeader("Access-Control-Allow-Origin", originToUse);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const conversations = await fetchUnassignedConversations(authHeader);
    
    res.setHeader("Access-Control-Allow-Origin", originToUse);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    
    console.log(`[Unassigned API] Returning ${conversations.length} unassigned conversations`);
    
    res.json({
      conversations
    });
  } catch (err) {
    console.error('[Unassigned API] Error:', err);
    if (err.message && err.message.includes('401')) {
      res.setHeader("Access-Control-Allow-Origin", originToUse);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      return res.status(401).json({ error: "Invalid or expired token", requiresAuth: true });
    }
    res.setHeader("Access-Control-Allow-Origin", originToUse);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.status(500).json({ error: err.message });
  }
}
