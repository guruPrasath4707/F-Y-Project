import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ChatUI from "./components/ChatUI";
import TextGenerator from "./pages/TextGenerator";
import AIDocumentEditor from "./pages/AIDocumentEditor";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<ChatUI />} />
        <Route path="/text-generator" element={<TextGenerator />} />
        <Route path="/ai-document-editor" element={<AIDocumentEditor />} />
      </Routes>
    </Router>
  );
}

export default App;
