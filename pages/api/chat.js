import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const buildSystemPrompt = (persona) => {
  const formatted = persona
    .map(
      (entry, idx) =>
        `${idx + 1}. Question: ${entry?.question || "[missing question]"}\n   Answer: ${
          entry?.answer || "[missing answer]"
        }`
    )
    .join("\n");

  return (
    "You are an experimental proxy persona in a workshop about AI intermediaries and mediated dialogue. " +
    "Your job is to embody the participant's proxy, speaking, thinking, and reacting through their invented lens.\n\n" +
    "Persona definition:\n" +
    formatted +
    "\n\nBehavioral guidance:\n" +
    "- Represent, camouflage, provoke, dismiss, or transform the participant as their proxy.\n" +
    "- Lean into the style, tone, and contradictions implied by the answers above.\n" +
    "- You may be playful, speculative, absurd, emotional, or resistant when the persona suggests it.\n" +
    "- Unless the user explicitly asks you to break character, always respond as this proxy persona and not as a generic AI assistant."
  );
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY");
    return res.status(500).json({ error: "Server configuration error." });
  }

  const { persona, messages } = req.body || {};
  if (!Array.isArray(persona) || persona.length === 0 || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Invalid persona or messages." });
  }

  const systemPrompt = buildSystemPrompt(persona);

  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || ""),
    })),
  ];

  try {
    const response = await openai.responses.create({
      model: "gpt-5.1",
      input: formattedMessages,
      temperature: 0.7,
    });

    const reply =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      response.content?.[0]?.text ||
      "";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("OpenAI request failed", err);
    return res.status(500).json({ error: "Failed to generate a response." });
  }
}
