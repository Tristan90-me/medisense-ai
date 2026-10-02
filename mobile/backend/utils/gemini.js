const { GoogleGenAI } = require("@google/genai");
const SystemSetting = require("../models/SystemSetting");

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
// `promptOverride`, if given, short-circuits BEFORE the SystemSetting lookup
// entirely — used by systemSettingController.previewPrompt to let an admin
// see how a DRAFT (unsaved) prompt behaves without ever persisting it.
// Otherwise falls back to the admin-saved 'systemPrompt' SystemSetting (if
// any), then to the hardcoded MEDISENSE_SYSTEM_PROMPT default.
const buildSystemPrompt = async (healthProfile, promptOverride = null) => {
  let systemPrompt = promptOverride;
  if (!systemPrompt) {
    const saved = await SystemSetting.findOne({ key: 'systemPrompt' });
    systemPrompt = saved?.value || MEDISENSE_SYSTEM_PROMPT;
  }

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
// `promptOverride` (optional, trailing) is passed straight through to
// buildSystemPrompt — see its comment above. All existing call sites that
// don't pass it are unaffected.
const chat = async (history, healthProfile = null, promptOverride = null) => {
  const messages = buildMessages(history);

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: messages,
    config: {
      systemInstruction: await buildSystemPrompt(healthProfile, promptOverride),
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
const chatStream = async (history, healthProfile, onChunk, promptOverride = null) => {
  const messages = buildMessages(history);

  const stream = await ai.models.generateContentStream({
    model: "gemini-3.5-flash-lite",
    contents: messages,
    config: {
      systemInstruction: await buildSystemPrompt(healthProfile, promptOverride),
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

// ─── Photo Analysis ─────────────────────────────────────────────────────────
// Descriptive (NOT diagnostic) visual observation of a symptom photo (rash,
// wound, swelling, etc). Uses Gemini's structured-output mechanism
// (responseMimeType + responseSchema) rather than the bracket-tag convention
// above — this call is non-streaming, so there's no reason to reuse that
// text-splicing approach here.
const PHOTO_ANALYSIS_PROMPT = `
You are looking at a photo a user has logged of a physical symptom (e.g. a rash, wound, bruise, swelling, or skin change) as part of a personal symptom-tracking app.

Provide a DESCRIPTIVE VISUAL OBSERVATION ONLY. This is explicitly NOT a diagnosis:
- Never state or imply a specific medical condition, disease name, or diagnosis.
- Only describe what is visually observable (color, shape, size relative to surrounding area, texture, borders, any visible discharge/swelling/bruising, etc).
- Use hedged, plain language ("appears to be", "the image shows").

Respond with:
- "description": a short plain-language paragraph describing what the image shows.
- "findings": an array of specific, individual visual observations (e.g. "Redness covering approximately 3cm diameter", "Raised, well-defined border").
- "confidence": how clearly the image supports these findings — "low" (blurry, poor lighting, partially obscured), "moderate", or "high" (clear, well-lit, in focus).
- "flaggedForReview": true if the image shows visual signs that may warrant prompt in-person medical attention — spreading redness, signs of infection (pus, red streaking), a deep or non-healing wound, significant swelling, or any other visually concerning feature. Otherwise false.
`;

const PHOTO_ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    description: { type: 'STRING' },
    findings: { type: 'ARRAY', items: { type: 'STRING' } },
    confidence: { type: 'STRING', enum: ['low', 'moderate', 'high'] },
    flaggedForReview: { type: 'BOOLEAN' },
  },
  required: ['description', 'findings', 'confidence', 'flaggedForReview'],
};

// context is an optional caller-supplied string (e.g. the photo's caption or
// body region) appended to the prompt to give the model a little more to go on.
const analyzePhoto = async (imageBuffer, mimeType, context = '') => {
  const promptText = context
    ? `${PHOTO_ANALYSIS_PROMPT}\n\nAdditional context provided by the user: ${context}`
    : PHOTO_ANALYSIS_PROMPT;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [{
      role: "user",
      parts: [
        { text: promptText },
        { inlineData: { data: imageBuffer.toString("base64"), mimeType } },
      ],
    }],
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: PHOTO_ANALYSIS_SCHEMA,
    },
  });

  return JSON.parse(response.text);
};

// ─── Meal Photo Analysis ────────────────────────────────────────────────────
// Same structured-output mechanism as analyzePhoto, but food-focused: a
// rough nutrition ESTIMATE meant to prefill a manual food log, not a
// precise measurement (there's no barcode/database match to ground it in,
// unlike utils/foodApi.js's OFF/USDA lookups) — every value stays editable
// by the user before saving.
const MEAL_ANALYSIS_PROMPT = `
You are looking at a photo of a meal or food item logged in a nutrition-tracking app.

Identify the foods visible and estimate their combined nutrition. This is a rough ESTIMATE meant to speed up manual logging, not a precise measurement — the user can and should adjust every value before saving.

Respond with:
- "description": a short plain-language description of what's in the photo.
- "identifiedFoods": an array of the distinct foods you can identify (e.g. "grilled chicken breast", "steamed broccoli", "white rice").
- "estimatedNutrition": your best estimate of the whole plate's calories, carbsG, proteinG, fatG.
- "confidence": "low" (hard to identify portions/foods), "moderate", or "high" (clear photo, common foods, standard portions).
`;

const MEAL_ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    description: { type: 'STRING' },
    identifiedFoods: { type: 'ARRAY', items: { type: 'STRING' } },
    estimatedNutrition: {
      type: 'OBJECT',
      properties: {
        calories: { type: 'NUMBER' },
        carbsG: { type: 'NUMBER' },
        proteinG: { type: 'NUMBER' },
        fatG: { type: 'NUMBER' },
      },
      required: ['calories', 'carbsG', 'proteinG', 'fatG'],
    },
    confidence: { type: 'STRING', enum: ['low', 'moderate', 'high'] },
  },
  required: ['description', 'identifiedFoods', 'estimatedNutrition', 'confidence'],
};

const analyzeMeal = async (imageBuffer, mimeType, context = '') => {
  const promptText = context
    ? `${MEAL_ANALYSIS_PROMPT}\n\nAdditional context provided by the user: ${context}`
    : MEAL_ANALYSIS_PROMPT;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [{
      role: "user",
      parts: [
        { text: promptText },
        { inlineData: { data: imageBuffer.toString("base64"), mimeType } },
      ],
    }],
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: MEAL_ANALYSIS_SCHEMA,
    },
  });

  return JSON.parse(response.text);
};

// ─── Fitness/Nutrition Suggestions ──────────────────────────────────────────
// Plain-text, single-suggestion completion (no bracket tags, no JSON — same
// shape as generateSummary) grounded in the day's Daily Energy Ledger (see
// utils/dailyEnergyLedger.js). Deliberately a separate, narrower system
// prompt from MEDISENSE_SYSTEM_PROMPT rather than reusing it — this is a
// wellness suggestion, not a symptom-check turn, and must not drift into
// diagnostic territory just because it shares a model/client.
const SUGGESTION_SYSTEM_PROMPT = `
You are MediSense AI's nutrition and fitness assistant, part of a health app that also does AI-assisted symptom checking. For THIS response, stay strictly in the nutrition/fitness domain — do not diagnose or discuss symptoms.

Voice: warm, clear, reassuring without minimizing, honest about limits. Never say "you definitely need X" or use "cure"/"guaranteed" language — this is a suggestion, not a prescription. Never say "don't worry"; if relevant, say what the numbers suggest instead.

Give ONE short, practical, encouraging suggestion (2-3 sentences max) based on the person's day so far. No extreme calorie or macro recommendations. No markdown, no bullet points, no emoji — plain conversational text.
`;

// `ledger` is the object returned by utils/dailyEnergyLedger.js's
// buildLedger. `kind` picks which side of the day's numbers to suggest for.
const suggestFromEnergyContext = async (ledger, kind = 'meal') => {
  const summary = `
Today so far:
- Calories consumed: ${ledger.consumed}
- Calories burned (steps + workouts): ${ledger.burnedTotal}
- Net calorie balance: ${ledger.net > 0 ? "+" : ""}${ledger.net}
- Daily calorie budget: ${ledger.budget ?? "not set"}
- Calories remaining: ${ledger.remaining ?? "unknown"}
`;
  const ask = kind === "workout"
    ? "Based on this, suggest what kind of workout (or rest) would make sense for the rest of today."
    : "Based on this, suggest what kind of meal or snack would make sense next.";

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [{ role: "user", parts: [{ text: `${summary}\n${ask}` }] }],
    config: {
      systemInstruction: SUGGESTION_SYSTEM_PROMPT,
      temperature: 0.5,
      maxOutputTokens: 200,
    },
  });

  return response.text.trim();
};

// ─── Daily Tip ───────────────────────────────────────────────────────────────
// Not personalized to any one user's data — a light, rotating wellness tip
// for the dashboard. Higher temperature than the rest of this file on
// purpose: this is meant to feel fresh on repeat calls, where the other
// functions above intentionally favor consistency.
const DAILY_TIP_PROMPT = `
Write ONE short, warm, practical daily health tip (1-2 sentences) for a general audience using a health, fitness, and nutrition tracking app. Rotate across categories across calls: hydration, sleep, movement, nutrition, mindfulness, or recovery — pick one at random each time.

No medical claims, no "cure"/"guaranteed" language, no markdown, no emoji, plain conversational text. Avoid generic phrasing like "stay hydrated" verbatim — be specific and a little unexpected while staying simple.
`;

const dailyTip = async () => {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [{ role: "user", parts: [{ text: DAILY_TIP_PROMPT }] }],
    config: {
      temperature: 0.9,
      maxOutputTokens: 100,
    },
  });

  return response.text.trim();
};

module.exports = {
  chat, chatStream, generateSummary, parseAIResponse, analyzePhoto, MEDISENSE_SYSTEM_PROMPT,
  analyzeMeal, suggestFromEnergyContext, dailyTip,
};