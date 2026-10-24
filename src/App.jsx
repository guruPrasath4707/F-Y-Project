import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ChatUI from "./components/ChatUI";
import TextGenerator from "./pages/TextGenerator";
import AIDocumentEditor from "./pages/AIDocumentEditor";
import NotFound from "./pages/NotFound";
import AuthGate from "./components/AuthGate";

function App() {
  return (
    <Router>
      <AuthGate>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<ChatUI />} />
        <Route path="/text-generator" element={<TextGenerator />} />
        <Route path="/ai-document-editor" element={<AIDocumentEditor />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </AuthGate>
    </Router>
  );
}

export default App;
