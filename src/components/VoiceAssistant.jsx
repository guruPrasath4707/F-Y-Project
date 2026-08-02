import React, { useState, useRef } from "react";
import { Mic, MicOff } from "lucide-react";

const VoiceAssistant = ({ onVoiceInput }) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const debounceTimeout = useRef(null);

  const handleVoiceClick = () => {
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      alert("Your browser does not support voice recognition.");
      return;
    }

    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.trim().toLowerCase();

      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      debounceTimeout.current = setTimeout(() => {
        if (text === "clear chat") {
          onVoiceInput("clear chat");
          return;
        }
        if (text === "repeat last message") {
          onVoiceInput("repeat last message");
          return;
        }
        onVoiceInput(text);
      }, 500);
    };

    recognition.onerror = (event) => {
      alert(`Voice recognition error: ${event.error}`);
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <button
      onClick={handleVoiceClick}
      className={`w-12 h-12 flex items-center justify-center rounded-full ${
        listening ? "bg-red-500 animate-pulse" : "bg-orange-500 hover:bg-orange-600"
      } text-white`}
      aria-label={listening ? "Stop listening" : "Start listening"}
      role="button"
    >
      {listening ? <MicOff size={24} /> : <Mic size={24} />}
    </button>
  );
};

export default VoiceAssistant;