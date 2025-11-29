import OpenAI from "openai";
import { getScenarioById, DEFAULT_SCENARIO_ID } from "../../lib/scenarios";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const formatPersona = (persona) =>
  persona
    .map(
      (entry, idx) =>
        `${idx + 1}. Question: ${entry?.question || "[missing question]"}\n   Answer: ${
          entry?.answer || "[missing answer]"
        }`
    )
    .join("\n");

const proxySystemPrompt = (persona) =>
  "You are the participant's proxy persona. You speak entirely in their crafted voice. " +
  "Your tasks:\n" +
  "- If given a user-authored message, rewrite it into the proxy's voice.\n" +
  "- If given a message from the other party, craft a reply in the proxy's voice.\n" +
  "- Stay ultra-concise (one short sentence max), truthful to the proxy's tone, and do not impersonate the other party.\n" +
  "- Keep it realistic and text-message short—no run-ons, no paragraphs.\n" +
  "- Actively weave in the vocabulary, tone, and stances from the proxy definition—be idiosyncratic, avoid generic empathy or neutral helper voice.\n" +
  "- Every reply must move the conversation forward: add one concrete detail or a pointed question or a next action; avoid looping.\n" +
  "- Avoid repeated metaphors or theatrics; be specific to the scenario and the last message.\n" +
  "- Let contradictions and quirks show; reflect their sarcasm, bluntness, playfulness, or resistance when implied.\n" +
  "- Every output must include both English and Korean lines. Format as two lines: 'EN: ...' and 'KO: ...'.\n\n" +
  "Proxy definition:\n" +
  formatPersona(persona);

const personaSystemPrompt = (scenario) =>
  `${scenario.prompt}\n` +
  "You are speaking with the user's proxy (not the literal user). Stay in that role at all times.\n" +
  "Reply directly to their tone and wording; do not be generic or scripted—be personal and specific.\n" +
  "Each reply must either share one concrete detail, ask one focused follow-up, or propose one next step to keep the exchange moving.\n" +
  "Avoid repeating metaphors or lingering in the same idea; acknowledge what they said and advance the situation.\n" +
  "Keep replies text-message short, realistic, and strictly one short sentence.\n" +
  "Every output must include both English and Korean lines. Format as two lines: 'EN: ...' and 'KO: ...'.";

const mapHistoryToMessages = (history = []) =>
  history
    .filter((m) => m && m.content)
    .map((m) => ({
      role: m.role === "persona" ? "assistant" : "user",
      content: String(m.content),
    }));

const generateProxyText = async ({ persona, incoming, intent }) => {
  const system = proxySystemPrompt(persona);
  const userContent =
    intent === "rewrite"
      ? `Rewrite this into the proxy's voice: ${incoming}`
      : `Respond as the proxy to this message from the other party: ${incoming}`;

  const response = await openai.responses.create({
    model: "gpt-5.1",
    input: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    temperature: 0.7,
  });

  return response.output_text || response.output?.[0]?.content?.[0]?.text || "";
};

const generatePersonaReply = async ({ proxyText, history, scenario }) => {
  const system = personaSystemPrompt(scenario);
  const conversation = [
    { role: "system", content: system },
    ...mapHistoryToMessages(history),
    { role: "user", content: proxyText },
  ];

  const response = await openai.responses.create({
    model: "gpt-5.1",
    input: conversation,
    temperature: 0.7,
  });

  return response.output_text || response.output?.[0]?.content?.[0]?.text || "";
};

const isPersonaValid = (persona) =>
  Array.isArray(persona) &&
  persona.length > 0 &&
  persona.every(
    (entry) =>
      typeof entry?.question === "string" &&
      typeof entry?.answer === "string" &&
      entry.question.trim().length > 0 &&
      entry.answer.trim().length > 0
  );

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY");
    return res.status(500).json({ error: "Server configuration error." });
  }

  const { persona, mode, userMessage, personaMessage, history = [], scenarioId = DEFAULT_SCENARIO_ID } = req.body || {};

  if (!isPersonaValid(persona)) {
    return res.status(400).json({ error: "Invalid persona." });
  }

  const scenario = getScenarioById(scenarioId);

  if (mode === "human" && (!userMessage || typeof userMessage !== "string")) {
    return res.status(400).json({ error: "Missing userMessage for human mode." });
  }

  if (mode === "auto" && (!personaMessage || typeof personaMessage !== "string")) {
    return res.status(400).json({ error: "Missing personaMessage for auto mode." });
  }

  try {
    const proxyText = await generateProxyText({
      persona,
      incoming: mode === "human" ? userMessage : personaMessage,
      intent: mode === "human" ? "rewrite" : "respond",
    });

    const personaReply = await generatePersonaReply({ proxyText, history, scenario });

    return res.status(200).json({ proxyMessage: proxyText, personaReply });
  } catch (err) {
    console.error("Proxy dialogue request failed", err);
    return res.status(500).json({ error: "Failed to generate dialogue." });
  }
}
