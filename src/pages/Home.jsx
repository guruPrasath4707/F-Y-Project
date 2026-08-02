// src/pages/Home.jsx
import React from "react";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-5">
      <h1 className="text-4xl font-bold mb-8">AI COMPANION </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/chat"
          className="p-6 bg-gray-800 rounded-lg text-center hover:bg-gray-700 transition-colors"
        >
          <h2 className="text-2xl font-semibold mb-2">Voice Assistant</h2>
          <p className="text-gray-400">Interact with an AI-powered chatbot.</p>
        </Link>
        <Link
          to="/text-generator"
          className="p-6 bg-gray-800 rounded-lg text-center hover:bg-gray-700 transition-colors"
        >
          <h2 className="text-2xl font-semibold mb-2">Text Generator</h2>
          <p className="text-gray-400">Generate text for emails, letters, and more.</p>
        </Link>
        <Link
          to="/ai-document-editor"
          className="p-6 bg-gray-800 rounded-lg text-center hover:bg-gray-700 transition-colors"
        >
          <h2 className="text-2xl font-semibold mb-2">Document Editor</h2>
          <p className="text-gray-400">Improve grammar, style, and tone of your text.</p>
        </Link>
      </div>
    </div>
  );
};

export default Home;