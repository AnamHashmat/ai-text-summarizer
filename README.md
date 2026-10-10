# AI Text Summarizer

A simple AI text summarizer. Paste text, pick **Short / Medium / Detailed**, and get a summary from the Groq API.

- **Frontend** (`index.html`, `style.css`, `script.js`) → hosted free on **GitHub Pages**
- **Backend** (`backend/worker.js`) → hosted free on **Cloudflare Workers**, where your API key is stored as a private secret
- **Local test server** (`dev_server.py`) → runs on your PC for testing, reads the key from your terminal

> Status: the code was tested against a **mock** API (fake responses). It has **not** been tested with the real Groq API, because that needs your own key. Follow step 3 to test it yourself.

---

## 1. Why is there a backend?

GitHub Pages only serves static files. Anything in `script.js` can be read by every visitor (right-click → "View Page Source"). If your key were there, anyone could copy it and use your account.

So the flow is:

```
Browser (GitHub Pages)  --text-->  Cloudflare Worker (has secret key)  --text + key-->  Groq API
Browser                 <--summary--  Cloudflare Worker                 <--summary--     Groq API
```

The browser never sees the key. Only the Worker does.

## 2. What each file does

| File | Purpose |
|---|---|
| `index.html` | Page structure: text box, dropdown, buttons, summary box |
| `style.css` | Design, colors, mobile layout, dark mode, loading spinner |
| `script.js` | Reads your input, checks it, sends it to the backend with `fetch()`, shows the summary or an error, Copy/Clear |
| `backend/worker.js` | Cloudflare Worker. Receives text, adds the secret key, calls Groq, returns only the summary |
| `dev_server.py` | Local test server (standard Python, no installs). Serves the site and does the same job as the Worker |
| `.gitignore` | Stops `.env` and other secret/junk files from being uploaded to GitHub |

**Settings you can change:**

- Model and API URL: `GROQ_MODEL` and `GROQ_API_URL` (environment variables in Cloudflare or your terminal). Defaults: `openai/gpt-oss-120b` and `https://api.groq.com/openai/v1/chat/completions`.
- Backend URL used by the live site: `PRODUCTION_API_URL` at the top of `script.js`.

> Model note: Groq retires models over time (for example `llama-3.3-70b-versatile` was retired in 2026). If you get a "Model not found" error, check Groq's models page and set `GROQ_MODEL` to a current one (for example `openai/gpt-oss-20b`). No code change needed.

---

## 3. Run and test on your PC (Windows PowerShell)

Requires Python (check with `py --version`). Create your Groq API key yourself in your Groq account first.

```powershell
# Go to the project folder (change the path to where you saved it)
cd "$HOME\Desktop\ai-text-summarizer"

# Open it in VS Code
code .

# Put your key in this terminal session only (not saved in any file).
# Paste the key when asked and press Enter.
$env:GROQ_API_KEY = Read-Host "Paste your Groq API key"

# Optional: choose another model
# $env:GROQ_MODEL = "openai/gpt-oss-20b"

# Start the local server
py dev_server.py
```

Open **http://localhost:8000** in your browser. Press `Ctrl+C` in the terminal to stop.

The key disappears when you close the terminal, so you need to set it again next time.

**Manual test checklist**

1. Click "Summarize Text" with an empty box → you see "Please paste some text to summarize."
2. Paste a paragraph or article, choose "Short", click "Summarize Text" → spinner shows, then a 2-3 sentence summary.
3. Try "Medium" and "Detailed" → longer summaries; Detailed has bullet points.
4. Click "Copy" → button says "Copied!"; paste somewhere to check.
5. Click "Clear" → text and summary are cleared.
6. Error test: stop the server, set a wrong key (`$env:GROQ_API_KEY = "wrong"`), start again, summarize → you see "API key is invalid". The terminal shows the full error from Groq.

---

## 4. Upload to GitHub and turn on GitHub Pages

Install Git if needed (`git --version` to check). Create a new **empty** public repository on github.com named `ai-text-summarizer` (don't add a README there).

```powershell
cd "$HOME\Desktop\ai-text-summarizer"

git init
git add .
git status            # check: NO .env file and NO API key in the list
git commit -m "AI Text Summarizer"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/ai-text-summarizer.git
git push -u origin main
```

Then on GitHub, in your repository:

1. Click "Settings" → "Pages"
2. Under "Build and deployment" → "Source", choose "Deploy from a branch"
3. Branch: "main", folder: "/ (root)" → "Save"
4. Wait 1-2 minutes. Your site will be at `https://YOUR-USERNAME.github.io/ai-text-summarizer/`

The site loads now, but summarizing won't work until step 5 is done.

(`dev_server.py` and `backend/worker.js` are also public on GitHub. That's fine: they contain no secrets.)

---

## 5. Deploy the backend on Cloudflare Workers (you do this in your own account)

1. Sign up / log in at cloudflare.com (free plan is enough).
2. Go to "Workers & Pages" → "Create" → "Create Worker" (or "Start with Hello World!").
3. Name it, e.g. `ai-summarizer` → "Deploy".
4. Click "Edit code", delete the sample code, paste **all** of `backend/worker.js` → "Deploy".
5. Go to the Worker's "Settings" → "Variables and Secrets" → "Add":
   - Type **"Secret"**, name `GROQ_API_KEY`, value = your Groq key
   - Type "Text", name `ALLOWED_ORIGIN`, value = `https://YOUR-USERNAME.github.io` (no slash or folder at the end)
   - Optional, type "Text": `GROQ_MODEL` = a different model
   - Click "Deploy" / "Save".
6. Copy your Worker URL, e.g. `https://ai-summarizer.your-name.workers.dev`

Now connect the frontend to it. In `script.js` set:

```js
PRODUCTION_API_URL: "https://ai-summarizer.your-name.workers.dev/api/summarize",
```

Push the change:

```powershell
git add script.js
git commit -m "Set backend URL"
git push
```

Wait 1-2 minutes, then open your GitHub Pages site and run the same checklist as step 3.

**If something fails on the live site:**

- "This website is not allowed..." → `ALLOWED_ORIGIN` doesn't exactly match your site's origin.
- "API key is invalid" → re-enter the `GROQ_API_KEY` secret in Cloudflare.
- "Model not found" → set `GROQ_MODEL` to a current Groq model.
- "Could not reach the summarizer server" → wrong `PRODUCTION_API_URL`, or the Worker isn't deployed.
- Full error details: Cloudflare → your Worker → "Logs".

---

## 6. Security rules

- Never put your key in `index.html`, `style.css`, `script.js`, or any file in the repo.
- Never commit a `.env` file (`.gitignore` blocks it).
- Never share your key in chats or screenshots. If it leaks, delete it in Groq and make a new one.
- `ALLOWED_ORIGIN` stops other websites' browsers from using your Worker. It doesn't fully block scripts calling it directly, so keep an eye on your Groq usage and set spending limits in your Groq account.
