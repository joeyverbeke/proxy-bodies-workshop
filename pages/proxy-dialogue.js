import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { pickRandomScenario, getScenarioById, DEFAULT_SCENARIO_ID } from "../lib/scenarios";

const PERSONA_KEY = "proxyPersona";
const THREADS_KEY = "proxyDialogueThreads";
const makeThread = (index, scenario) => ({
  id: `${Date.now()}-${index}`,
  title: `${scenario.title}`,
  scenarioId: scenario.id,
  createdAt: Date.now(),
  messages: [{ role: "persona", content: scenario.initialMessage }],
});

const isPersonaValid = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (entry) =>
      typeof entry?.question === "string" &&
      typeof entry?.answer === "string" &&
      entry.question.trim().length > 0 &&
      entry.answer.trim().length > 0
  );

export default function ProxyDialogue() {
  const router = useRouter();
  const [persona, setPersona] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let parsedPersona = null;
    const storedPersona = window.localStorage.getItem(PERSONA_KEY);
    if (storedPersona) {
      try {
        parsedPersona = JSON.parse(storedPersona);
      } catch (err) {
        console.error("Failed to parse persona", err);
      }
    }

    if (!isPersonaValid(parsedPersona)) {
      router.replace("/");
      return;
    }
    setPersona(parsedPersona);

    const storedThreads = window.localStorage.getItem(THREADS_KEY);
    if (storedThreads) {
      try {
        const parsed = JSON.parse(storedThreads);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed.map((thread) => {
            const scenario = getScenarioById(thread.scenarioId || DEFAULT_SCENARIO_ID);
            const msgs = Array.isArray(thread.messages) ? thread.messages : [];
            const updated = msgs.map((msg, idx) => {
              if (
                idx === 0 &&
                msg.role === "persona" &&
                (typeof msg.content !== "string" || !msg.content.includes("EN:") || !msg.content.includes("KO:"))
              ) {
                return { ...msg, content: scenario.initialMessage };
              }
              return msg;
            });
            return { ...thread, scenarioId: scenario.id, messages: updated };
          });
          setThreads(normalized);
          setActiveThreadId(normalized[0].id);
          return;
        }
      } catch (err) {
        console.error("Failed to parse dialogue threads", err);
      }
    }
    const scenario = getScenarioById(DEFAULT_SCENARIO_ID);
    const first = makeThread(1, scenario);
    setThreads([first]);
    setActiveThreadId(first.id);
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

  const activeScenario = useMemo(
    () => getScenarioById(activeThread?.scenarioId || DEFAULT_SCENARIO_ID),
    [activeThread]
  );

  const conversationHistory = useMemo(() => {
    if (!activeThread) return [];
    return activeThread.messages.filter((m) => m.role === "persona" || m.role === "proxy");
  }, [activeThread]);

  const handleNewChat = () => {
    const nextIndex = threads.length + 1;
    const scenario = pickRandomScenario();
    const newThread = makeThread(nextIndex, scenario);
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
  };

  const selectThread = (id) => setActiveThreadId(id);

  const updateThread = (threadId, updater) => {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? updater(t) : t)));
  };

  const handleSend = async () => {
    if (!input.trim() || !persona || loading || !activeThread) return;
    const userMessage = { role: "user", content: input.trim() };
    updateThread(activeThread.id, (thread) => ({
      ...thread,
      messages: [...thread.messages, userMessage],
    }));
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/proxy-dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "human",
          persona,
          scenarioId: activeScenario.id,
          userMessage: userMessage.content,
          history: [...conversationHistory, { role: "user", content: userMessage.content }],
        }),
      });

      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      const proxyMessage = data?.proxyMessage || "";
      const personaReply = data?.personaReply || "";

      updateThread(activeThread.id, (thread) => ({
        ...thread,
        messages: [
          ...thread.messages,
          { role: "proxy", content: proxyMessage },
          { role: "persona", content: personaReply },
        ],
      }));
    } catch (err) {
      console.error("Dialogue request failed", err);
      updateThread(activeThread.id, (thread) => ({
        ...thread,
        messages: [
          ...thread.messages,
          { role: "assistant", content: "The conversation could not continue due to a server error." },
        ],
      }));
    } finally {
      setLoading(false);
    }
  };

  if (!persona) {
    return (
      <div className="container">
        <div className="card">
          <p className="muted">Loading... / 불러오는 중...</p>
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
                Scenario / 시나리오
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="chat-main">
        <h1 className="title">Talk Through Your Proxy / 프록시를 통해 대화하기</h1>
        <p className="subtitle">Scenario: {activeScenario?.summary}</p>

        <div className="messages">
          {activeThread?.messages.map((message, idx) => (
            <div key={idx} className={`bubble ${message.role}`}>
              <span className="muted" style={{ display: "block", marginBottom: 6 }}>
                {message.role === "user"
                  ? "You / 당신"
                  : message.role === "proxy"
                  ? "Proxy / 프록시"
                  : message.role === "persona"
                  ? activeScenario?.personaLabel || "Persona"
                  : "System"}
              </span>
              {message.content}
            </div>
          ))}
          {loading && <div className="bubble assistant muted">...</div>}
        </div>

        <div className="input-bar chat-input-bar">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message / 메시지" />
          <button className="primary-button" onClick={handleSend}>
            Send / 보내기
          </button>
        </div>
      </main>
    </div>
  );
}
