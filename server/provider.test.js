import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const serverEntry = fileURLToPath(new URL("./index.js", import.meta.url));
const providerMockEntry = fileURLToPath(new URL("./provider-mock.js", import.meta.url));
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

async function postJson(path, payload) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

before(async () => {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;

  serverProcess = spawn(process.execPath, ["--import", providerMockEntry, serverEntry], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
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
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(300),
      });
      if (response.ok && (await response.json()).status === "ok") return;
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

test("text generation uses the supported default Groq model and response settings", async () => {
  const response = await postJson("/api/text", { text: "Draft a polite note" });
  assert.equal(response.status, 200);
  const result = (await response.json()).text;
  assert.match(result, /model=openai\/gpt-oss-120b/);
  assert.match(result, /max_completion_tokens=1800/);
  assert.match(result, /reasoning_format=hidden/);
  assert.match(result, /temperature=0.7/);
  assert.match(result, /prompt=Draft a polite note/);
});

test("chat requests use the chat completion budget", async () => {
  const response = await postJson("/api/chat", {
    messages: [{ role: "user", content: "Say hello" }],
  });
  assert.equal(response.status, 200);
  const result = (await response.json()).text;
  assert.match(result, /max_completion_tokens=1600/);
  assert.match(result, /reasoning_format=hidden/);
});

test("document revision uses the lower temperature and document completion budget", async () => {
  const response = await postJson("/api/document", {
    text: "TEST_DOCUMENT: Keep this factual wording.",
  });
  assert.equal(response.status, 200);
  const result = (await response.json()).text;
  assert.match(result, /max_completion_tokens=2200/);
  assert.match(result, /temperature=0.3/);
});

test("provider throttling is returned without leaking provider response details", async () => {
  const response = await postJson("/api/text", { text: "TEST_PROVIDER_RATE_LIMIT" });
  assert.equal(response.status, 429);
  const body = await response.text();
  assert.match(body, /rate limit/i);
  assert.doesNotMatch(body, /secret provider detail/);
});

test("provider credential errors are normalized and do not expose upstream details", async () => {
  const response = await postJson("/api/text", { text: "TEST_PROVIDER_UNAUTHORIZED" });
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.match(body, /rejected the server credentials/i);
  assert.doesNotMatch(body, /secret invalid key detail/);
});

test("unexpected provider errors are normalized and do not expose upstream details", async () => {
  const response = await postJson("/api/text", { text: "TEST_PROVIDER_SERVER_ERROR" });
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.match(body, /could not complete the request/i);
  assert.doesNotMatch(body, /secret internal detail/);
});

test("invalid provider JSON and empty provider completions return safe errors", async () => {
  const malformed = await postJson("/api/text", { text: "TEST_PROVIDER_MALFORMED_JSON" });
  assert.equal(malformed.status, 502);
  assert.match((await malformed.json()).error, /invalid response/i);

  const empty = await postJson("/api/text", { text: "TEST_PROVIDER_EMPTY" });
  assert.equal(empty.status, 502);
  assert.match((await empty.json()).error, /empty response/i);
});
