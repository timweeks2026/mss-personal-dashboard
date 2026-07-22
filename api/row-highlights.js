// Serverless API backing row highlighting (P&L Statement, Balance Sheet,
// Cash Flow, Budget, Compare, History). Stores one JSON object
// { "<scope>::<rowKey>": true } in Upstash Redis — same single-mutable-
// document pattern as /api/typical-overrides.js.
//
// Requires KV_REST_API_URL / KV_REST_API_TOKEN env vars (Upstash for Redis,
// connected to this project via Vercel Storage).

const REDIS_KEY = "row-highlights-data";

async function redisGet(key) {
  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });
  if (!resp.ok) throw new Error(`Redis GET failed: HTTP ${resp.status}`);
  const data = await resp.json();
  return data.result; // string or null
}

async function redisSet(key, value) {
  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    body: value
  });
  if (!resp.ok) throw new Error(`Redis SET failed: HTTP ${resp.status}`);
}

module.exports = async function handler(req, res) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    res.status(500).json({ error: "Redis not configured (missing KV_REST_API_URL/KV_REST_API_TOKEN)" });
    return;
  }

  try {
    if (req.method === "GET") {
      const raw = await redisGet(REDIS_KEY);
      res.status(200).json(raw ? JSON.parse(raw) : {});
      return;
    }

    if (req.method === "POST") {
      const { data } = req.body || {};
      if (!data) {
        res.status(400).json({ error: "Request body must include { data }" });
        return;
      }
      await redisSet(REDIS_KEY, JSON.stringify(data));
      res.status(200).json(data);
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
