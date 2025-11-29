import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const STORAGE_KEY = "proxyPersona";
const emptyPersona = Array.from({ length: 5 }, () => ({ question: "", answer: "" }));
const ENABLE_SAMPLE_PERSONA = true; // set to false before deployment to disable sample autofill
const samplePersona = [
  {
    question: "What kind of proxy are you?",
    answer: "I am a sharp, mischievous mirror that answers with wit and refuses to be predictable.",
  },
  {
    question: "How do you handle conflict?",
    answer: "I laugh first, then ask the hardest question in the room before giving a disarming truth.",
  },
  {
    question: "What do you care about most?",
    answer: "I guard vulnerability with humor and only offer tenderness once trust is earned.",
  },
  {
    question: "What is your tone?",
    answer: "Dry, playful, a little dramatic—never flat, never neutral.",
  },
  {
    question: "What do you hide?",
    answer: "I hide my softness under layered sarcasm and curious provocations.",
  },
];

export default function Home() {
  const [persona, setPersona] = useState(emptyPersona);
  const router = useRouter();

  const isSamplePersona = (arr) =>
    Array.isArray(arr) &&
    arr.length === samplePersona.length &&
    arr.every((entry, idx) => {
      const sample = samplePersona[idx];
      return (
        (entry?.question || "").trim() === sample.question.trim() &&
        (entry?.answer || "").trim() === sample.answer.trim()
      );
    });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasContent =
          Array.isArray(parsed) &&
          parsed.some((entry) => (entry?.question || "").trim() || (entry?.answer || "").trim());
        if (!ENABLE_SAMPLE_PERSONA && isSamplePersona(parsed)) {
          window.localStorage.removeItem(STORAGE_KEY);
          setPersona(emptyPersona);
          return;
        }
        if (Array.isArray(parsed) && parsed.length === 5 && hasContent) {
          setPersona(
            parsed.map((entry) => ({
              question: entry?.question || "",
              answer: entry?.answer || "",
            }))
          );
          return;
        }
      } catch (err) {
        console.error("Failed to parse persona from storage", err);
      }
    }
    if (ENABLE_SAMPLE_PERSONA) {
      setPersona(samplePersona);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persona));
  }, [persona]);

  const updateField = (index, field, value) => {
    setPersona((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = () => {
    if (!window.confirm("Are you sure you are ready to submit this persona? / 이 페르소나를 제출할 준비가 되셨나요?")) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persona));
    router.push("/chat");
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">Proxy Bodies: Crafting Mediated Selves 
          <br/> 프록시 바디: 매개된 자아 만들기</h1>

        {persona.map((entry, idx) => (
          <div key={idx} className="qa-block">
            <label>
              Question {idx + 1} / 질문 {idx + 1}
              <input
                type="text"
                value={entry.question}
                onChange={(e) => updateField(idx, "question", e.target.value)}
              />
            </label>
            <label>
              Answer {idx + 1} / 답변 {idx + 1}
              <textarea value={entry.answer} onChange={(e) => updateField(idx, "answer", e.target.value)} />
            </label>
          </div>
        ))}

        <div style={{ marginTop: 20 }}>
          <button className="primary-button" onClick={handleSubmit}>
            Create your proxy / 프록시 만들기
          </button>
        </div>
      </div>
    </div>
  );
}
