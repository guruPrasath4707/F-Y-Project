import PropTypes from "prop-types";
import { useState, useRef } from "react";
import { Mic, MicOff } from "lucide-react";

const VoiceAssistant = ({ onVoiceInput }) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const debounceTimeout = useRef(null);

  const handleVoiceClick = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      window.alert("Your browser does not support voice recognition. You can type in the message box instead.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.trim();
      if (!text) return;

      if (debounceTimeout.current) window.clearTimeout(debounceTimeout.current);
      debounceTimeout.current = window.setTimeout(() => {
        onVoiceInput(text);
      }, 250);
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        window.alert(`Voice recognition error: ${event.error}`);
      }
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setListening(false);
      window.alert("Voice recognition could not start. Please try again.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleVoiceClick}
      className={`w-12 h-12 shrink-0 flex items-center justify-center rounded-full ${
        listening ? "bg-red-500 animate-pulse" : "bg-orange-500 hover:bg-orange-600"
      } text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400`}
      aria-label={listening ? "Stop listening" : "Start voice input"}
      aria-pressed={listening}
    >
      {listening ? <MicOff size={24} aria-hidden="true" /> : <Mic size={24} aria-hidden="true" />}
    </button>
  );
};

VoiceAssistant.propTypes = {
  onVoiceInput: PropTypes.func.isRequired,
};

export default VoiceAssistant;
