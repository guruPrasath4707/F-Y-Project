import "dotenv/config";
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  InputValidationError,
  normalizeChatMessages,
  normalizeTextInput,
} from "./validation.js";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIST_ROOT = resolve(PROJECT_ROOT, "dist");
const API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || "mistral-saba-24b";
const PORT = Number.parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "127.0.0.1";
const MAX_BODY_BYTES = 128 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 20;
const requestBuckets = new Map();

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, "Request body is too large.");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function enforceRateLimit(request) {
  const key = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  let bucket = requestBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    requestBuckets.set(key, bucket);
  }
  if (requestBuckets.size > 10_000) {
    for (const [address, saved] of requestBuckets) {
      if (saved.resetAt <= now) requestBuckets.delete(address);
    }
  }
  if (bucket.count >= RATE_LIMIT_REQUESTS) {
    throw new HttpError(429, "Too many requests. Please wait a minute and try again.");
  }
  bucket.count += 1;
}

function createProviderMessages(route, payload) {
  if (route === "/api/chat") {
    return [
      {
        role: "system",
        content: "You are a helpful AI companion. Be clear, respectful, and honest about uncertainty. Do not claim to have performed actions you cannot perform.",
      },
      ...normalizeChatMessages(payload),
    ];
  }

  const text = normalizeTextInput(payload);
  if (route === "/api/text") {
    return [
      {
        role: "system",
        content: "You are a practical writing assistant. Create a useful draft that follows the user's request. Do not invent personal details or claim that generated content is verified.",
      },
      { role: "user", content: text },
    ];
  }

  return [
    {
      role: "system",
      content: "You are a careful editor. Improve grammar, clarity, structure, and tone while preserving the writer's meaning, names, figures, and factual claims. Do not add unsupported facts. Return only the revised text.",
    },
    { role: "user", content: text },
  ];
}

async function requestGroq(route, payload) {
  if (!API_KEY) {
    throw new HttpError(503, "AI service is not configured. Add GROQ_API_KEY to the server environment.");
  }

  const messages = createProviderMessages(route, payload);
  let upstream;

  try {
    upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: route === "/api/chat" ? 900 : route === "/api/text" ? 900 : 1400,
        temperature: route === "/api/document" ? 0.3 : 0.7,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new HttpError(504, "The AI service took too long to respond. Please try again.");
    }
    throw new HttpError(502, "Could not reach the AI service. Please try again.");
  }

  if (!upstream.ok) {
    // Deliberately do not send provider response bodies or credentials to the browser.
    console.error(`Groq request failed with HTTP ${upstream.status}.`);
    if (upstream.status === 429) {
      throw new HttpError(429, "The AI provider rate limit was reached. Please try again shortly.");
    }
    if (upstream.status === 401 || upstream.status === 403) {
      throw new HttpError(502, "The AI provider rejected the server credentials or model access.");
    }
    throw new HttpError(502, "The AI service could not complete the request.");
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    throw new HttpError(502, "The AI service returned an invalid response.");
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new HttpError(502, "The AI service returned an empty response.");
  }

  return text.trim();
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function serveFrontend(request, response, pathname) {
  if (!["GET", "HEAD"].includes(request.method)) {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  let candidate = resolve(DIST_ROOT, `.${pathname}`);
  if (candidate !== DIST_ROOT && !candidate.startsWith(`${DIST_ROOT}${sep}`)) {
    sendJson(response, 400, { error: "Invalid path." });
    return;
  }

  try {
    const fileInfo = await stat(candidate);
    if (fileInfo.isDirectory()) candidate = resolve(candidate, "index.html");
  } catch {
    // Unmatched extension-less paths are client-side routes; asset paths must 404.
    if (extname(pathname)) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    candidate = resolve(DIST_ROOT, "index.html");
  }

  if (!candidate.startsWith(`${DIST_ROOT}${sep}`)) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  try {
    const file = await readFile(candidate);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(candidate)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; connect-src 'self' https://api.groq.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    });
    response.end(request.method === "HEAD" ? undefined : file);
  } catch {
    sendJson(response, 404, { error: "Build output not found. Run npm run build first." });
  }
}

const server = http.createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  } catch {
    sendJson(response, 400, { error: "Invalid request path." });
    return;
  }

  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { status: "ok", aiConfigured: Boolean(API_KEY) });
    return;
  }

  const aiRoutes = new Set(["/api/chat", "/api/text", "/api/document"]);
  if (pathname.startsWith("/api/")) {
    if (!aiRoutes.has(pathname)) {
      sendJson(response, 404, { error: "API route not found." });
      return;
    }
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    try {
      enforceRateLimit(request);
      const payload = await readJsonBody(request);
      const text = await requestGroq(pathname, payload);
      sendJson(response, 200, { text });
    } catch (error) {
      const statusCode = error instanceof InputValidationError
        ? 400
        : Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      if (statusCode >= 500 && statusCode !== 503 && statusCode !== 504) {
        console.error("Unexpected API request error.");
      }
      sendJson(response, statusCode, {
        error: error instanceof Error ? error.message : "Unexpected server error.",
      });
    }
    return;
  }

  await serveFrontend(request, response, pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`AI Companion server listening on http://${HOST}:${PORT}`);
});
