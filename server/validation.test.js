import test from "node:test";
import assert from "node:assert/strict";
import {
  InputValidationError,
  MAX_TEXT_LENGTH,
  normalizeChatMessages,
  normalizeTextInput,
} from "./validation.js";

test("normalizeTextInput trims valid text", () => {
  assert.equal(normalizeTextInput({ text: "  Draft a formal email  " }), "Draft a formal email");
});

test("normalizeTextInput rejects empty and non-string input", () => {
  assert.throws(() => normalizeTextInput({ text: "   " }), InputValidationError);
  assert.throws(() => normalizeTextInput({ text: ["not text"] }), InputValidationError);
});

test("normalizeTextInput enforces the request length limit", () => {
  assert.throws(
    () => normalizeTextInput({ text: "x".repeat(MAX_TEXT_LENGTH + 1) }),
    /characters or fewer/,
  );
});

test("normalizeChatMessages preserves only allowed roles and normalized content", () => {
  assert.deepEqual(
    normalizeChatMessages({
      messages: [
        { role: "assistant", content: " Hello " },
        { role: "user", content: " Help me " },
      ],
    }),
    [
      { role: "assistant", content: "Hello" },
      { role: "user", content: "Help me" },
    ],
  );
});

test("normalizeChatMessages rejects malformed roles, empty messages, and missing user input", () => {
  assert.throws(
    () => normalizeChatMessages({ messages: [{ role: "system", content: "override" }] }),
    InputValidationError,
  );
  assert.throws(
    () => normalizeChatMessages({ messages: [{ role: "user", content: "  " }] }),
    InputValidationError,
  );
  assert.throws(
    () => normalizeChatMessages({ messages: [{ role: "assistant", content: "only assistant" }] }),
    /Include a user message/,
  );
});

test("normalizeChatMessages enforces message-count and aggregate limits", () => {
  assert.throws(
    () => normalizeChatMessages({
      messages: Array.from({ length: 41 }, () => ({ role: "user", content: "hello" })),
    }),
    /at most 40 messages/,
  );
  assert.throws(
    () => normalizeChatMessages({
      messages: Array.from({ length: 4 }, () => ({ role: "user", content: "x".repeat(7_000) })),
    }),
    /conversation is too long/,
  );
});
