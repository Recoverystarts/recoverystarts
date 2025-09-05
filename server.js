import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

// --- Config ---
const PORT = process.env.PORT || 5173;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.MODEL || "gpt-4o-mini";
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in .env");
  process.exit(1);
}

const app = express();

// --- Security & parsing ---
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: true,
    methods: ["POST", "GET", "OPTIONS"],
  })
);
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- Serve your landing page (put index.html in ./public) ---
app.use(express.static("public"));

// --- Chat endpoint ---
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [], systemPrompt } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    const messages = [];
    messages.push({
      role: "system",
      content:
        systemPrompt ||
        "You are a concise recovery directory assistant. Be direct. No medical advice.",
    });

    if (Array.isArray(history)) {
      for (const m of history) {
        if (
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
        ) {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }
    messages.push({ role: "user", content: message });

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: "openai_error", detail: errText });
    }

    const data = await r.json();
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "No response generated.";

    res.json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`RecoveryStarts backend running on http://localhost:${PORT}`);
});
