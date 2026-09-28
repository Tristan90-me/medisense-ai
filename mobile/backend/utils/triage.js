// Independent, rule-based red-flag detection — deliberately NOT derived from
// the LLM's own output, so it can catch a case where Gemini's severity
// scoring under-calls something dangerous. Rules are sourced directly from
// MEDISENSE_SYSTEM_PROMPT's "EMERGENCY DETECTION" list (see utils/gemini.js)
// so both systems are checking for the exact same red flags — this also
// doubles as the structured data Phase 7's admin-editable keyword list will
// build on, instead of that list only existing as prose inside the prompt.
//
// Matching runs against the LOWERCASED, JOINED names of a session's already
// extracted `symptoms` (Session.symptoms: [{name, duration, onset}]) — not
// the raw conversation text. That keeps this a pure, cheaply-testable
// function with no knowledge of message history, at the cost of only
// catching red flags that made it into the LLM's own symptom extraction.
// Given the extraction step already runs on every turn, this is an
// acceptable trade for a same-turn cross-check of the LLM's severity call.
const TRIAGE_RULES = [
  {
    id: 'chest_pain_cardiac',
    label: 'Chest pain with arm/jaw pain or shortness of breath',
    match: (text) =>
      text.includes('chest pain') &&
      ['arm pain', 'jaw pain', 'shortness of breath', 'difficulty breathing'].some((k) => text.includes(k)),
  },
  {
    id: 'thunderclap_headache',
    label: 'Sudden, severe ("worst of my life") headache',
    match: (text) =>
      text.includes('worst headache') ||
      (text.includes('headache') && text.includes('sudden') && text.includes('severe')),
  },
  {
    id: 'breathing_difficulty',
    label: 'Difficulty breathing or choking',
    match: (text) =>
      ['difficulty breathing', 'trouble breathing', "can't breathe", 'cannot breathe', 'choking', 'shortness of breath', 'gasping for air']
        .some((k) => text.includes(k)),
  },
  {
    id: 'stroke_signs',
    label: 'Signs of stroke (face drooping, arm weakness, speech difficulty)',
    match: (text) =>
      ['face drooping', 'facial droop', 'arm weakness', 'slurred speech', 'speech difficulty', 'one-sided weakness', 'one sided weakness']
        .some((k) => text.includes(k)),
  },
  {
    id: 'uncontrolled_bleeding',
    label: 'Uncontrolled bleeding',
    match: (text) =>
      ['uncontrolled bleeding', 'heavy bleeding', "won't stop bleeding", 'wont stop bleeding', 'hemorrhage', 'haemorrhage']
        .some((k) => text.includes(k)),
  },
  {
    id: 'loss_of_consciousness',
    label: 'Loss of consciousness or fainting',
    match: (text) =>
      ['loss of consciousness', 'fainted', 'fainting', 'passed out', 'unconscious', 'blacked out']
        .some((k) => text.includes(k)),
  },
  {
    id: 'severe_allergic_reaction',
    label: 'Severe allergic reaction (throat swelling, hives + breathing issues)',
    match: (text) =>
      (text.includes('throat swelling') || text.includes('hives')) &&
      (text.includes('breathing') || text.includes('shortness of breath')),
  },
  {
    id: 'suicidal_ideation',
    label: 'Suicidal ideation or self-harm intent',
    match: (text) =>
      ['suicidal', 'suicide', 'self-harm', 'self harm', 'kill myself', 'end my life', 'want to die']
        .some((k) => text.includes(k)),
  },
];

const CARDIAC_RISK_TERMS = ['heart disease', 'cardiac', 'hypertension', 'high blood pressure', 'coronary'];

/**
 * Independently re-derives an emergency signal from a session's extracted
 * symptoms, for cross-checking against the LLM's own severity/emergency
 * output. Pure function — no I/O, safe to unit test exhaustively.
 *
 * @param {Array<{name: string}>} symptoms - Session.symptoms
 * @param {object|null} healthProfile - used only as a risk-adjustment factor
 * @param {string[]} [extraKeywords] - admin-supplied keyword strings (see
 *   models/SystemSetting.js's 'emergencyKeywords' key) checked as plain
 *   case-insensitive substring matches against the same symptom text as the
 *   built-in rules. Deliberately a plain array, NOT a DB lookup done here —
 *   this function stays pure/DB-free; the caller (controllers/aiController.js)
 *   is responsible for loading the setting and passing its value in. Default
 *   `[]` preserves 100% of prior behavior when omitted.
 * @returns {{level: 'Low'|'Critical', score: number, matchedRules: string[]}}
 */
const computeTriageScore = (symptoms = [], healthProfile = null, extraKeywords = []) => {
  const text = symptoms.map((s) => (s?.name || '').toLowerCase()).join(' | ');
  const matchedRules = TRIAGE_RULES.filter((rule) => rule.match(text)).map((rule) => rule.id);

  // Risk adjustment: a history of cardiac-relevant conditions lowers the bar
  // for the chest-pain rule — chest pain alone (without the compound
  // arm/jaw-pain-or-breathlessness requirement) is still flagged for someone
  // with that history, since it's a materially higher-risk presentation.
  const hasCardiacHistory = (healthProfile?.preExistingConditions || [])
    .some((c) => CARDIAC_RISK_TERMS.some((term) => c.toLowerCase().includes(term)));
  if (hasCardiacHistory && text.includes('chest pain') && !matchedRules.includes('chest_pain_cardiac')) {
    matchedRules.push('chest_pain_cardiac_risk_factor');
  }

  // Admin-editable custom keywords — same substring-match approach as the
  // hardcoded rules above, just data-driven instead of code-driven.
  (extraKeywords || []).forEach((keyword) => {
    const normalized = (keyword || '').toLowerCase().trim();
    if (normalized && text.includes(normalized)) {
      matchedRules.push(`custom:${keyword}`);
    }
  });

  if (matchedRules.length > 0) {
    return { level: 'Critical', score: 10, matchedRules };
  }
  return { level: 'Low', score: 0, matchedRules: [] };
};

module.exports = { computeTriageScore, TRIAGE_RULES };
