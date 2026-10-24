const realFetch = globalThis.fetch;

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string"
    ? input
    : input instanceof URL ? input.href : input.url;

  if (url !== "https://api.groq.com/openai/v1/chat/completions") {
    return realFetch(input, init);
  }

  const request = JSON.parse(init.body ?? "{}");
  const prompt = [...(request.messages ?? [])]
    .reverse()
    .find((message) => message.role === "user")?.content ?? "";
  const headers = { "Content-Type": "application/json" };

  if (prompt.includes("TEST_PROVIDER_RATE_LIMIT")) {
    return new Response(JSON.stringify({ error: { message: "secret provider detail" } }), {
      status: 429,
      headers,
    });
  }
  if (prompt.includes("TEST_PROVIDER_UNAUTHORIZED")) {
    return new Response(JSON.stringify({ error: { message: "secret invalid key detail" } }), {
      status: 401,
      headers,
    });
  }
  if (prompt.includes("TEST_PROVIDER_SERVER_ERROR")) {
    return new Response(JSON.stringify({ error: { message: "secret internal detail" } }), {
      status: 500,
      headers,
    });
  }
  if (prompt.includes("TEST_PROVIDER_MALFORMED_JSON")) {
    return new Response("not json", { status: 200, headers });
  }
  if (prompt.includes("TEST_PROVIDER_EMPTY")) {
    return new Response(JSON.stringify({
      choices: [{ message: { content: "   " } }],
    }), { status: 200, headers });
  }

  const content = [
    `model=${request.model}`,
    `max_completion_tokens=${request.max_completion_tokens}`,
    `reasoning_format=${request.reasoning_format}`,
    `temperature=${request.temperature}`,
    `prompt=${prompt}`,
  ].join("; ");

  return new Response(JSON.stringify({
    choices: [{ message: { role: "assistant", content } }],
  }), { status: 200, headers });
};
