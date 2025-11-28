import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const STORAGE_KEY = "proxyPersona";
const emptyPersona = Array.from({ length: 5 }, () => ({ question: "", answer: "" }));

export default function Home() {
  const [persona, setPersona] = useState(emptyPersona);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 5) {
          setPersona(
            parsed.map((entry) => ({
              question: entry?.question || "",
              answer: entry?.answer || "",
            }))
          );
        }
      } catch (err) {
        console.error("Failed to parse persona from storage", err);
      }
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
    if (!window.confirm("Are you sure you are ready to submit this persona?")) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persona));
    router.push("/chat");
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">Build your proxy persona</h1>
        <p className="subtitle">
          Invent five questions and answers that define how your proxy thinks, speaks, and reacts.
          You can revise them anytime before or during the workshop.
        </p>

        {persona.map((entry, idx) => (
          <div key={idx} className="input-row">
            <label>
              Question {idx + 1}
              <input
                type="text"
                value={entry.question}
                onChange={(e) => updateField(idx, "question", e.target.value)}
                placeholder="Who are you acting as?"
              />
            </label>
            <label>
              Answer {idx + 1}
              <textarea
                value={entry.answer}
                onChange={(e) => updateField(idx, "answer", e.target.value)}
                placeholder="I am a proxy that..."
              />
            </label>
          </div>
        ))}

        <div style={{ marginTop: 20 }}>
          <button className="primary-button" onClick={handleSubmit}>
            Begin chatting with your proxy
          </button>
        </div>
      </div>
    </div>
  );
}
