// src/services/documentApi.js
const GROQ_API_KEY = import.meta.env.VITE_DOC_API_KEY; // Use your Groq API key
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export const improveText = async (text) => {
  if (!GROQ_API_KEY) {
    console.error("Groq API Key is missing! Check your .env file.");
    return "Error: Groq API Key is missing.";
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-saba-24b", // Use the correct model
        messages: [
          {
            role: "user",
            content: `Improve the following text for grammar, style, and tone:\n\n${text}`,
          },
        ],
        max_tokens: 500, // Adjust as needed
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Sorry, I couldn't improve the text.";
  } catch (error) {
    console.error("API Error:", error);
    return `Error: ${error.message}`;
  }
};