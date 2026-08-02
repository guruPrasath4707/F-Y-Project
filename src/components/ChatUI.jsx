import React, { useState, useRef, lazy, Suspense, useMemo, useEffect } from "react";
import VoiceAssistant from "./VoiceAssistant";
import { fetchGroqResponse } from "../services/api";

const ChatHistory = lazy(() => import("./ChatHistory"));

const sanitizeResponse = (text) => {
  return text
    .replace(/[#*]/g, "") // Remove # and *
    .replace(/\n/g, "<br />"); // Replace newlines with <br />
};

const ChatUI = () => {
  const [messages, setMessages] = useState([
    { text: "Hello! How can I help you?", sender: "assistant", timestamp: new Date().toLocaleTimeString() }
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
  const inputRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const voicesRef = useRef([]);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      voicesRef.current = synthRef.current.getVoices();
    };
    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }
  }, []);

  // Function to speak text with custom settings
  const speakText = (text) => {
    if (synthRef.current.speaking) {
      synthRef.current.cancel(); // Stop any ongoing speech
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.voice = audioSettings.voice;
    utterance.pitch = audioSettings.pitch;
    utterance.rate = audioSettings.rate;
    utterance.volume = audioSettings.volume;
    synthRef.current.speak(utterance);
  };

  // Stop speech synthesis when the component unmounts
  useEffect(() => {
    return () => {
      if (synthRef.current.speaking) {
        synthRef.current.cancel(); // Stop speech when the component unmounts
      }
    };
  }, []); // Empty dependency array ensures this runs only on unmount

  const handleSend = async (userText) => {
    if (!userText.trim()) return;

    const newMessage = { text: userText, sender: "user", timestamp: new Date().toLocaleTimeString() };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setLoading(true);
    setError(null);

    try {
      const assistantReply = await fetchGroqResponse(updatedMessages);
      const sanitizedReply = sanitizeResponse(assistantReply);
      const sanitizedForAudio = assistantReply.replace(/[#*]/g, "");

      const responseMessage = { text: sanitizedReply, sender: "assistant", timestamp: new Date().toLocaleTimeString() };
      setMessages([...updatedMessages, responseMessage]);
      speakText(sanitizedForAudio);
    } catch (error) {
      console.error("Error fetching response:", error);
      setError("Failed to fetch response. Please try again.");
    } finally {
      setLoading(false);
    }

    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      handleSend(input);
    }
  };

  const handleAudioSettingsChange = (e) => {
    const { name, value } = e.target;
    setAudioSettings((prev) => ({
      ...prev,
      [name]: name === "voice" ? voicesRef.current.find((v) => v.name === value) : parseFloat(value),
    }));
  };

  const memoizedChatHistory = useMemo(() => (
    <Suspense fallback={<div className="text-white text-center">Loading chat history...</div>}>
      <ChatHistory messages={messages} />
    </Suspense>
  ), [messages]);

  return (
    <div className="flex flex-col justify-between w-screen h-screen p-5 bg-gray-900 text-white">
      {memoizedChatHistory}

      {error && <div className="text-red-500 text-center">{error}</div>}

      <button
        onClick={() => setShowSettings(!showSettings)}
        className="fixed top-5 right-5 p-2 bg-blue-500 rounded-full hover:bg-blue-600"
        aria-label="Audio Settings"
      >
        ⚙️
      </button>

      {showSettings && (
        <div className="fixed top-16 right-5 bg-gray-800 p-4 rounded-lg shadow-lg w-64">
          <h3 className="text-lg font-bold mb-4">Audio Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Voice</label>
              <select
                name="voice"
                value={audioSettings.voice?.name || ""}
                onChange={handleAudioSettingsChange}
                className="w-full p-2 bg-gray-700 rounded-md"
              >
                {voicesRef.current.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pitch</label>
              <input
                type="range"
                name="pitch"
                min="0.5"
                max="2"
                step="0.1"
                value={audioSettings.pitch}
                onChange={handleAudioSettingsChange}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rate</label>
              <input
                type="range"
                name="rate"
                min="0.5"
                max="2"
                step="0.1"
                value={audioSettings.rate}
                onChange={handleAudioSettingsChange}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Volume</label>
              <input
                type="range"
                name="volume"
                min="0"
                max="1"
                step="0.1"
                value={audioSettings.volume}
                onChange={handleAudioSettingsChange}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 bg-gray-800 p-4 rounded-xl w-full">
        <VoiceAssistant onVoiceInput={handleSend} />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 p-3 rounded-md bg-gray-700 text-white outline-none"
          placeholder="Type a message..."
          aria-label="Type a message"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={loading}
          className={`p-3 rounded-md ${loading ? "bg-gray-600" : "bg-blue-500 hover:bg-blue-600"} text-white`}
          aria-label="Send message"
        >
          {loading ? "Loading..." : "Send"}
        </button>
      </div>
    </div>
  );
};

export default ChatUI;