// Serverless API that turns a meeting's discussion notes into a punch list
// (concrete action items) via the Claude API -- a plain fetch() call, no
// SDK/npm dependency, same zero-dependency convention as every other
// function in this project.
//
// Requires ANTHROPIC_API_KEY env var (Anthropic Console -> API Keys).

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Claude API not configured (missing ANTHROPIC_API_KEY)" });
    return;
  }

  const { meetingText } = req.body || {};
  if (!meetingText || !meetingText.trim()) {
    res.status(400).json({ error: "Request body must include a non-empty { meetingText }" });
    return;
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: "You're helping a fractional CFO wrap up a financial review / business coaching meeting with a client. " +
            "Below are this meeting's Status, Key Insights, and Discussion Items, each with its discussion notes. " +
            "Turn this into a clean punch list: concrete next steps only, one per line, each starting with a verb " +
            "and naming an owner if one was given. Skip anything purely informational with no follow-up action. " +
            "No preamble, no headers, just the list.\n\n" + meetingText
        }]
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Claude API error: HTTP ${resp.status} ${errText.slice(0, 300)}`);
    }
    const data = await resp.json();
    const text = (data.content || []).map(b => b.text || "").join("\n").trim();
    res.status(200).json({ punchList: text });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
