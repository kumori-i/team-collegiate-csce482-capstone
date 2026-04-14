import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  chatWithAgentStream,
  getChatSuggestions,
  resetAgentSession,
} from "../api";
import ChatMetricChart from "../components/ChatMetricChart";
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

const buildSuggestionRequest = (messages) => {
  const history = toAgentHistory(messages);
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.sender === "You")?.text;
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.sender === "Assistant");

  return {
    history,
    latestUserMessage: String(latestUserMessage || ""),
    latestAssistantReply: String(latestAssistantMessage?.text || ""),
    toolUsed: String(latestAssistantMessage?.toolUsed || ""),
    chartSpec: latestAssistantMessage?.chartSpec || null,
    mode: messages.length > 0 ? "followup" : "startup",
  };
};

export default function Chat({ onLogout }) {
  const [sessionId, setSessionId] = useState(() => getSessionId());
  const [messages, setMessages] = useState(() =>
    loadMessagesForSession(sessionId),
  );
  const [suggestions, setSuggestions] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  /** True until the first token chunk or done/error for the in-flight assistant reply. */
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const latestMessagesRef = useRef(messages);

  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const sessionMessages = loadMessagesForSession(sessionId);
    setMessages(sessionMessages);

    let cancelled = false;
    const loadSuggestions = async () => {
      try {
        const data = await getChatSuggestions(buildSuggestionRequest(sessionMessages));
        if (!cancelled) {
          setSuggestions((current) =>
            latestMessagesRef.current.length !== sessionMessages.length
              ? current
              : current.length > 0 && sessionMessages.length > 0
              ? current
              : Array.isArray(data?.suggestions)
                ? data.suggestions
                : [],
          );
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
        }
      }
    };

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    saveMessagesForSession(sessionId, messages);
  }, [messages, sessionId]);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, awaitingFirstToken]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

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
    setSuggestions([]);
    setNewMessage("");
    setError("");
    inputRef.current?.focus();
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

    const historyForAgent = toAgentHistory([...messages, userMessage]);
    const assistantId = Date.now() + 1;
    const assistantTimestamp = new Date().toLocaleTimeString();
    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        text: "",
        sender: "Assistant",
        timestamp: assistantTimestamp,
        sources: [],
        chartSpec: null,
      },
    ]);
    setNewMessage("");
    setError("");
    setIsLoading(true);
    setAwaitingFirstToken(true);

    try {
      await chatWithAgentStream(trimmed, historyForAgent, {
        onToken: ({ text }) => {
          setAwaitingFirstToken((was) => (was ? false : was));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, text: (m.text || "") + text }
                : m,
            ),
          );
        },
        onDone: (data) => {
          setAwaitingFirstToken(false);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    text: data.reply ?? m.text ?? "",
                    sources: data.sources ?? [],
                    chartSpec: data.chartSpec ?? null,
                    toolUsed: data.toolUsed ?? "",
                  }
                : m,
            ),
          );
          setSuggestions(
            Array.isArray(data.suggestions) ? data.suggestions : [],
          );
        },
        onError: ({ message: errMsg }) => {
          setAwaitingFirstToken(false);
          setError(errMsg || "Chat request failed.");
        },
      });
    } catch (err) {
      setAwaitingFirstToken(false);
      if (err.response?.status === 401 || err.response?.status === 403) {
        onLogout?.();
        return;
      }
      setError("Chat request failed. Please try again.");
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== assistantId),
        {
          id: Date.now() + 2,
          text: "Sorry, something went wrong while answering.",
          sender: "System",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setAwaitingFirstToken(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (isLoading) return;
    setNewMessage(String(suggestion || ""));
    inputRef.current?.focus();
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
              {suggestions.length > 0 ? (
                <div className="chat-suggestions">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="chat-suggestion-button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      disabled={isLoading}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
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
                  ) : !(message.text || "").trim() &&
                    !message.chartSpec &&
                    awaitingFirstToken ? (
                    <span
                      className="assistant-loading"
                      role="status"
                      aria-live="polite"
                      aria-label="Loading response"
                    >
                      <span className="assistant-loading-spinner" aria-hidden />
                    </span>
                  ) : (
                    <>
                      <ReactMarkdown>{message.text}</ReactMarkdown>
                      {message.chartSpec ? (
                        <ChatMetricChart chartSpec={message.chartSpec} />
                      ) : null}
                    </>
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

        {messages.length > 0 && suggestions.length > 0 ? (
          <div className="chat-suggestions chat-suggestions-inline">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chat-suggestion-button"
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={isLoading}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSendMessage} className="chat-input-form">
          <input
            ref={inputRef}
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
