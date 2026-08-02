const API_KEY = import.meta.env.VITE_GROQ_API_KEY;  // Ensure it reads from .env
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

export const fetchGroqResponse = async (messages) => {
  if (!API_KEY) {
    console.error("API Key is missing! Check your .env file.");
    return "Error: API Key is missing.";
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "mistral-saba-24b",
        messages: messages.map(msg => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text
        })),
        max_tokens: 200 // Increased from 50 to 200
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
  } catch (error) {
    console.error("API Error:", error);
    return `Error: ${error.message}`;
  }
};