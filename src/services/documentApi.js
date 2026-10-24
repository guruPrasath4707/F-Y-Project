export const improveText = async (text) => {
  const response = await fetch("/api/document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Document revision failed. Please try again.");
  }
  if (typeof data.text !== "string" || !data.text.trim()) {
    throw new Error("The AI service returned an empty response. Please try again.");
  }

  return data.text.trim();
};
