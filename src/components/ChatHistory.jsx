import { memo, useEffect, useRef } from "react";

const ChatHistory = memo(({ messages }) => {
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div
      className="h-full overflow-y-auto space-y-3 p-2"
      aria-label="Conversation"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {messages.map((msg, index) => (
        <article
          key={msg.id ?? `${msg.sender}-${msg.timestamp}-${index}`}
          className={`chat-message w-fit p-3 rounded-lg text-white shadow-lg ${
            msg.sender === "user"
              ? "ml-auto bg-blue-600 max-w-[85%] md:max-w-[70%]"
              : "mr-auto bg-gray-700 max-w-[90%] md:max-w-[78%]"
          }`}
        >
          <p className="whitespace-pre-wrap">{msg.text}</p>
          <p className="text-xs opacity-70 mt-2">{msg.timestamp}</p>
        </article>
      ))}
      <div ref={chatEndRef} />
    </div>
  );
});

ChatHistory.displayName = "ChatHistory";

export default ChatHistory;
