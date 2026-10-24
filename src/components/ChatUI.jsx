import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings2, Volume2 } from "lucide-react";
import VoiceAssistant from "./VoiceAssistant";
import { fetchGroqResponse } from "../services/api";

const ChatHistory = lazy(() => import("./ChatHistory"));

const createMessage = (text, sender) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  text,
  sender,
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
});

const ChatUI = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    createMessage("Hello! How can I help you?", "assistant"),
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [audioSettings, setAudioSettings] = useState({
    voice: null,
    pitch: 1,
    rate: 1,
    volume: 1,
  });
  const [voices, setVoices] = useState([]);
  const inputRef = useRef(null);
  const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);

  useEffect(() => {
    const synth = synthRef.current;
    if (!synth) return undefined;

    const loadVoices = () => setVoices(synth.getVoices());
    loadVoices();
    synth.addEventListener?.("voiceschanged", loadVoices);

    return () => synth.removeEventListener?.("voiceschanged", loadVoices);
  }, []);

  const speakText = (text) => {
    const synth = synthRef.current;
    if (!synth || typeof window.SpeechSynthesisUtterance !== "function") return;

    if (synth.speaking) synth.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.voice = audioSettings.voice;
    utterance.pitch = audioSettings.pitch;
    utterance.rate = audioSettings.rate;
    utterance.volume = audioSettings.volume;
    synth.speak(utterance);
  };

  useEffect(() => () => {
    synthRef.current?.cancel();
  }, []);

  const handleSend = async (userText) => {
    const trimmedText = userText.trim();
    if (!trimmedText || loading) return;

    const userMessage = createMessage(trimmedText, "user");
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const assistantReply = await fetchGroqResponse(updatedMessages);
      const responseMessage = createMessage(assistantReply, "assistant");
      setMessages([...updatedMessages, responseMessage]);
      speakText(assistantReply);
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : "The assistant could not respond. Please try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !loading) {
      event.preventDefault();
      handleSend(input);
    }
  };

  const handleAudioSettingsChange = (event) => {
    const { name, value } = event.target;
    setAudioSettings((previous) => ({
      ...previous,
      [name]: name === "voice"
        ? voices.find((voice) => voice.name === value) ?? null
        : Number.parseFloat(value),
    }));
  };

  const memoizedChatHistory = useMemo(() => (
    <Suspense fallback={<div className="text-gray-300 text-center p-4">Loading conversation…</div>}>
      <ChatHistory messages={messages} />
    </Suspense>
  ), [messages]);

  return (
    <main className="flex flex-col w-full h-dvh max-w-5xl mx-auto p-3 sm:p-5 bg-gray-900 text-white">
      <header className="flex items-center justify-between gap-3 pb-4 border-b border-gray-700">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Home</span>
        </button>
        <div className="min-w-0 text-center">
          <h1 className="font-semibold text-lg">AI Companion</h1>
          <p className="text-xs text-gray-400">Conversation workspace</p>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((visible) => !visible)}
          className="inline-flex items-center justify-center rounded-lg p-2 text-gray-300 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
          aria-expanded={showSettings}
          aria-label="Toggle audio settings"
        >
          <Settings2 size={20} aria-hidden="true" />
        </button>
      </header>

      {showSettings && (
        <section className="self-end mt-3 bg-gray-800 border border-gray-700 p-4 rounded-xl shadow-lg w-full max-w-sm">
          <h2 className="font-semibold mb-4 inline-flex items-center gap-2">
            <Volume2 size={18} aria-hidden="true" /> Audio settings
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="voice" className="block text-sm font-medium mb-1">Voice</label>
              <select
                id="voice"
                name="voice"
                value={audioSettings.voice?.name ?? ""}
                onChange={handleAudioSettingsChange}
                className="w-full p-2 bg-gray-700 rounded-md"
              >
                <option value="">Browser default</option>
                {voices.map((voice) => (
                  <option key={voice.name} value={voice.name}>{voice.name}</option>
                ))}
              </select>
            </div>
            {[
              { name: "pitch", label: "Pitch", min: "0.5", max: "2", step: "0.1" },
              { name: "rate", label: "Rate", min: "0.5", max: "2", step: "0.1" },
              { name: "volume", label: "Volume", min: "0", max: "1", step: "0.1" },
            ].map((setting) => (
              <div key={setting.name}>
                <label htmlFor={setting.name} className="flex justify-between text-sm font-medium mb-1">
                  <span>{setting.label}</span>
                  <span>{audioSettings[setting.name].toFixed(1)}</span>
                </label>
                <input
                  id={setting.name}
                  type="range"
                  name={setting.name}
                  min={setting.min}
                  max={setting.max}
                  step={setting.step}
                  value={audioSettings[setting.name]}
                  onChange={handleAudioSettingsChange}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex-1 min-h-0 py-4" aria-label="Chat messages">
        {memoizedChatHistory}
      </section>

      {error && (
        <div role="alert" className="mb-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <form
        className="flex items-center gap-2 sm:gap-3 bg-gray-800 border border-gray-700 p-2 sm:p-3 rounded-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          handleSend(input);
        }}
      >
        <VoiceAssistant onVoiceInput={handleSend} />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 p-3 rounded-xl bg-gray-700 text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          placeholder="Ask a question…"
          aria-label="Message the AI assistant"
          autoComplete="off"
          maxLength={8000}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium"
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </form>
      <p className="text-xs text-gray-500 text-center mt-2">
        AI responses can be inaccurate. Avoid sharing passwords or sensitive personal data.
      </p>
    </main>
  );
};

export default ChatUI;
