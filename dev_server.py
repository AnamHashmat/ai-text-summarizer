"""
Local test server (for your own computer only - NOT uploaded to GitHub Pages).

It does two jobs:
  1. Serves index.html, style.css and script.js at http://localhost:8000
  2. Handles /api/summarize by calling Groq with the key from your
     GROQ_API_KEY environment variable (never stored in a file).

Uses only Python's standard library - no pip install needed.
Run:  py dev_server.py
"""

import json
import os
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "8000"))
GROQ_API_URL = os.environ.get("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
MAX_INPUT_CHARS = 20000

LENGTH_INSTRUCTIONS = {
    "short": "Write a short summary in 2-3 sentences.",
    "medium": "Write a summary of one or two paragraphs (about 100-150 words) covering the main points.",
    "detailed": "Write a detailed summary: a one-sentence overview, then 5-8 bullet points with the key ideas, facts and conclusions.",
}

SYSTEM_PROMPT = (
    "You are a precise summarization assistant. Summarize only the text the user provides. "
    "Do not add facts that are not in the text. Reply with the summary only, in the same language as the text."
)

# Only these files are served, so .env or other files are never exposed
PUBLIC_FILES = {"/", "/index.html", "/style.css", "/script.js"}


class Handler(SimpleHTTPRequestHandler):
    def send_json(self, status, body):
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.split("?")[0] not in PUBLIC_FILES:
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/summarize":
            self.send_json(404, {"error": "Not found."})
            return

        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            self.send_json(500, {"error": "GROQ_API_KEY is not set in this terminal. See README step 3."})
            return

        try:
            length_header = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length_header) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Invalid request body."})
            return

        text = str(body.get("text", "")).strip()
        length = body.get("length") if body.get("length") in LENGTH_INSTRUCTIONS else "medium"
        if not text:
            self.send_json(400, {"error": "Please provide some text to summarize."})
            return
        if len(text) > MAX_INPUT_CHARS:
            self.send_json(400, {"error": f"Text is too long (max {MAX_INPUT_CHARS} characters)."})
            return

        payload = {
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f'{LENGTH_INSTRUCTIONS[length]}\n\nText to summarize:\n"""\n{text}\n"""'},
            ],
            "temperature": 0.3,
            "max_completion_tokens": 2048,
        }
        request = urllib.request.Request(
            GROQ_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "ai-text-summarizer/1.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")
            print(f"[Groq error {e.code}] {detail}")  # full detail shown only in your terminal
            messages = {
                401: "API key is invalid. Check GROQ_API_KEY.",
                404: "Model not found. Check GROQ_MODEL.",
                429: "Too many requests. Wait a moment and try again.",
            }
            self.send_json(502, {"error": messages.get(e.code, f"AI service error (status {e.code}).")})
            return
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"[Connection error] {e}")
            self.send_json(502, {"error": "Could not connect to the AI service."})
            return

        try:
            summary = data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError, AttributeError):
            summary = ""
        if not summary:
            self.send_json(502, {"error": "The AI returned an empty response. Please try again."})
            return

        self.send_json(200, {"summary": summary})


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"Model: {GROQ_MODEL}")
    print("API key loaded:", "yes" if os.environ.get("GROQ_API_KEY") else "NO - set GROQ_API_KEY first")
    print(f"Open http://localhost:{PORT} in your browser. Press Ctrl+C to stop.")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
