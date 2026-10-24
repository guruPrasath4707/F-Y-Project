import { useState } from "react";
import { Link } from "react-router-dom";
import { improveText } from "../services/documentApi";

const AIDocumentEditor = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");

  const handleImproveText = async () => {
    if (!input.trim() || loading) return;

    setLoading(true);
    setError(null);
    setOutput("");
    setCopyStatus("");

    try {
      const improvedText = await improveText(input);
      setOutput(improvedText);
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : "Document revision failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!navigator.clipboard?.writeText) {
      setCopyStatus("Clipboard access is unavailable. Select the text and copy it manually.");
      return;
    }

    try {
      await navigator.clipboard.writeText(output);
      setCopyStatus("Copied to clipboard.");
    } catch {
      setCopyStatus("Could not access the clipboard. Select the text and copy it manually.");
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-5">
      <div className="w-full max-w-3xl">
        <Link to="/" className="inline-block mb-6 text-sm text-gray-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
          ← Home
        </Link>
        <h1 className="text-3xl font-bold mb-2">AI document editor</h1>
        <p className="text-gray-400 mb-6">
          Improve clarity and grammar while preserving the meaning of your writing, then edit the result before copying it.
        </p>
        <label htmlFor="document-input" className="block text-sm font-medium mb-2">Original text</label>
        <textarea
          id="document-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="w-full p-3 rounded-xl bg-gray-800 border border-gray-700 text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-400 mb-4"
          placeholder="Paste the text you want to revise…"
          rows={9}
          maxLength={20000}
        />
        <button
          type="button"
          onClick={handleImproveText}
          disabled={loading || !input.trim()}
          className="w-full p-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
        >
          {loading ? "Revising…" : "Improve text"}
        </button>
        {error && <div role="alert" className="text-red-300 mt-4">{error}</div>}
        {output && (
          <section className="mt-6 p-4 bg-gray-800 border border-gray-700 rounded-xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <label htmlFor="document-output" className="text-lg font-semibold">Revised text (editable)</label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-sm text-blue-300 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
              >
                Copy text
              </button>
            </div>
            <textarea
              id="document-output"
              value={output}
              onChange={(event) => {
                setOutput(event.target.value);
                setCopyStatus("");
              }}
              className="w-full min-h-56 p-3 rounded-xl bg-gray-900 border border-gray-700 text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              rows={9}
              maxLength={20000}
            />
            {copyStatus && <p role="status" aria-live="polite" className="text-sm text-gray-300 mt-2">{copyStatus}</p>}
          </section>
        )}
      </div>
    </main>
  );
};

export default AIDocumentEditor;
