// =====================================================================
// Cloudflare Worker - the private backend
// Runs on Cloudflare's servers, NOT in the browser.
// The Groq API key is read from a secret variable (env.GROQ_API_KEY)
// that you add in Cloudflare. It is never in this file or on GitHub.
// =====================================================================

// Defaults (can be overridden with Cloudflare "Variables")
const DEFAULT_GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const MAX_INPUT_CHARS = 20000;

const LENGTH_INSTRUCTIONS = {
  short: "Write a short summary in 2-3 sentences.",
  medium: "Write a summary of one or two paragraphs (about 100-150 words) covering the main points.",
  detailed: "Write a detailed summary: a one-sentence overview, then 5-8 bullet points with the key ideas, facts and conclusions.",
};

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": allowedOrigin === "*" ? "*" : allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    const reply = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...cors },
      });

    // Browser "pre-flight" check before the real POST
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== "/api/summarize") return reply({ error: "Not found." }, 404);
    if (request.method !== "POST") return reply({ error: "Use POST." }, 405);

    // Only accept requests from your own website (if ALLOWED_ORIGIN is set)
    if (allowedOrigin !== "*" && origin !== allowedOrigin) {
      return reply({ error: "This website is not allowed to use this server." }, 403);
    }

    if (!env.GROQ_API_KEY) {
      return reply({ error: "Server is missing the GROQ_API_KEY secret." }, 500);
    }

    // Read and check the input
    let body;
    try {
      body = await request.json();
    } catch {
      return reply({ error: "Invalid request body." }, 400);
    }
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const length = LENGTH_INSTRUCTIONS[body.length] ? body.length : "medium";
    if (!text) return reply({ error: "Please provide some text to summarize." }, 400);
    if (text.length > MAX_INPUT_CHARS) {
      return reply({ error: `Text is too long (max ${MAX_INPUT_CHARS} characters).` }, 400);
    }

    // Call Groq (OpenAI-compatible Chat Completions format)
    let groqRes;
    try {
      groqRes = await fetch(env.GROQ_API_URL || DEFAULT_GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are a precise summarization assistant. Summarize only the text the user provides. " +
                "Do not add facts that are not in the text. Reply with the summary only, in the same language as the text.",
            },
            { role: "user", content: `${LENGTH_INSTRUCTIONS[length]}\n\nText to summarize:\n"""\n${text}\n"""` },
          ],
          temperature: 0.3,
          max_completion_tokens: 2048,
        }),
      });
    } catch {
      return reply({ error: "Could not connect to the AI service. Please try again." }, 502);
    }

    const data = await groqRes.json().catch(() => ({}));

    if (!groqRes.ok) {
      const messages = {
        401: "The server's API key is invalid. (Site owner: check GROQ_API_KEY.)",
        404: "The AI model was not found. (Site owner: check GROQ_MODEL.)",
        429: "Too many requests right now. Please wait a moment and try again.",
      };
      // Log full detail privately in Cloudflare logs; send a simple message to the browser
      console.log("Groq error", groqRes.status, JSON.stringify(data));
      return reply({ error: messages[groqRes.status] || `AI service error (status ${groqRes.status}).` }, 502);
    }

    const summary = data?.choices?.[0]?.message?.content?.trim();
    if (!summary) return reply({ error: "The AI returned an empty response. Please try again." }, 502);

    return reply({ summary });
  },
};
