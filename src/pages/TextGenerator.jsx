import { useState } from "react";
import { Link } from "react-router-dom";
import { generateText } from "../services/textApi";

const TextGenerator = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!input.trim() || loading) return;

    setLoading(true);
    setError(null);
    setOutput("");

    try {
      const generatedText = await generateText(input);
      setOutput(generatedText);
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : "Text generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-5">
      <div className="w-full max-w-2xl">
        <Link to="/" className="inline-block mb-6 text-sm text-gray-300 hover:text-white">← Home</Link>
        <h1 className="text-3xl font-bold mb-2">Text generator</h1>
        <p className="text-gray-400 mb-6">Describe the draft you need. You can revise it before using it.</p>
        <label htmlFor="text-prompt" className="block text-sm font-medium mb-2">Your prompt</label>
        <textarea
          id="text-prompt"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="w-full p-3 rounded-xl bg-gray-800 border border-gray-700 text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-400 mb-4"
          placeholder="For example: Write a polite email asking to reschedule a meeting."
          rows={5}
          maxLength={20000}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !input.trim()}
          className="w-full p-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium"
        >
          {loading ? "Generating…" : "Generate text"}
        </button>
        {error && <div role="alert" className="text-red-300 mt-4">{error}</div>}
        {output && (
          <section className="mt-6 p-4 bg-gray-800 border border-gray-700 rounded-xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold">Generated draft</h2>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(output)}
                className="text-sm text-blue-300 hover:text-blue-200"
              >
                Copy text
              </button>
            </div>
            <p className="whitespace-pre-wrap break-words">{output}</p>
          </section>
        )}
      </div>
    </main>
  );
};

export default TextGenerator;
