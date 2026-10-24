import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChatContext,
  MAX_CHAT_CONTEXT_CHARACTERS,
  MAX_CHAT_CONTEXT_MESSAGES,
} from "../src/utils/chatContext.js";

const message = (text, index) => ({
  id: String(index),
  sender: index % 2 ? "user" : "assistant",
  timestamp: "12:00",
  text,
});

test("chat context preserves messages when it is within both API limits", () => {
  const messages = [message("Hello", 1), message("Hi", 2), message("Help me", 3)];
  assert.deepEqual(buildChatContext(messages), messages);
});

test("chat context keeps the newest messages when the message-count limit is reached", () => {
  const messages = Array.from(
    { length: MAX_CHAT_CONTEXT_MESSAGES + 7 },
    (_, index) => message(`message-${index}`, index),
  );

  const context = buildChatContext(messages);
  assert.equal(context.length, MAX_CHAT_CONTEXT_MESSAGES);
  assert.equal(context[0].text, "message-7");
  assert.equal(context.at(-1).text, `message-${messages.length - 1}`);
});

test("chat context drops older history before exceeding the character limit", () => {
  const messages = [
    message("old context ".repeat(1_500), 1),
    message("recent context ".repeat(700), 2),
    message("current prompt", 3),
  ];

  const context = buildChatContext(messages);
  assert.deepEqual(context.map((entry) => entry.text), messages.slice(1).map((entry) => entry.text));
  assert.ok(context.reduce((total, entry) => total + entry.text.length, 0) <= MAX_CHAT_CONTEXT_CHARACTERS);
  assert.equal(context.at(-1).text, "current prompt");
});

test("chat context rejects malformed input instead of silently corrupting history", () => {
  assert.throws(() => buildChatContext(null), /array of messages/);
  assert.throws(() => buildChatContext([{ sender: "user" }]), /contain text/);
  assert.throws(
    () => buildChatContext([message("x".repeat(MAX_CHAT_CONTEXT_CHARACTERS + 1), 1)]),
    /latest chat message exceeds/,
  );
});
