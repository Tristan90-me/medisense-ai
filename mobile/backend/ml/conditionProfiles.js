// Hand-curated symptom-condition knowledge base — the "training data source"
// for the ML classifier (see train.js). Chosen deliberately over an imported
// public dataset (e.g. Kaggle's "Disease Symptom Prediction") for a few
// reasons specific to a project that has to be defended in a viva:
//   1. Full provenance — every association here is a well-known, textbook-
//      level symptom pattern for common conditions, not an opaque CSV of
//      unknown quality/labeling.
//   2. No external download/licensing dependency — this file, train.js, and
//      the resulting model.json are 100% self-contained and reproducible.
//   3. Directly explainable: "here is the exact knowledge base the model was
//      trained from" is a much stronger answer in a defense than "I don't
//      know how this row was labeled."
//
// This is explicitly NOT a diagnostic reference — probabilities are rough,
// illustrative estimates of how often a symptom co-occurs with a condition,
// tuned only to produce a reasonable-looking classifier for demonstration.
// See the disclaimer surfaced everywhere this classifier's output is shown.
//
// Each condition lists symptoms as { symptom: probability }, where
// probability is how likely a real case of that condition presents with
// that symptom (used by train.js to generate synthetic labeled records).
// `symptom` keys must exactly match an entry in SYMPTOM_VOCABULARY below —
// train.js validates this at load time and throws if any profile references
// an undefined symptom, so a typo can never silently produce a dead feature.

const SYMPTOM_VOCABULARY = [
  // General
  'fever', 'fatigue', 'chills', 'body aches', 'sweating', 'weight loss', 'loss of appetite',
  // Head / neurological
  'headache', 'dizziness', 'sensitivity to light', 'sensitivity to sound', 'blurred vision', 'confusion',
  // ENT
  'sore throat', 'runny nose', 'nasal congestion', 'sneezing', 'ear pain', 'hearing loss',
  'loss of smell', 'loss of taste', 'facial pain', 'swollen lymph nodes', 'difficulty swallowing',
  // Respiratory
  'cough', 'shortness of breath', 'wheezing', 'chest tightness', 'chest congestion', 'chest pain',
  // Cardiac
  'rapid heartbeat', 'palpitations',
  // Gastrointestinal
  'nausea', 'vomiting', 'diarrhea', 'abdominal pain', 'abdominal cramps', 'heartburn',
  'regurgitation', 'constipation', 'bloating',
  // Urinary
  'burning urination', 'frequent urination', 'pelvic pain',
  // Skin
  'rash', 'itchy skin', 'redness', 'dry patches', 'hives', 'swelling',
  // Musculoskeletal
  'joint pain', 'muscle pain', 'back pain', 'stiffness', 'limited range of motion',
  // Psychological / sleep
  'anxiety', 'restlessness', 'irritability', 'difficulty sleeping', 'difficulty concentrating',
  // Eyes
  'red eyes', 'itchy eyes', 'eye discharge', 'tearing',
  // Other
  'dry mouth', 'thirst', 'pale skin',
];

const CONDITION_PROFILES = {
  'Common Cold': {
    'runny nose': 0.85, 'sneezing': 0.75, 'sore throat': 0.7, 'cough': 0.6,
    'nasal congestion': 0.8, 'fatigue': 0.4, 'fever': 0.2,
  },
  'Influenza': {
    fever: 0.9, 'body aches': 0.85, fatigue: 0.8, cough: 0.7, chills: 0.7, headache: 0.5, 'sore throat': 0.4,
  },
  Migraine: {
    headache: 0.95, nausea: 0.6, 'sensitivity to light': 0.75, 'sensitivity to sound': 0.6, 'blurred vision': 0.3, dizziness: 0.3,
  },
  'Tension Headache': {
    headache: 0.9, 'muscle pain': 0.4, stiffness: 0.35, fatigue: 0.3, 'difficulty concentrating': 0.3,
  },
  Gastroenteritis: {
    nausea: 0.85, vomiting: 0.7, diarrhea: 0.8, 'abdominal pain': 0.65, 'abdominal cramps': 0.6, fever: 0.3,
  },
  'Food Poisoning': {
    nausea: 0.8, vomiting: 0.75, diarrhea: 0.75, 'abdominal cramps': 0.7, fever: 0.2, fatigue: 0.3,
  },
  'Urinary Tract Infection': {
    'burning urination': 0.85, 'frequent urination': 0.8, 'pelvic pain': 0.55, fever: 0.2,
  },
  'Allergic Rhinitis': {
    sneezing: 0.8, 'runny nose': 0.75, 'itchy eyes': 0.6, 'nasal congestion': 0.7, 'red eyes': 0.3, tearing: 0.3,
  },
  Bronchitis: {
    cough: 0.9, 'chest congestion': 0.7, fatigue: 0.5, fever: 0.3, 'shortness of breath': 0.3,
  },
  Sinusitis: {
    'facial pain': 0.7, 'nasal congestion': 0.8, headache: 0.55, fatigue: 0.3, 'loss of smell': 0.25,
  },
  Conjunctivitis: {
    'red eyes': 0.85, 'itchy eyes': 0.7, 'eye discharge': 0.65, tearing: 0.5,
  },
  'Strep Throat': {
    'sore throat': 0.9, fever: 0.6, 'swollen lymph nodes': 0.55, 'difficulty swallowing': 0.5,
  },
  'Asthma Exacerbation': {
    'shortness of breath': 0.85, wheezing: 0.75, 'chest tightness': 0.65, cough: 0.4,
  },
  'Anxiety Episode': {
    anxiety: 0.9, 'rapid heartbeat': 0.6, sweating: 0.5, restlessness: 0.55, 'shortness of breath': 0.35,
  },
  Dehydration: {
    thirst: 0.8, dizziness: 0.55, 'dry mouth': 0.7, fatigue: 0.5, headache: 0.25,
  },
  'Muscle Strain': {
    'muscle pain': 0.85, swelling: 0.4, 'limited range of motion': 0.55, 'back pain': 0.3,
  },
  Eczema: {
    'itchy skin': 0.85, redness: 0.6, 'dry patches': 0.7, rash: 0.4,
  },
  Insomnia: {
    'difficulty sleeping': 0.9, fatigue: 0.6, irritability: 0.45, 'difficulty concentrating': 0.4,
  },
  'GERD (Acid Reflux)': {
    heartburn: 0.85, regurgitation: 0.6, 'chest pain': 0.3, bloating: 0.3,
  },
  'Iron Deficiency Anemia': {
    fatigue: 0.8, 'pale skin': 0.55, 'shortness of breath': 0.4, dizziness: 0.4,
  },
  'Ear Infection': {
    'ear pain': 0.85, 'hearing loss': 0.4, fever: 0.35, dizziness: 0.2,
  },
  'Contact Dermatitis': {
    'itchy skin': 0.8, redness: 0.7, rash: 0.55, swelling: 0.25,
  },
};

// Validate every profiled symptom actually exists in the vocabulary — a
// typo here would otherwise silently create a dead/no-op feature.
const vocabSet = new Set(SYMPTOM_VOCABULARY);
for (const [condition, symptoms] of Object.entries(CONDITION_PROFILES)) {
  for (const symptom of Object.keys(symptoms)) {
    if (!vocabSet.has(symptom)) {
      throw new Error(`conditionProfiles.js: "${condition}" references unknown symptom "${symptom}" — add it to SYMPTOM_VOCABULARY or fix the typo.`);
    }
  }
}

module.exports = { SYMPTOM_VOCABULARY, CONDITION_PROFILES };
