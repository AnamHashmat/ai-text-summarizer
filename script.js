// =====================================================================
// AI Text Summarizer - frontend logic
// This file runs in the visitor's browser. It NEVER contains the API key.
// It sends the text to YOUR backend, and the backend talks to Groq.
// =====================================================================

// ----- 1. SETTINGS (edit these) -----
const CONFIG = {
  // Your deployed Cloudflare Worker URL (see README, step 5).
  // Example: "https://ai-summarizer.your-name.workers.dev/api/summarize"
  PRODUCTION_API_URL: "https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/api/summarize",

  // Used automatically when you run the local Python server (dev_server.py).
  LOCAL_API_URL: "/api/summarize",

  MAX_CHARS: 20000, // must match MAX_INPUT_CHARS in the backend
  MIN_CHARS: 50,
};

// Use the local backend when the page is opened from your own computer.
const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_URL = isLocal ? CONFIG.LOCAL_API_URL : CONFIG.PRODUCTION_API_URL;

// ----- 2. GET THE PAGE ELEMENTS -----
const inputText = document.getElementById("input-text");
const lengthSelect = document.getElementById("summary-length");
const summarizeBtn = document.getElementById("summarize-btn");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");
const errorBox = document.getElementById("error-box");
const loading = document.getElementById("loading");
const output = document.getElementById("summary-output");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");

const PLACEHOLDER_HTML = '<p class="placeholder">Your summary will appear here.</p>';

// ----- 3. SMALL HELPER FUNCTIONS -----
function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function hideError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function setLoading(isLoading) {
  summarizeBtn.disabled = isLoading;
  summarizeBtn.classList.toggle("is-loading", isLoading);
  summarizeBtn.querySelector(".btn-label").textContent = isLoading ? "Summarizing..." : "Summarize Text";
  loading.hidden = !isLoading;
  if (isLoading) output.innerHTML = "";
}

function updateCounts() {
  const text = inputText.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  charCount.textContent = `${text.length.toLocaleString()} characters`;
  wordCount.textContent = `${words.toLocaleString()} words`;
}

// ----- 4. MAIN ACTION: SUMMARIZE -----
async function summarize() {
  hideError();
  const text = inputText.value.trim();

  // Check the input before calling the backend
  if (!text) {
    showError("Please paste some text to summarize.");
    return;
  }
  if (text.length < CONFIG.MIN_CHARS) {
    showError(`Please enter at least ${CONFIG.MIN_CHARS} characters so there is something to summarize.`);
    return;
  }
  if (text.length > CONFIG.MAX_CHARS) {
    showError(`Text is too long. Please keep it under ${CONFIG.MAX_CHARS.toLocaleString()} characters.`);
    return;
  }
  if (!isLocal && API_URL.includes("YOUR-WORKER-NAME")) {
    showError("The backend URL is not set yet. Open script.js and set PRODUCTION_API_URL.");
    return;
  }

  setLoading(true);
  copyBtn.disabled = true;

  try {
    // Send the text to the backend as JSON
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, length: lengthSelect.value }),
    });

    // Read the backend's JSON reply (or an empty object if it isn't JSON)
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (status ${response.status}).`);
    }
    if (!data.summary) {
      throw new Error("The server returned an empty summary. Please try again.");
    }

    output.textContent = data.summary; // textContent = safe, no HTML injection
    copyBtn.disabled = false;
  } catch (err) {
    output.innerHTML = PLACEHOLDER_HTML;
    // "Failed to fetch" means the browser could not reach the backend at all
    const msg = err.message === "Failed to fetch"
      ? "Could not reach the summarizer server. Check your internet connection or the backend URL."
      : err.message;
    showError(msg);
  } finally {
    setLoading(false);
  }
}

// ----- 5. COPY AND CLEAR -----
async function copySummary() {
  try {
    await navigator.clipboard.writeText(output.textContent);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
  } catch {
    showError("Could not copy automatically. Please select the text and copy it manually.");
  }
}

function clearAll() {
  inputText.value = "";
  output.innerHTML = PLACEHOLDER_HTML;
  copyBtn.disabled = true;
  hideError();
  updateCounts();
  inputText.focus();
}

// ----- 6. CONNECT BUTTONS TO FUNCTIONS -----
summarizeBtn.addEventListener("click", summarize);
clearBtn.addEventListener("click", clearAll);
copyBtn.addEventListener("click", copySummary);
inputText.addEventListener("input", updateCounts);

// Shortcut: Ctrl+Enter to summarize
inputText.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) summarize();
});

updateCounts();
