// src/pages/AIDocumentEditor.jsx
import React, { useState } from "react";
import { improveText } from "../services/documentApi";

const AIDocumentEditor = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleImproveText = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const improvedText = await improveText(input);
      setOutput(improvedText);
    } catch (error) {
      console.error("Error improving text:", error);
      setError("Failed to improve text. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-5">
      <h1 className="text-3xl font-bold mb-6">AI Document Editor</h1>
      <div className="w-full max-w-2xl">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full p-3 rounded-md bg-gray-700 text-white outline-none mb-4"
          placeholder="Paste your text here..."
          rows="10"
        />
        <button
          onClick={handleImproveText}
          disabled={loading}
          className={`w-full p-3 rounded-md ${loading ? "bg-gray-600" : "bg-blue-500 hover:bg-blue-600"} text-white`}
        >
          {loading ? "Improving..." : "Improve Text"}
        </button>
        {error && <div className="text-red-500 text-center mt-4">{error}</div>}
        {output && (
          <div className="mt-6 p-4 bg-gray-800 rounded-md">
            <h2 className="text-xl font-bold mb-2">Improved Text:</h2>
            <p className="whitespace-pre-wrap">{output}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIDocumentEditor;