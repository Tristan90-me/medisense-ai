// Pure unit tests for computeTriageScore() in utils/triage.js — no DB, no
// app, no network. See tests/setup.js for why a mongo-memory server still
// boots for this file: it's wired globally via jest.config.js's
// setupFilesAfterEnv, and isn't worth special-casing out for one file.
const { computeTriageScore } = require('../utils/triage');

const sym = (...names) => names.map((name) => ({ name }));

describe('computeTriageScore', () => {
  test('no symptoms at all is Low with an empty matched-rules list', () => {
    expect(computeTriageScore([], null)).toEqual({ level: 'Low', score: 0, matchedRules: [] });
  });

  test('ordinary symptoms with no red flags stay Low', () => {
    const result = computeTriageScore(sym('runny nose', 'mild cough', 'sore throat'), null);
    expect(result).toEqual({ level: 'Low', score: 0, matchedRules: [] });
  });

  test('chest pain alone (no compound qualifier) does not trigger the cardiac rule', () => {
    const result = computeTriageScore(sym('chest pain'), null);
    expect(result.level).toBe('Low');
    expect(result.matchedRules).toEqual([]);
  });

  test('chest pain plus shortness of breath triggers the cardiac rule as Critical', () => {
    const result = computeTriageScore(sym('chest pain', 'shortness of breath'), null);
    expect(result.level).toBe('Critical');
    expect(result.score).toBe(10);
    expect(result.matchedRules).toContain('chest_pain_cardiac');
  });

  test('"worst headache of my life" phrasing triggers the thunderclap headache rule', () => {
    const result = computeTriageScore(sym('worst headache of my life'), null);
    expect(result.matchedRules).toContain('thunderclap_headache');
  });

  test('difficulty breathing alone triggers the breathing-difficulty rule', () => {
    const result = computeTriageScore(sym('difficulty breathing'), null);
    expect(result.matchedRules).toEqual(['breathing_difficulty']);
  });

  test('stroke sign keywords trigger the stroke rule', () => {
    const result = computeTriageScore(sym('slurred speech', 'arm weakness'), null);
    expect(result.matchedRules).toContain('stroke_signs');
  });

  test('uncontrolled bleeding triggers its rule', () => {
    const result = computeTriageScore(sym('uncontrolled bleeding'), null);
    expect(result.matchedRules).toEqual(['uncontrolled_bleeding']);
  });

  test('loss of consciousness triggers its rule', () => {
    const result = computeTriageScore(sym('passed out'), null);
    expect(result.matchedRules).toEqual(['loss_of_consciousness']);
  });

  test('hives alone (without breathing involvement) does not trigger the allergic-reaction rule', () => {
    const result = computeTriageScore(sym('hives'), null);
    expect(result.matchedRules).toEqual([]);
  });

  test('hives plus breathing issues triggers the severe-allergic-reaction rule', () => {
    const result = computeTriageScore(sym('hives', 'shortness of breath'), null);
    expect(result.matchedRules).toContain('severe_allergic_reaction');
  });

  test('suicidal ideation phrasing triggers its rule', () => {
    const result = computeTriageScore(sym('suicidal thoughts'), null);
    expect(result.matchedRules).toContain('suicidal_ideation');
  });

  test('multiple simultaneous red flags all appear in matchedRules', () => {
    const result = computeTriageScore(sym('chest pain', 'jaw pain', 'fainted'), null);
    expect(result.level).toBe('Critical');
    expect(result.matchedRules).toEqual(expect.arrayContaining(['chest_pain_cardiac', 'loss_of_consciousness']));
  });

  describe('health profile risk adjustment', () => {
    test('chest pain alone is still Low with no relevant health history', () => {
      const healthProfile = { preExistingConditions: ['Asthma'] };
      const result = computeTriageScore(sym('chest pain'), healthProfile);
      expect(result.level).toBe('Low');
    });

    test('chest pain alone becomes Critical for someone with a cardiac history', () => {
      const healthProfile = { preExistingConditions: ['Heart Disease'] };
      const result = computeTriageScore(sym('chest pain'), healthProfile);
      expect(result.level).toBe('Critical');
      expect(result.matchedRules).toContain('chest_pain_cardiac_risk_factor');
    });

    test('a null health profile is handled without throwing', () => {
      expect(() => computeTriageScore(sym('chest pain'), null)).not.toThrow();
    });

    test('an undefined preExistingConditions field is handled without throwing', () => {
      expect(() => computeTriageScore(sym('chest pain'), {})).not.toThrow();
    });
  });

  describe('extraKeywords (admin-editable custom emergency keywords)', () => {
    test('omitting extraKeywords behaves identically to before (regression-proof default)', () => {
      const withDefault = computeTriageScore(sym('chest pain', 'shortness of breath'), null);
      const withExplicitEmpty = computeTriageScore(sym('chest pain', 'shortness of breath'), null, []);
      expect(withDefault).toEqual(withExplicitEmpty);

      const lowWithDefault = computeTriageScore(sym('runny nose'), null);
      const lowWithExplicitEmpty = computeTriageScore(sym('runny nose'), null, []);
      expect(lowWithDefault).toEqual(lowWithExplicitEmpty);
    });

    test('a custom keyword with no built-in rule match still triggers Critical', () => {
      const result = computeTriageScore(sym('funny taste in mouth'), null, ['funny taste in mouth']);
      expect(result.level).toBe('Critical');
      expect(result.score).toBe(10);
    });

    test('a matched custom keyword is recorded with the "custom:" prefix', () => {
      const result = computeTriageScore(sym('funny taste in mouth'), null, ['funny taste in mouth']);
      expect(result.matchedRules).toContain('custom:funny taste in mouth');
    });

    test('a custom keyword that does not appear in the symptom text does not match', () => {
      const result = computeTriageScore(sym('runny nose'), null, ['funny taste in mouth']);
      expect(result.level).toBe('Low');
      expect(result.matchedRules).toEqual([]);
    });

    test('custom keywords combine with built-in rule matches in the same result', () => {
      const result = computeTriageScore(sym('chest pain', 'shortness of breath'), null, ['funny taste in mouth']);
      expect(result.matchedRules).toContain('chest_pain_cardiac');
      // Only recorded if it actually appears in the text — it doesn't here.
      expect(result.matchedRules).not.toContain('custom:funny taste in mouth');
    });
  });
});
