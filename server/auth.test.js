import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const serverEntry = fileURLToPath(new URL("./index.js", import.meta.url));
const providerMockEntry = fileURLToPath(new URL("./provider-mock.js", import.meta.url));
const accessPassword = "test-only-access-password";
let serverProcess;
let baseUrl;
let startupError = "";

async function reservePort() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const { port } = probe.address();
  await new Promise((resolve, reject) => {
    probe.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function getSession(cookie) {
  return fetch(`${baseUrl}/api/session`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

async function postJson(path, payload, cookie) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(payload),
  });
}

async function signIn(password = accessPassword) {
  const response = await postJson("/api/login", { password });
  return {
    response,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}

before(async () => {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;

  serverProcess = spawn(process.execPath, ["--import", providerMockEntry, serverEntry], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      HOST: "127.0.0.1",
      AUTH_REQUIRED: "true",
      APP_ACCESS_PASSWORD: accessPassword,
      SESSION_SECRET: "test-session-secret-minimum-32-bytes-long",
      GROQ_API_KEY: "test-only-provider-key",
      GROQ_MODEL: "",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  serverProcess.stderr.setEncoding("utf8");
  serverProcess.stderr.on("data", (chunk) => {
    startupError += chunk;
  });

  const deadline = Date.now() + 5_000;
  let lastError;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`API server exited before startup. ${startupError}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/session`, {
        signal: AbortSignal.timeout(300),
      });
      const payload = await response.json();
      if (response.ok && payload.authenticationRequired) return;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  serverProcess.kill("SIGTERM");
  throw new Error(`API server did not become healthy: ${String(lastError)}. ${startupError}`);
});

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill("SIGTERM");
    await Promise.race([
      once(serverProcess, "exit"),
      new Promise((resolve) => setTimeout(resolve, 1_000)),
    ]);
  }
});

test("auth-enabled server reports unauthenticated state and blocks AI requests", async () => {
  const session = await getSession();
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), {
    authenticationRequired: true,
    authenticated: false,
  });

  const response = await postJson("/api/text", { text: "Should not reach provider" });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /Authentication required/);
});

test("wrong password returns a generic unauthorized response", async () => {
  const response = await postJson("/api/login", { password: "wrong-password" });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /Invalid access password/);
});

test("valid password creates an HttpOnly SameSite session cookie", async () => {
  const { response, cookie } = await signIn();
  assert.equal(response.status, 200);
  assert.ok(cookie.startsWith("ai_companion_session="));
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /SameSite=Strict/);
  assert.match(response.headers.get("set-cookie"), /Path=\//);
  assert.match(response.headers.get("set-cookie"), /Max-Age=28800/);

  const payload = await response.json();
  assert.equal(payload.authenticated, true);
  assert.equal(payload.authenticationRequired, true);

  const session = await getSession(cookie);
  assert.equal(session.status, 200);
  assert.equal((await session.json()).authenticated, true);
});

test("valid signed session permits AI calls", async () => {
  const { response, cookie } = await signIn();
  assert.equal(response.status, 200);

  const result = await postJson("/api/text", { text: "Write one sentence" }, cookie);
  assert.equal(result.status, 200);
  assert.match((await result.json()).text, /model=openai\/gpt-oss-120b/);
});

test("tampered session cookies are rejected", async () => {
  const { response, cookie } = await signIn();
  assert.equal(response.status, 200);
  const token = cookie.slice(cookie.indexOf("=") + 1);
  const replacementFirstCharacter = token[0] === "A" ? "B" : "A";
  const tampered = `ai_companion_session=${replacementFirstCharacter}${token.slice(1)}`;

  const session = await getSession(tampered);
  assert.equal(session.status, 200);
  assert.equal((await session.json()).authenticated, false);

  const protectedResponse = await postJson("/api/text", { text: "Not authorized" }, tampered);
  assert.equal(protectedResponse.status, 401);
});

test("logout clears the cookie and revokes the active session", async () => {
  const { response, cookie } = await signIn();
  assert.equal(response.status, 200);

  const logout = await fetch(`${baseUrl}/api/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);

  const session = await getSession(cookie);
  assert.equal((await session.json()).authenticated, false);

  const protectedResponse = await postJson("/api/text", { text: "Not authorized after logout" }, cookie);
  assert.equal(protectedResponse.status, 401);
});

test("repeated failed sign-ins are throttled", async () => {
  let lastResponse;
  for (let attempt = 0; attempt < 9; attempt += 1) {
    lastResponse = await postJson("/api/login", { password: "incorrect-password" });
  }
  assert.equal(lastResponse.status, 429);
  assert.match((await lastResponse.json()).error, /Too many sign-in attempts/);
});
