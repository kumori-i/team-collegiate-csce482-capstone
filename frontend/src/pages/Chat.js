import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { chatWithAgent, resetAgentSession } from "../api";
import "./Chat.css";

const CHAT_MESSAGES_STORAGE_KEY = "chatMessagesBySession";
const MAX_HISTORY_MESSAGES = 20;

const createSessionId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `session-${Date.now()}`;

const getSessionId = () => {
  let sessionId = localStorage.getItem("agentSessionId");
  if (!sessionId) {
    sessionId = createSessionId();
    localStorage.setItem("agentSessionId", sessionId);
  }
  return sessionId;
};

const loadMessagesForSession = (sessionId) => {
  try {
    const raw = localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return [];
    const sessionMessages = parsed[sessionId];
    return Array.isArray(sessionMessages) ? sessionMessages : [];
  } catch {
    return [];
  }
};

const saveMessagesForSession = (sessionId, messages) => {
  try {
    const raw = localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const safeStore =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    safeStore[sessionId] = messages;
    localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(safeStore));
  } catch {
    // Ignore localStorage write errors.
  }
};

const removeMessagesForSession = (sessionId) => {
  try {
    const raw = localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    delete parsed[sessionId];
    localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore localStorage write errors.
  }
};

const toAgentHistory = (messages) =>
  messages
    .filter(
      (message) => message.sender === "You" || message.sender === "Assistant",
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.sender === "You" ? "user" : "assistant",
      content: String(message.text || ""),
    }))
    .filter((item) => item.content.trim().length > 0);

export default function Chat() {
  const [sessionId, setSessionId] = useState(() => getSessionId());
  const [messages, setMessages] = useState(() =>
    loadMessagesForSession(sessionId),
  );
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    setMessages(loadMessagesForSession(sessionId));
  }, [sessionId]);

  useEffect(() => {
    saveMessagesForSession(sessionId, messages);
  }, [messages, sessionId]);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleResetChat = async () => {
    if (isLoading) return;
    const oldSessionId = sessionId;

    try {
      await resetAgentSession(oldSessionId);
    } catch {
      // Continue with local reset even if backend reset fails.
    }

    removeMessagesForSession(oldSessionId);
    const nextSessionId = createSessionId();
    localStorage.setItem("agentSessionId", nextSessionId);
    setSessionId(nextSessionId);
    setMessages([]);
    setNewMessage("");
    setError("");
  };

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
      const data = await chatWithAgent(trimmed, toAgentHistory(messages));
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
            <button
              type="button"
              className="chat-reset-button"
              onClick={handleResetChat}
              disabled={isLoading}
            >
              Reset
            </button>
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
