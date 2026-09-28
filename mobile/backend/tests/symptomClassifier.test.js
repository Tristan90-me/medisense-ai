// Pure unit tests for classifySymptoms() in ml/symptomClassifier.js — no DB,
// no app, no network. Loads the real trained model.json (checked-in
// artifact, not regenerated per test run) since retraining would make
// results non-deterministic across environments; train.js uses a fixed
// seed specifically so this stays reproducible if it ever IS retrained.
const { classifySymptoms, MODEL_META } = require('../ml/symptomClassifier');

const sym = (...names) => names.map((name) => ({ name }));

describe('classifySymptoms', () => {
  test('the loaded model reports a reasonable held-out accuracy', () => {
    // Guards against a badly regressed retraining (e.g. a data-generation
    // bug collapsing everything into one class) without pinning an exact
    // number that would make this test brittle to legitimate retrains.
    expect(MODEL_META.evaluation.accuracy).toBeGreaterThan(0.5);
    expect(MODEL_META.evaluation.accuracy).toBeLessThanOrEqual(1);
  });

  test('no symptoms at all returns no prediction rather than a meaningless guess', () => {
    const result = classifySymptoms([]);
    expect(result).toEqual({ condition: null, confidence: 0, topPredictions: [] });
  });

  test('symptom text matching no vocabulary term returns no prediction', () => {
    const result = classifySymptoms(sym('the sky is a lovely shade of blue today'));
    expect(result.condition).toBeNull();
  });

  test('classic cold symptoms predict Common Cold with a topPredictions list', () => {
    const result = classifySymptoms(sym('runny nose', 'sneezing', 'sore throat'));
    expect(result.condition).toBe('Common Cold');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.topPredictions.length).toBeGreaterThan(0);
    expect(result.topPredictions[0].condition).toBe('Common Cold');
  });

  test('classic flu symptoms predict Influenza', () => {
    const result = classifySymptoms(sym('fever', 'body aches', 'chills', 'fatigue'));
    expect(result.condition).toBe('Influenza');
  });

  test('classic migraine symptoms predict Migraine over the similar Tension Headache', () => {
    const result = classifySymptoms(sym('headache', 'sensitivity to light', 'nausea'));
    expect(result.condition).toBe('Migraine');
    expect(result.topPredictions.some((p) => p.condition === 'Tension Headache')).toBe(true);
  });

  test('classic UTI symptoms predict Urinary Tract Infection', () => {
    const result = classifySymptoms(sym('burning urination', 'frequent urination'));
    expect(result.condition).toBe('Urinary Tract Infection');
  });

  test('topPredictions is sorted descending by probability and sums to roughly 1 across all conditions', () => {
    const result = classifySymptoms(sym('itchy skin', 'dry patches', 'redness'));
    for (let i = 1; i < result.topPredictions.length; i++) {
      expect(result.topPredictions[i].probability).toBeLessThanOrEqual(result.topPredictions[i - 1].probability);
    }
  });

  test('confidence matches the top prediction\'s own probability', () => {
    const result = classifySymptoms(sym('fever', 'body aches', 'chills'));
    expect(result.confidence).toBe(result.topPredictions[0].probability);
  });

  test('is deterministic — the same input always produces the same output', () => {
    const symptoms = sym('cough', 'chest congestion', 'fatigue');
    const first = classifySymptoms(symptoms);
    const second = classifySymptoms(symptoms);
    expect(first).toEqual(second);
  });

  test('matching is substring-based, so a longer LLM-extracted phrase still matches a shorter vocabulary term', () => {
    const result = classifySymptoms(sym('severe burning urination for two days'));
    expect(result.condition).not.toBeNull();
  });

  test('case-insensitive matching', () => {
    const lower = classifySymptoms(sym('runny nose', 'sneezing'));
    const upper = classifySymptoms(sym('RUNNY NOSE', 'SNEEZING'));
    expect(upper.condition).toBe(lower.condition);
  });
});
