import React, { useEffect, useRef, memo } from "react";

const ChatHistory = memo(({ messages }) => {
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="h-full overflow-y-auto space-y-3 p-2">
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`p-3 rounded-lg ${msg.sender === "user" ? "ml-auto bg-blue-500" : "mr-auto bg-gray-700"} ${msg.sender === "assistant" ? "max-w-md" : "max-w-xs"} text-white shadow-lg`}
        >
          <p dangerouslySetInnerHTML={{ __html: msg.text }} /> {/* Render sanitized text */}
          <p className="text-xs opacity-70 mt-1">{msg.timestamp}</p>
        </div>
      ))}
      <div ref={chatEndRef} />
    </div>
  );
});

export default ChatHistory;