export const generateText = async (userInput) => {
  const response = await fetch("/api/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: userInput }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Text generation failed. Please try again.");
  }
  if (typeof data.text !== "string" || !data.text.trim()) {
    throw new Error("The AI service returned an empty response. Please try again.");
  }

  return data.text.trim();
};
