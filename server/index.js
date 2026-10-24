import "dotenv/config";
import http from "node:http";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const AUTH_REQUIRED = process.env.NODE_ENV === "production" || process.env.AUTH_REQUIRED === "true";
const ACCESS_PASSWORD = process.env.APP_ACCESS_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const ACCESS_PASSWORD_DIGEST = ACCESS_PASSWORD
  ? createHash("sha256").update(ACCESS_PASSWORD).digest()
  : null;
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_COOKIE_NAME = "ai_companion_session";
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const LOGIN_RATE_LIMIT_ATTEMPTS = 8;
if (AUTH_REQUIRED && (ACCESS_PASSWORD.length < 12 || Buffer.byteLength(ACCESS_PASSWORD) > 1024)) {
  throw new Error("APP_ACCESS_PASSWORD must contain between 12 and 1024 characters when authentication is enabled.");
}
if (AUTH_REQUIRED && Buffer.byteLength(SESSION_SECRET) < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 bytes when authentication is enabled.");
}
const PORT = Number.parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "127.0.0.1";
const MAX_BODY_BYTES = 128 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 20;
const requestBuckets = new Map();
const loginBuckets = new Map();
const activeSessions = new Map();

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    let settled = false;

    request.on("data", (chunk) => {
      if (tooLarge || settled) return;

      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        settled = true;
        rejectBody(new HttpError(413, "Request body is too large."));
        // Keep consuming the request without buffering more data so the
        // 413 response can be returned without retaining an oversized body.
        request.resume();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      if (tooLarge || settled) return;
      settled = true;

      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        rejectBody(new HttpError(400, "Request body must be valid JSON."));
      }
    });

    request.on("error", () => {
      if (settled) return;
      settled = true;
      rejectBody(new HttpError(400, "Could not read request body."));
    });
  });
}

function readCookie(request, cookieName) {
  const entries = (request.headers.cookie || "").split(";");
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() === cookieName) {
      return entry.slice(separator + 1).trim();
    }
  }
  return null;
}

function createSessionToken(session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function getSession(request) {
  if (!AUTH_REQUIRED) return null;

  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return null;

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expectedSignature = createHmac("sha256", SESSION_SECRET).update(payload).digest();
  const receivedSignature = Buffer.from(signature, "base64url");
  if (receivedSignature.length !== expectedSignature.length) return null;
  if (!timingSafeEqual(receivedSignature, expectedSignature)) return null;

  let session;
  try {
    session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const activeExpiry = activeSessions.get(session?.sid);
  if (
    session?.v !== 1
    || typeof session.sid !== "string"
    || !Number.isInteger(session.exp)
    || session.exp <= now
    || activeExpiry !== session.exp
  ) {
    if (typeof session?.sid === "string" && activeExpiry && activeExpiry <= now) {
      activeSessions.delete(session.sid);
    }
    return null;
  }

  return session;
}

function sessionCookie(token, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

function enforceLoginRateLimit(request) {
  const key = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  let bucket = loginBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS };
    loginBuckets.set(key, bucket);
  }
  if (loginBuckets.size > 10_000) {
    for (const [address, saved] of loginBuckets) {
      if (saved.resetAt <= now) loginBuckets.delete(address);
    }
  }
  if (bucket.count >= LOGIN_RATE_LIMIT_ATTEMPTS) {
    throw new HttpError(429, "Too many sign-in attempts. Wait 15 minutes and try again.");
  }
  bucket.count += 1;
}

function verifyAccessPassword(candidate) {
  if (typeof candidate !== "string" || candidate.length > 1024 || !ACCESS_PASSWORD_DIGEST) {
    return false;
  }
  const candidateDigest = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(candidateDigest, ACCESS_PASSWORD_DIGEST);
}

function createLoginSession(response, request) {
  const now = Math.floor(Date.now() / 1000);
  for (const [sessionId, expiry] of activeSessions) {
    if (expiry <= now) activeSessions.delete(sessionId);
  }

  const session = {
    v: 1,
    sid: randomBytes(32).toString("base64url"),
    exp: now + SESSION_TTL_SECONDS,
  };
  activeSessions.set(session.sid, session.exp);
  const token = createSessionToken(session);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  sendJson(response, 200, {
    authenticationRequired: true,
    authenticated: true,
    expiresAt: new Date(session.exp * 1000).toISOString(),
  }, {
    "Set-Cookie": sessionCookie(token, SESSION_TTL_SECONDS),
    "Cache-Control": "no-store",
  });
  loginBuckets.delete(request.socket.remoteAddress || "unknown");
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
  // Validate user input before checking configuration, so malformed requests
  // get a 400 response even when a deployment has not configured its API key.
  const messages = createProviderMessages(route, payload);

  if (!API_KEY) {
    throw new HttpError(503, "AI service is not configured. Add GROQ_API_KEY to the server environment.");
  }

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
        max_completion_tokens: route === "/api/chat" ? 1600 : route === "/api/text" ? 1800 : 2200,
        temperature: route === "/api/document" ? 0.3 : 0.7,
        reasoning_format: "hidden",
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
      "Content-Security-Policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
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

  if (pathname === "/api/session") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const session = getSession(request);
    sendJson(response, 200, {
      authenticationRequired: AUTH_REQUIRED,
      authenticated: !AUTH_REQUIRED || Boolean(session),
      ...(session ? { expiresAt: new Date(session.exp * 1000).toISOString() } : {}),
    });
    return;
  }

  if (pathname === "/api/login") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }
    if (!AUTH_REQUIRED) {
      sendJson(response, 200, { authenticationRequired: false, authenticated: true });
      return;
    }

    try {
      enforceLoginRateLimit(request);
      const payload = await readJsonBody(request);
      if (typeof payload?.password !== "string" || payload.password.length > 1024) {
        throw new HttpError(400, "Enter the application access password.");
      }
      if (!verifyAccessPassword(payload.password)) {
        throw new HttpError(401, "Invalid access password.");
      }
      createLoginSession(response, request);
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      sendJson(response, statusCode, {
        error: statusCode === 500 ? "Unexpected server error." : error.message,
      });
    }
    return;
  }

  if (pathname === "/api/logout") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }
    const session = getSession(request);
    if (session) activeSessions.delete(session.sid);
    sendJson(response, 200, {
      authenticationRequired: AUTH_REQUIRED,
      authenticated: !AUTH_REQUIRED,
    }, {
      "Set-Cookie": clearSessionCookie(),
      "Cache-Control": "no-store",
    });
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
    if (AUTH_REQUIRED && !getSession(request)) {
      sendJson(response, 401, { error: "Authentication required." });
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
      const publicMessage = statusCode === 500
        ? "Unexpected server error."
        : error instanceof Error ? error.message : "Unexpected server error.";
      sendJson(response, statusCode, { error: publicMessage });
    }
    return;
  }

  await serveFrontend(request, response, pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`AI Companion server listening on http://${HOST}:${PORT}`);
});
