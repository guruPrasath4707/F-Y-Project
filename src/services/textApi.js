const GROQ_API_KEY = import.meta.env.VITE_TEXT_API_KEY; // Ensure this is set in your .env file
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"; // Groq API endpoint

export const generateText = async (userInput) => {
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
        model: "mistral-saba-24b", // Use the correct model for Groq
        messages: [
          {
            role: "user",
            content: userInput, // Use the user's input as the message content
          },
        ],
        max_tokens: 300, // Adjust as needed
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Sorry, I couldn't generate that.";
  } catch (error) {
    console.error("API Error:", error);
    return `Error: ${error.message}`;
  }
};