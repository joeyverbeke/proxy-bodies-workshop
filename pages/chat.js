import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

const PERSONA_KEY = "proxyPersona";
const THREADS_KEY = "proxyThreads";

const makeThread = (index) => ({
  id: `${Date.now()}-${index}`,
  title: `Chat ${index} / 채팅 ${index}`,
  createdAt: Date.now(),
  messages: [],
});

const isPersonaComplete = (value) => {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (entry) =>
      typeof entry?.question === "string" &&
      typeof entry?.answer === "string" &&
      entry.question.trim().length > 0 &&
      entry.answer.trim().length > 0
  );
};

export default function Chat() {
  const router = useRouter();
  const [persona, setPersona] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [input, setInput] = useState("");
  const [loadingThreadId, setLoadingThreadId] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let parsedPersona = null;
    const storedPersona = window.localStorage.getItem(PERSONA_KEY);
    if (storedPersona) {
      try {
        parsedPersona = JSON.parse(storedPersona);
      } catch (err) {
        console.error("Failed to parse persona from storage", err);
      }
    }

    if (!isPersonaComplete(parsedPersona)) {
      router.replace("/");
      return;
    }
    setPersona(parsedPersona);

    const storedThreads = window.localStorage.getItem(THREADS_KEY);
    let parsedThreads = [];
    if (storedThreads) {
      try {
        const parsed = JSON.parse(storedThreads);
        if (Array.isArray(parsed)) parsedThreads = parsed;
      } catch (err) {
        console.error("Failed to parse threads from storage", err);
      }
    }

    if (parsedThreads.length === 0) {
      const first = makeThread(1);
      parsedThreads = [first];
      setActiveThreadId(first.id);
    } else {
      setActiveThreadId(parsedThreads[0].id);
    }
    setThreads(parsedThreads);
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (threads.length === 0) return;
    window.localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  }, [threads]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId),
    [threads, activeThreadId]
  );

  const handleNewChat = () => {
    const nextIndex = threads.length + 1;
    const newThread = makeThread(nextIndex);
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
  };

  const selectThread = (id) => setActiveThreadId(id);

  const updateThread = (threadId, updater) => {
    setThreads((prev) =>
      prev.map((thread) => (thread.id === threadId ? updater(thread) : thread))
    );
  };

  const appendMessage = (threadId, message) => {
    updateThread(threadId, (thread) => ({
      ...thread,
      messages: [...thread.messages, message],
    }));
  };

  const handleSend = async () => {
    if (!input.trim() || !activeThread || !persona) return;
    const userMessage = { role: "user", content: input.trim() };
    const optimisticMessages = [...activeThread.messages, userMessage];
    appendMessage(activeThread.id, userMessage);
    setInput("");
    setLoadingThreadId(activeThread.id);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, messages: optimisticMessages }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      const reply = data?.reply || "The proxy responded with an empty reply. / 프록시가 빈 답변을 보냈습니다.";
      appendMessage(activeThread.id, { role: "assistant", content: reply });
    } catch (err) {
      console.error("Chat request failed", err);
      appendMessage(activeThread.id, {
        role: "assistant",
        content: "The proxy could not respond due to a server error. / 서버 오류로 응답하지 못했습니다.",
      });
    } finally {
      setLoadingThreadId(null);
    }
  };

  const formatDate = (value) => {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "";
    }
  };

  const snippetForThread = (thread) => {
    const firstUser = thread.messages.find((m) => m.role === "user");
    if (!firstUser) return "No messages yet / 아직 메시지가 없습니다";
    const words = firstUser.content.trim().split(/\s+/).slice(0, 6).join(" ");
    return words || "No messages yet / 아직 메시지가 없습니다";
  };

  if (!persona) {
    return (
      <div className="container">
        <div className="card">
          <p className="muted">Loading persona... / 페르소나 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-layout">
      <aside className="sidebar">
        <button className="primary-button" onClick={handleNewChat}>
          New chat / 새 채팅
        </button>
        <div className="thread-list">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`thread-item ${thread.id === activeThreadId ? "active" : ""}`}
              onClick={() => selectThread(thread.id)}
            >
              <div className="thread-title">{thread.title}</div>
              <div className="thread-meta">
                {snippetForThread(thread)}
                <br />
                {formatDate(thread.createdAt)}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="chat-main">
        <div className="messages">
          {activeThread?.messages.map((message, idx) => (
            <div key={idx} className={`bubble ${message.role}`}>
              {message.content}
            </div>
          ))}
          {loadingThreadId === activeThreadId && (
            <div className="bubble assistant muted">...</div>
          )}
        </div>

        <div className="input-bar chat-input-bar">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message / 메시지"
          />
          <button className="primary-button" onClick={handleSend}>
            Send / 보내기
          </button>
        </div>
      </main>
    </div>
  );
}
