const API_URL = "/api/chat";

export const fetchGroqResponse = async (messages) => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((message) => ({
        role: message.sender === "user" ? "user" : "assistant",
        content: message.text,
      })),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "The assistant could not respond. Please try again.");
  }
  if (typeof data.text !== "string" || !data.text.trim()) {
    throw new Error("The AI service returned an empty response. Please try again.");
  }

  return data.text.trim();
};
