import fetch from "node-fetch";

const INTERCOM_TOKEN = process.env.INTERCOM_TOKEN;
const INTERCOM_BASE_URL = "https://api.intercom.io";
const MAX_BATCH_SIZE = 20;

if (!INTERCOM_TOKEN) {
  throw new Error("INTERCOM_TOKEN env var is required");
}

function isConversationUnassigned(conversation) {
  const adminAssigneeId = conversation?.admin_assignee_id;
  const adminAssignee = conversation?.admin_assignee;
  const hasAssigneeId = adminAssigneeId !== null && adminAssigneeId !== undefined && adminAssigneeId !== "";
  const hasAssigneeObject = adminAssignee && (typeof adminAssignee === "object" ? (adminAssignee.id || adminAssignee.name) : true);
  return !hasAssigneeId && !hasAssigneeObject;
}

async function fetchAssignmentStatus(authHeader, conversationIds) {
  const uniqueIds = [...new Set(conversationIds)].filter(Boolean);
  const results = [];

  for (let i = 0; i < uniqueIds.length; i += MAX_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + MAX_BATCH_SIZE);

    const batchResults = await Promise.all(batch.map(async (conversationId) => {
      try {
        const resp = await fetch(
          `${INTERCOM_BASE_URL}/conversations/${conversationId}`,
          {
            method: "GET",
            headers: {
              "Authorization": authHeader,
              "Accept": "application/json",
              "Intercom-Version": "2.10"
            }
          }
        );

        if (!resp.ok) {
          const text = await resp.text();
          console.warn(`[Assignment Status API] Intercom error ${resp.status}: ${text}`);
          return null;
        }

        const conversation = await resp.json();
        return {
          id: conversation?.id || conversationId,
          conversation_id: conversation?.id || conversationId,
          admin_assignee_id: conversation?.admin_assignee_id ?? null,
          admin_assignee: conversation?.admin_assignee ?? null,
          isUnassigned: isConversationUnassigned(conversation)
        };
      } catch (err) {
        console.warn(`[Assignment Status API] Failed for ${conversationId}:`, err.message);
        return null;
      }
    }));

    results.push(...batchResults.filter(Boolean));
  }

  return results;
}

export default async function handler(req, res) {
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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const conversationIds = body?.conversationIds;

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      res.setHeader("Access-Control-Allow-Origin", originToUse);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      return res.status(400).json({ error: "conversationIds array is required" });
    }

    const userAccessToken = req.cookies?.intercom_access_token;
    let authHeader;

    if (userAccessToken) {
      authHeader = `Bearer ${userAccessToken}`;
    } else if (INTERCOM_TOKEN) {
      authHeader = INTERCOM_TOKEN.startsWith("Bearer ")
        ? INTERCOM_TOKEN
        : `Bearer ${INTERCOM_TOKEN}`;
    } else {
      res.setHeader("Access-Control-Allow-Origin", originToUse);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      return res.status(401).json({ error: "Authentication required" });
    }

    const results = await fetchAssignmentStatus(authHeader, conversationIds);

    res.setHeader("Access-Control-Allow-Origin", originToUse);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    res.json({ results });
  } catch (err) {
    console.error("[Assignment Status API] Error:", err);
    res.setHeader("Access-Control-Allow-Origin", originToUse);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.status(500).json({ error: "Internal server error" });
  }
}
