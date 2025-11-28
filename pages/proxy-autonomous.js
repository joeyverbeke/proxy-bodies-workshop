import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

const PERSONA_KEY = "proxyPersona";
const THREADS_KEY = "proxyAutonomousThreads";
const MAX_TURNS = 5;
const INITIAL_PERSONA_MESSAGE =
  "EN: Hey, I just heard about your pet. I remember when you first brought them home. How are you holding up?\n" +
  "KO: 방금 너희 반려동물 소식 들었어. 처음 데려왔을 때가 기억나. 지금 마음은 어때?";
const makeThread = (index) => ({
  id: `${Date.now()}-${index}`,
  title: `Chat ${index} / 채팅 ${index}`,
  createdAt: Date.now(),
  messages: [{ role: "persona", content: INITIAL_PERSONA_MESSAGE }],
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

export default function ProxyAutonomous() {
  const router = useRouter();
  const [persona, setPersona] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [runningThreadId, setRunningThreadId] = useState(null);

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

    const stored = window.localStorage.getItem(THREADS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed.map((thread) => {
            const msgs = Array.isArray(thread.messages) ? thread.messages : [];
            const updated = msgs.map((msg, idx) => {
              if (
                idx === 0 &&
                msg.role === "persona" &&
                (typeof msg.content !== "string" || !msg.content.includes("EN:") || !msg.content.includes("KO:"))
              ) {
                return { ...msg, content: INITIAL_PERSONA_MESSAGE };
              }
              return msg;
            });
            return { ...thread, messages: updated };
          });
          setThreads(normalized);
          setActiveThreadId(normalized[0].id);
          return;
        }
      } catch (err) {
        console.error("Failed to parse autonomous history", err);
      }
    }
    const first = makeThread(1);
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

  const handleNewChat = () => {
    const nextIndex = threads.length + 1;
    const newThread = makeThread(nextIndex);
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
  };

  const selectThread = (id) => setActiveThreadId(id);

  const updateThread = (threadId, updater) => {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? updater(t) : t)));
  };

  const runAutonomous = async () => {
    if (!persona || runningThreadId || !activeThread) return;
    setRunningThreadId(activeThread.id);
    let runningMessages = [...activeThread.messages];

    try {
      for (let i = 0; i < MAX_TURNS; i++) {
        const lastPersonaMessage =
          [...runningMessages].reverse().find((m) => m.role === "persona")?.content ||
          INITIAL_PERSONA_MESSAGE;

        const response = await fetch("/api/proxy-dialogue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "auto",
            persona,
            personaMessage: lastPersonaMessage,
            history: runningMessages.filter((m) => m.role === "persona" || m.role === "proxy"),
          }),
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        const proxyMessage = data?.proxyMessage || "";
        const personaReply = data?.personaReply || "";

        runningMessages = [...runningMessages, { role: "proxy", content: proxyMessage }];
        updateThread(activeThread.id, (thread) => ({
          ...thread,
          messages: [...runningMessages],
        }));
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 50));
        runningMessages = [...runningMessages, { role: "persona", content: personaReply }];
        updateThread(activeThread.id, (thread) => ({
          ...thread,
          messages: [...runningMessages],
        }));
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    } catch (err) {
      console.error("Autonomous dialogue failed", err);
      updateThread(activeThread.id, (thread) => ({
        ...thread,
        messages: [
          ...thread.messages,
          { role: "assistant", content: "The autonomous dialogue stopped due to an error." },
        ],
      }));
    } finally {
      setRunningThreadId(null);
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
              <div className="thread-meta">Persona: Mother / 어머니</div>
            </div>
          ))}
        </div>
      </aside>

      <main className="chat-main">
        <h1 className="title">Your Proxy Talks for You / 프록시가 당신을 대신해 대화</h1>
        <p className="subtitle">
          Scenario: talking to your mother about the family pet who has just passed away
          <br/>시나리오: 가족 반려동물의 마지막 소식에 대해 당신과 어머니가 대화합니다.
        </p>

        <div className="messages">
          {activeThread?.messages.map((message, idx) => (
            <div key={idx} className={`bubble ${message.role}`}>
              <span className="muted" style={{ display: "block", marginBottom: 6 }}>
                {message.role === "proxy"
                  ? "Proxy / 프록시"
                  : message.role === "persona"
                  ? "Mother / 어머니"
                  : "System"}
              </span>
              {message.content}
            </div>
          ))}
          {runningThreadId === activeThreadId && <div className="bubble assistant muted">...</div>}
        </div>

        <div className="chat-action-bar">
          <button
            className="primary-button"
            onClick={runAutonomous}
            disabled={runningThreadId === activeThreadId || (activeThread?.messages.length || 0) > 1}
          >
            {runningThreadId === activeThreadId
              ? "Offloading... / 진행 중..."
              : (activeThread?.messages.length || 0) > 1
              ? "Completed / 완료"
              : "Offload conversation / 대화 맡기기"}
          </button>
        </div>
      </main>
    </div>
  );
}
