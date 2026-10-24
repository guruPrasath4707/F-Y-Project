export const MAX_CHAT_CONTEXT_MESSAGES = 40;
export const MAX_CHAT_CONTEXT_CHARACTERS = 24_000;

/**
 * Select the newest contiguous conversation window within the API limits.
 * The current user message is retained; older context is dropped first.
 */
export function buildChatContext(messages) {
  if (!Array.isArray(messages)) {
    throw new TypeError("Chat context must be an array of messages.");
  }

  const selected = [];
  let totalCharacters = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message.text !== "string") {
      throw new TypeError("Every chat context message must contain text.");
    }

    if (selected.length >= MAX_CHAT_CONTEXT_MESSAGES) break;

    const nextLength = message.text.length;
    if (totalCharacters + nextLength > MAX_CHAT_CONTEXT_CHARACTERS) {
      if (selected.length === 0) {
        throw new RangeError("The latest chat message exceeds the context size limit.");
      }
      break;
    }

    selected.push(message);
    totalCharacters += nextLength;
  }

  return selected.reverse();
}
