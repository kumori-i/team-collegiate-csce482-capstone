import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { chatWithDataset } from "../api";
import "./Chat.css";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || isLoading) return;

    const now = new Date().toLocaleTimeString();
    const userMessage = {
      id: Date.now(),
      text: trimmed,
      sender: "You",
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMessage]);
    setNewMessage("");
    setError("");
    setIsLoading(true);

    try {
      const data = await chatWithDataset(trimmed);
      const assistantMessage = {
        id: Date.now() + 1,
        text: data.reply || "No response from assistant.",
        sender: "Assistant",
        timestamp: new Date().toLocaleTimeString(),
        sources: data.sources || [],
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError("Chat request failed. Please try again.");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          text: "Sorry, something went wrong while answering.",
          sender: "System",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <div>
            <h1>Data Chat</h1>
            <p>Ask questions grounded in your dataset.</p>
          </div>
          <div className="chat-status">
            <span className={isLoading ? "dot active" : "dot"} />
            {isLoading ? "Thinking" : "Ready"}
          </div>
        </div>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="no-messages">
              <p>No messages yet. Ask a question to get started.</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`message ${
                  message.sender === "You" ? "from-user" : "from-assistant"
                }`}
              >
                <div className="message-header">
                  <span className="message-sender">{message.sender}</span>
                  <span className="message-time">{message.timestamp}</span>
                </div>
                <div className="message-text">
                  {message.sender === "You" ? (
                    message.text
                  ) : (
                    <ReactMarkdown>{message.text}</ReactMarkdown>
                  )}
                </div>
                {message.sources?.length > 0 ? (
                  <div className="message-sources">
                    Sources:{" "}
                    {message.sources.map((source, index) => (
                      <span
                        key={`${source.source}-${source.rowStart}-${index}`}
                      >
                        {source.source} ({source.rowStart}-{source.rowEnd})
                        {index < message.sources.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={handleSendMessage} className="chat-input-form">
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="chat-input"
            disabled={isLoading}
          />
          <button type="submit" className="send-button" disabled={isLoading}>
            {isLoading ? "Thinking..." : "Send"}
          </button>
        </form>
        {error ? <div className="chat-error">{error}</div> : null}
      </div>
    </div>
  );
}
