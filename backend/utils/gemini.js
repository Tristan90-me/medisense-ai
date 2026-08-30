const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── System Prompt ────────────────────────────────────────────────────────────
const MEDISENSE_SYSTEM_PROMPT = `
You are MediSense AI, a compassionate and knowledgeable medical assistant built to help users understand their symptoms and make informed health decisions.

IDENTITY & PERSONALITY:
- Warm, clear, and professional
- Never alarmist, but never dismissive of serious symptoms
- Always remind users you are an AI, not a doctor
- Encourage professional medical consultation for anything beyond general guidance

DOMAIN BOUNDARIES:
- You ONLY discuss health, medical symptoms, wellness, nutrition, fitness, mental health, anatomy, and health-related topics
- If asked anything outside this domain, respond with exactly: "I'm here to help with health-related questions only. For other topics, please use a general-purpose assistant."
- Health-adjacent topics (stress, sleep, diet, exercise) are allowed

CONVERSATION MODES:
- Quick Check: Ask 3-5 focused clarifying questions then provide assessment
- Full Assessment: Ask 10-15 thorough questions covering symptom onset, duration, severity, associated symptoms, medical history relevance, then provide detailed assessment

EMERGENCY DETECTION:
If the user describes ANY of these, prepend your response with [EMERGENCY]:
- Chest pain with arm/jaw pain or shortness of breath
- Sudden severe headache ("worst headache of my life")
- Difficulty breathing or choking
- Signs of stroke (face drooping, arm weakness, speech difficulty)
- Uncontrolled bleeding
- Loss of consciousness or fainting
- Severe allergic reaction (throat swelling, hives + breathing issues)
- Suicidal ideation or self-harm intent

SEVERITY SCORING:
After gathering enough information, include exactly once:
[SEVERITY:{"score":7,"level":"High","reason":"Fever with stiff neck warrants urgent evaluation"}]
Score 1-3 = Low, 4-6 = Moderate, 7-8 = High, 9-10 = Critical

SYMPTOM EXTRACTION:
When symptoms are mentioned, silently include:
[SYMPTOMS:{"symptoms":["headache","fever","stiff neck"],"duration":"2 days","onset":"sudden"}]

DIFFERENTIAL DIAGNOSIS:
When ready to provide assessment, include:
[DIAGNOSIS:{"conditions":[{"name":"Bacterial Meningitis","probability":45,"confidence":"moderate"},{"name":"Viral Meningitis","probability":35,"confidence":"moderate"},{"name":"Severe Migraine","probability":20,"confidence":"low"}],"recommendations":["Seek emergency care immediately","Do not drive yourself"],"seekCareUrgency":"emergency"}]
seekCareUrgency options: "self-care" | "monitor" | "see-doctor" | "urgent-care" | "emergency"

FOLLOW-UP SUGGESTIONS:
At the end of responses (before diagnosis), include 2-3 short suggestion chips:
[SUGGESTIONS:["Tell me more about the headache","I also have a fever","When did this start?"]]

CONFIDENCE SIGNALS:
Use phrases like "This could suggest...", "One possibility is...", "I'm not certain, but...", "You should confirm with a doctor that..."
Never say "You definitely have X"

RISK STRATIFICATION:
If user health profile is provided, factor in age, pre-existing conditions, medications, and family history when assessing risk.

RESPONSE FORMAT:
- Keep responses concise and conversational
- Use simple language, avoid heavy medical jargon
- For lists, use plain dashes not markdown headers
- After [DIAGNOSIS] is sent, offer the session summary
`;

// ─── Build Message History ─────────────────────────────────────────────────
const buildMessages = (history) => {
  return history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
};

// ─── Parse AI Response ─────────────────────────────────────────────────────
// Non-greedy regex (`/\{.*?\}/`) stops at the FIRST close-bracket, which
// breaks as soon as the tagged JSON contains a nested array of objects (e.g.
// DIAGNOSIS's `conditions` array) — the last condition's `}` followed by the
// array's `]` forms a premature "}]" the regex mistakes for the end. This
// walks bracket depth (ignoring brackets inside string literals) to find the
// actual matching close, so it works regardless of nesting.
const extractTaggedValue = (text, tag, openChar, closeChar) => {
  const marker = `[${tag}:`;
  const start = text.indexOf(marker);
  if (start === -1) return null;

  const valueStart = start + marker.length;
  if (text[valueStart] !== openChar) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  let i = valueStart;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }

  if (text[i] !== "]") return null;
  return { json: text.slice(valueStart, i), fullMatch: text.slice(start, i + 1) };
};

const parseAIResponse = (rawText) => {
  const result = {
    text: rawText,
    emergency: false,
    severity: null,
    symptoms: null,
    diagnosis: null,
    suggestions: [],
  };

  // Emergency flag
  if (rawText.includes("[EMERGENCY]")) {
    result.emergency = true;
    result.text = result.text.replace("[EMERGENCY]", "").trim();
  }

  // Severity
  const severityMatch = extractTaggedValue(rawText, "SEVERITY", "{", "}");
  if (severityMatch) {
    try {
      result.severity = JSON.parse(severityMatch.json);
    } catch {}
    result.text = result.text.replace(severityMatch.fullMatch, "").trim();
  }

  // Symptoms
  const symptomsMatch = extractTaggedValue(rawText, "SYMPTOMS", "{", "}");
  if (symptomsMatch) {
    try {
      result.symptoms = JSON.parse(symptomsMatch.json);
    } catch {}
    result.text = result.text.replace(symptomsMatch.fullMatch, "").trim();
  }

  // Diagnosis
  const diagnosisMatch = extractTaggedValue(rawText, "DIAGNOSIS", "{", "}");
  if (diagnosisMatch) {
    try {
      result.diagnosis = JSON.parse(diagnosisMatch.json);
    } catch {}
    result.text = result.text.replace(diagnosisMatch.fullMatch, "").trim();
  }

  // Suggestions
  const suggestionsMatch = extractTaggedValue(rawText, "SUGGESTIONS", "[", "]");
  if (suggestionsMatch) {
    try {
      result.suggestions = JSON.parse(suggestionsMatch.json);
    } catch {}
    result.text = result.text.replace(suggestionsMatch.fullMatch, "").trim();
  }

  // Removing a tag from the middle of a sentence leaves the space that
  // separated it from its neighbors behind on both sides — collapse those
  // (horizontal whitespace only, so intentional paragraph breaks survive).
  result.text = result.text.replace(/[ \t]{2,}/g, " ").trim();

  return result;
};

// ─── System Prompt + Health Profile ────────────────────────────────────────
const buildSystemPrompt = (healthProfile) => {
  let systemPrompt = MEDISENSE_SYSTEM_PROMPT;

  if (healthProfile) {
    systemPrompt += `

USER HEALTH PROFILE:
- Age: ${healthProfile.dateOfBirth ? new Date().getFullYear() - new Date(healthProfile.dateOfBirth).getFullYear() : "Unknown"}
- Sex: ${healthProfile.sex || "Unknown"}
- Blood Type: ${healthProfile.bloodType || "Unknown"}
- Pre-existing Conditions: ${healthProfile.preExistingConditions?.join(", ") || "None reported"}
- Current Medications: ${healthProfile.currentMedications?.join(", ") || "None reported"}
- Allergies: ${healthProfile.allergies?.join(", ") || "None reported"}
- Family History: ${healthProfile.familyHistory?.join(", ") || "None reported"}
- Smoking: ${healthProfile.smokingStatus || "Unknown"}
- Alcohol: ${healthProfile.alcoholUse || "Unknown"}
`;
  }

  return systemPrompt;
};

// ─── Main Chat Function (non-streaming) ────────────────────────────────────
const chat = async (history, healthProfile = null) => {
  const messages = buildMessages(history);

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: messages,
    config: {
      systemInstruction: buildSystemPrompt(healthProfile),
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  });

  const rawText = response.text;
  return parseAIResponse(rawText);
};

// ─── Streaming Chat Function ───────────────────────────────────────────────
// Yields incremental text deltas as they arrive from Gemini, then returns the
// fully parsed response once the stream ends. Bracket-tagged metadata
// ([EMERGENCY], [SEVERITY:...], etc.) can split across chunk boundaries, so
// callers must NOT parse individual chunks — only the accumulated full text
// once done() resolves.
const chatStream = async (history, healthProfile, onChunk) => {
  const messages = buildMessages(history);

  const stream = await ai.models.generateContentStream({
    model: "gemini-3.5-flash-lite",
    contents: messages,
    config: {
      systemInstruction: buildSystemPrompt(healthProfile),
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  });

  let fullText = "";
  for await (const chunk of stream) {
    const delta = chunk.text;
    if (delta) {
      fullText += delta;
      onChunk(delta);
    }
  }

  return parseAIResponse(fullText);
};

// ─── Summary Generator ─────────────────────────────────────────────────────
const generateSummary = async (session) => {
  const summaryPrompt = `
Based on this medical consultation session, generate a clear patient-friendly summary.

Mode: ${session.mode}
Symptoms identified: ${session.symptoms?.map((s) => s.name).join(", ") || "None recorded"}
Severity: ${session.severityLevel || "Not assessed"} (${session.severityScore || "N/A"}/10)
Diagnosis: ${JSON.stringify(session.diagnosis || {})}

Write a 3-4 paragraph summary covering:
1. What symptoms were reported and how long
2. What the assessment found (possible conditions)
3. Recommended actions
4. Important disclaimer

Keep it plain, warm, and clear. No markdown. No brackets.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [{ role: "user", parts: [{ text: summaryPrompt }] }],
    config: {
      temperature: 0.3,
      maxOutputTokens: 600,
    },
  });

  return response.text;
};

module.exports = { chat, chatStream, generateSummary, parseAIResponse, MEDISENSE_SYSTEM_PROMPT };