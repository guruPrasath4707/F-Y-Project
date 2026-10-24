export class InputValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputValidationError";
    this.statusCode = 400;
  }
}

export const MAX_TEXT_LENGTH = 20_000;
const MAX_CHAT_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_CONVERSATION_LENGTH = 24_000;

export function normalizeTextInput(payload) {
  const text = payload?.text;
  if (typeof text !== "string") {
    throw new InputValidationError("Send a text field containing your prompt.");
  }

  const normalized = text.trim();
  if (!normalized) {
    throw new InputValidationError("Enter some text before submitting.");
  }
  if (normalized.length > MAX_TEXT_LENGTH) {
    throw new InputValidationError(`Text must be ${MAX_TEXT_LENGTH.toLocaleString()} characters or fewer.`);
  }

  return normalized;
}

export function normalizeChatMessages(payload) {
  const messages = payload?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new InputValidationError("Send a non-empty messages array.");
  }
  if (messages.length > MAX_CHAT_MESSAGES) {
    throw new InputValidationError(`A conversation can contain at most ${MAX_CHAT_MESSAGES} messages per request.`);
  }

  let totalLength = 0;
  const normalized = messages.map((message) => {
    if (!message || !["user", "assistant"].includes(message.role)) {
      throw new InputValidationError("Each message must have a user or assistant role.");
    }
    if (typeof message.content !== "string") {
      throw new InputValidationError("Each message must contain text.");
    }

    const content = message.content.trim();
    if (!content) {
      throw new InputValidationError("Messages cannot be empty.");
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new InputValidationError(`Each message must be ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or fewer.`);
    }

    totalLength += content.length;
    return { role: message.role, content };
  });

  if (totalLength > MAX_CONVERSATION_LENGTH) {
    throw new InputValidationError("This conversation is too long. Start a new conversation and try again.");
  }
  if (!normalized.some((message) => message.role === "user")) {
    throw new InputValidationError("Include a user message in the conversation.");
  }

  return normalized;
}
