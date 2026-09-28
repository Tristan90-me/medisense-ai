// In-process Bernoulli Naive Bayes inference — the third independent signal
// alongside the LLM's own severity/diagnosis (utils/gemini.js) and the
// rule-based triage layer (utils/triage.js, Phase 3). Loads the pre-trained
// model.json at require-time (see train.js) — no Python/ONNX/TF.js runtime,
// no second process, just arithmetic over two small probability tables, so
// there's nothing extra to keep alive for a live defense demo.
const fs = require('fs');
const path = require('path');

const model = JSON.parse(fs.readFileSync(path.join(__dirname, 'model.json'), 'utf8'));
const { vocabulary, conditions, priors, prob1 } = model;

// Same "match extracted symptom names as substrings" approach as
// utils/triage.js, for the same reason: the LLM's [SYMPTOMS:...] extraction
// produces free text ("runny nose", "chest pain"), not the classifier's
// exact vocabulary terms, so a vocabulary term is "present" whenever it
// appears as a substring of any extracted symptom name.
const extractFeatures = (symptoms = []) => {
  const text = symptoms.map((s) => (s?.name || '').toLowerCase()).join(' | ');
  const features = {};
  let matchedCount = 0;
  for (const term of vocabulary) {
    const present = text.includes(term);
    features[term] = present ? 1 : 0;
    if (present) matchedCount += 1;
  }
  return { features, matchedCount };
};

/**
 * Classifies a session's extracted symptoms against the trained model.
 * Pure function given the loaded model — no DB access, no network.
 *
 * @param {Array<{name: string}>} symptoms - Session.symptoms
 * @returns {{condition: string|null, confidence: number, topPredictions: Array<{condition:string, probability:number}>}}
 */
const classifySymptoms = (symptoms = []) => {
  const { features, matchedCount } = extractFeatures(symptoms);

  // No recognized symptoms at all — an all-zero feature vector wouldn't
  // reflect any real signal, just whichever condition has the lowest
  // baseline symptom rates. Rather than return a confident-looking but
  // meaningless guess, report no prediction.
  if (matchedCount === 0) {
    return { condition: null, confidence: 0, topPredictions: [] };
  }

  const logProbs = {};
  for (const condition of conditions) {
    let logProb = Math.log(priors[condition]);
    for (const term of vocabulary) {
      const p1 = prob1[condition][term];
      logProb += features[term] === 1 ? Math.log(p1) : Math.log(1 - p1);
    }
    logProbs[condition] = logProb;
  }

  // Normalize log-probabilities into an actual probability distribution
  // (softmax, shifted by the max for numerical stability).
  const maxLog = Math.max(...Object.values(logProbs));
  const expScores = {};
  let sumExp = 0;
  for (const condition of conditions) {
    const e = Math.exp(logProbs[condition] - maxLog);
    expScores[condition] = e;
    sumExp += e;
  }

  const ranked = conditions
    .map((condition) => ({ condition, probability: Math.round((expScores[condition] / sumExp) * 1000) / 1000 }))
    .sort((a, b) => b.probability - a.probability);

  return {
    condition: ranked[0].condition,
    confidence: ranked[0].probability,
    topPredictions: ranked.slice(0, 3),
  };
};

module.exports = { classifySymptoms, MODEL_META: { version: model.version, trainedAt: model.trainedAt, evaluation: model.evaluation } };
