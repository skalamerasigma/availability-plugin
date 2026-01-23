import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const INTERCOM_TOKEN = process.env.INTERCOM_TOKEN;
const INTERCOM_BASE_URL = "https://api.intercom.io";
const MAX_PAGES = 100; // safety guard

if (!INTERCOM_TOKEN) {
  throw new Error("INTERCOM_TOKEN env var is required");
}

// Restrictive CORS (adjust ALLOWED_ORIGIN for your Sigma org / dev host)
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
app.use(
  cors({
    origin: allowedOrigin,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  })
);

/**
 * Fetch all open conversations assigned to team 5480079
 * using Intercom's /conversations/search endpoint and pagination.
 */
async function fetchAllOpenTeamConversations() {
  let all = [];
  let startingAfter = null;
  let pageCount = 0;

  while (true) {
    const body = {
      query: {
        operator: "AND",
        value: [
          {
            field: "state",
            operator: "=",
            value: "open"
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

    // Intercom API supports Bearer token authentication
    // If your token starts with a specific prefix, it may need different handling
    const authHeader = INTERCOM_TOKEN.startsWith('Bearer ')
      ? INTERCOM_TOKEN
      : `Bearer ${INTERCOM_TOKEN}`;

    const resp = await fetch(
      `${INTERCOM_BASE_URL}/conversations/search`,
      {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Intercom-Version": "2.10" // Specify API version
        },
        body: JSON.stringify(body)
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Intercom error ${resp.status}: ${text}`);
    }

    const data = await resp.json();

    // Intercom search responses typically use `data` for items.
    const items = data.data || data.conversations || [];
    all = all.concat(items);

    pageCount += 1;
    console.log(`Page ${pageCount}: fetched ${items.length} conversations (total: ${all.length})`);
    
    if (pageCount >= MAX_PAGES) {
      console.warn("Reached MAX_PAGES; stopping pagination");
      break;
    }

    const pages = data.pages || {};
    const next = pages.next;

    // If there's no `next`, we've reached the last page.
    if (!next) {
      break;
    }

    // In the search API, pages.next is usually a cursor string
    // that should be used as `pagination.starting_after` in the next request.
    if (typeof next === "string") {
      startingAfter = next;
    } else if (next && typeof next.starting_after === "string") {
      startingAfter = next.starting_after;
    } else {
      // Unrecognized structure; stop to avoid infinite loop.
      break;
    }
  }

  return all;
}

// Fixed route, no request body – state and team are hard-coded
app.get(
  "/intercom/conversations/open-team-5480079",
  async (req, res) => {
    try {
      const conversations = await fetchAllOpenTeamConversations();
      res.json(conversations);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Intercom backend listening on port ${port}`);
});

