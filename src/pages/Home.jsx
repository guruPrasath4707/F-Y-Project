import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-5">
      <h1 className="text-4xl font-bold mb-8">AI Companion</h1>
      <p className="text-gray-300 text-center max-w-xl mb-8">
        A focused workspace for conversation, first drafts, and clearer writing.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        <Link
          to="/chat"
          className="group p-6 bg-gray-800 border border-gray-700 rounded-xl text-left hover:border-blue-500 hover:bg-gray-800/80 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
        >
          <h2 className="text-xl font-semibold mb-2">Voice assistant</h2>
          <p className="text-gray-400">Ask questions by typing or using your browser's microphone.</p>
          <span className="mt-5 inline-block text-sm font-medium text-blue-300">Open conversation →</span>
        </Link>
        <Link
          to="/text-generator"
          className="group p-6 bg-gray-800 border border-gray-700 rounded-xl text-left hover:border-blue-500 hover:bg-gray-800/80 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
        >
          <h2 className="text-xl font-semibold mb-2">Text generator</h2>
          <p className="text-gray-400">Turn a prompt into a useful starting draft for messages and documents.</p>
          <span className="mt-5 inline-block text-sm font-medium text-blue-300">Create a draft →</span>
        </Link>
        <Link
          to="/ai-document-editor"
          className="group p-6 bg-gray-800 border border-gray-700 rounded-xl text-left hover:border-blue-500 hover:bg-gray-800/80 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 md:col-span-2"
        >
          <h2 className="text-xl font-semibold mb-2">AI document editor</h2>
          <p className="text-gray-400">Improve grammar, clarity, and tone while keeping your original meaning.</p>
          <span className="mt-5 inline-block text-sm font-medium text-blue-300">Edit writing →</span>
        </Link>
      </div>
      <p className="mt-8 max-w-2xl text-center text-xs text-gray-500">
        Review AI-generated content before using it. Do not submit passwords, API keys, or other sensitive information.
      </p>
    </div>
  );
};

export default Home;
