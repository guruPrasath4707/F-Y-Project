import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const serverEntry = fileURLToPath(new URL("./index.js", import.meta.url));

test("production startup fails closed when auth credentials are missing", async () => {
  const child = spawn(process.execPath, [serverEntry], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      AUTH_REQUIRED: "false",
      APP_ACCESS_PASSWORD: "",
      SESSION_SECRET: "",
      PORT: "0",
      HOST: "127.0.0.1",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const [code] = await once(child, "close");
  assert.notEqual(code, 0);
  assert.match(stderr, /APP_ACCESS_PASSWORD must contain/);
});
