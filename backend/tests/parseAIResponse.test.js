// Pure unit tests for parseAIResponse() in utils/gemini.js. No DB, no app,
// no network — this function just regex-parses bracket-tagged metadata out
// of a raw AI response string. See tests/setup.js for why a mongo-memory
// server still boots for this file: it's wired globally via jest.config.js's
// setupFilesAfterEnv, and isn't worth special-casing out for one file.
const { parseAIResponse } = require('../utils/gemini');

describe('parseAIResponse', () => {
  test('plain text with no tags is returned unchanged with all defaults', () => {
    const raw = 'Just a normal conversational reply with no metadata.';
    const result = parseAIResponse(raw);

    expect(result).toEqual({
      text: raw,
      emergency: false,
      severity: null,
      symptoms: null,
      diagnosis: null,
      suggestions: [],
    });
  });

  test('[EMERGENCY] sets emergency=true and is stripped from text', () => {
    const result = parseAIResponse('[EMERGENCY] Call 911 immediately.');
    expect(result.emergency).toBe(true);
    expect(result.text).toBe('Call 911 immediately.');
  });

  test('[SEVERITY:{...}] is parsed into an object and stripped from text', () => {
    const raw = 'Here is your assessment. [SEVERITY:{"score":7,"level":"High","reason":"Fever with stiff neck"}] Please seek care.';
    const result = parseAIResponse(raw);

    expect(result.severity).toEqual({ score: 7, level: 'High', reason: 'Fever with stiff neck' });
    expect(result.text).toBe('Here is your assessment. Please seek care.');
  });

  test('[SYMPTOMS:{...}] (string array fields) is parsed and stripped from text', () => {
    const raw = 'Noted. [SYMPTOMS:{"symptoms":["headache","fever"],"duration":"2 days","onset":"sudden"}] Anything else?';
    const result = parseAIResponse(raw);

    expect(result.symptoms).toEqual({
      symptoms: ['headache', 'fever'],
      duration: '2 days',
      onset: 'sudden',
    });
    expect(result.text).toBe('Noted. Anything else?');
  });

  test('[DIAGNOSIS:{...}] with a flat/empty conditions array is parsed and stripped from text', () => {
    // NOTE: an empty `conditions` array here is the simple case. The
    // realistic nested array-of-objects shape (what the system prompt
    // actually asks the AI to produce) used to break parsing entirely —
    // see the "extractTaggedValue" tests further down for that fix.
    const raw = 'x [DIAGNOSIS:{"conditions":[],"recommendations":["Rest","Hydrate"],"seekCareUrgency":"self-care"}] y';
    const result = parseAIResponse(raw);

    expect(result.diagnosis).toEqual({
      conditions: [],
      recommendations: ['Rest', 'Hydrate'],
      seekCareUrgency: 'self-care',
    });
    expect(result.text).toBe('x y');
  });

  test('[SUGGESTIONS:[...]] is parsed into an array and stripped from text', () => {
    const raw = 'Wrapping up. [SUGGESTIONS:["Tell me more","I also have a fever","When did this start?"]]';
    const result = parseAIResponse(raw);

    expect(result.suggestions).toEqual(['Tell me more', 'I also have a fever', 'When did this start?']);
    expect(result.text).toBe('Wrapping up.');
  });

  test('multiple tags combined in one response are all parsed and all stripped', () => {
    const raw = [
      '[EMERGENCY]',
      'This sounds serious.',
      '[SEVERITY:{"score":9,"level":"Critical","reason":"Possible stroke"}]',
      '[SYMPTOMS:{"symptoms":["face drooping","arm weakness"],"duration":"10 minutes","onset":"sudden"}]',
      '[SUGGESTIONS:["Call emergency services now"]]',
    ].join(' ');

    const result = parseAIResponse(raw);

    expect(result.emergency).toBe(true);
    expect(result.severity).toEqual({ score: 9, level: 'Critical', reason: 'Possible stroke' });
    expect(result.symptoms).toEqual({
      symptoms: ['face drooping', 'arm weakness'],
      duration: '10 minutes',
      onset: 'sudden',
    });
    expect(result.suggestions).toEqual(['Call emergency services now']);
    expect(result.text).toBe('This sounds serious.');
  });

  test('tags appearing in a different order in the raw text are still all extracted correctly', () => {
    const raw = 'intro [SUGGESTIONS:["a","b"]] middle [SEVERITY:{"score":5,"level":"Moderate","reason":"n/a"}] end';
    const result = parseAIResponse(raw);

    expect(result.suggestions).toEqual(['a', 'b']);
    expect(result.severity).toEqual({ score: 5, level: 'Moderate', reason: 'n/a' });
    expect(result.text).toBe('intro middle end');
  });

  test('malformed JSON inside a tag does not throw: field stays null, tag text is still stripped', () => {
    expect(() => parseAIResponse('Hi [SEVERITY:{score:7,}] there')).not.toThrow();

    const result = parseAIResponse('Hi [SEVERITY:{score:7,}] there');
    expect(result.severity).toBeNull();
    expect(result.text).toBe('Hi there');
  });

  test('malformed JSON inside [SUGGESTIONS:...] does not throw and leaves suggestions as the default empty array', () => {
    expect(() => parseAIResponse('[SUGGESTIONS:[oops not json]]')).not.toThrow();
    const result = parseAIResponse('before [SUGGESTIONS:[oops not json]] after');
    expect(result.suggestions).toEqual([]);
    expect(result.text).toBe('before after');
  });

  // ── FIXED BUG (previously "KNOWN BUG" — see final report for history) ────
  // parseAIResponse used to regex-match `/\[DIAGNOSIS:(\{.*?\})\]/s`, which
  // is non-greedy and stopped at the FIRST "}]" in the string. The system
  // prompt's own example DIAGNOSIS shape is `{"conditions":[{...},{...}],
  // "recommendations":[...],"seekCareUrgency":"..."}` — and the `conditions`
  // array of objects ends with exactly "}]" (last condition's closing brace
  // + the array's closing bracket) *before* the real end of the outer
  // object, so the regex truncated the JSON, JSON.parse threw, and the
  // caught error silently left `diagnosis: null` while leaking the
  // unstripped remainder of the tag into the visible `text`.
  //
  // This is now fixed via `extractTaggedValue()`, which walks bracket depth
  // (ignoring brackets inside string literals) to find the true matching
  // close instead of guessing from the first "}]"/"]]" it sees. These tests
  // assert the CORRECT behavior against the exact realistic payload shapes
  // that used to break it.
  test('a realistic multi-condition [DIAGNOSIS:...] payload parses correctly and text is clean', () => {
    const raw = 'Assessment ready. [DIAGNOSIS:{"conditions":[{"name":"Bacterial Meningitis","probability":45,"confidence":"moderate"},{"name":"Viral Meningitis","probability":35,"confidence":"moderate"}],"recommendations":["Seek emergency care immediately"],"seekCareUrgency":"emergency"}] Take care.';

    const result = parseAIResponse(raw);

    expect(result.diagnosis).toEqual({
      conditions: [
        { name: 'Bacterial Meningitis', probability: 45, confidence: 'moderate' },
        { name: 'Viral Meningitis', probability: 35, confidence: 'moderate' },
      ],
      recommendations: ['Seek emergency care immediately'],
      seekCareUrgency: 'emergency',
    });
    expect(result.text).toBe('Assessment ready. Take care.');
    expect(result.text).not.toContain('"recommendations"');
    expect(result.text).not.toContain('seekCareUrgency');
  });

  test('a [DIAGNOSIS:...] payload with a single condition parses correctly and text is clean', () => {
    const raw = 'x [DIAGNOSIS:{"conditions":[{"name":"Common Cold","probability":80,"confidence":"high"}],"recommendations":["Rest","Fluids"],"seekCareUrgency":"self-care"}] y';

    const result = parseAIResponse(raw);

    expect(result.diagnosis).toEqual({
      conditions: [{ name: 'Common Cold', probability: 80, confidence: 'high' }],
      recommendations: ['Rest', 'Fluids'],
      seekCareUrgency: 'self-care',
    });
    expect(result.text).toBe('x y');
  });

  test('a [DIAGNOSIS:...] payload with an empty conditions array parses correctly and text is clean', () => {
    const raw = 'x [DIAGNOSIS:{"conditions":[],"recommendations":["Monitor symptoms"],"seekCareUrgency":"monitor"}] y';

    const result = parseAIResponse(raw);

    expect(result.diagnosis).toEqual({
      conditions: [],
      recommendations: ['Monitor symptoms'],
      seekCareUrgency: 'monitor',
    });
    expect(result.text).toBe('x y');
  });

  test('multiple tags including a realistic nested DIAGNOSIS all parse correctly together', () => {
    const raw = [
      'Here is my assessment.',
      '[SEVERITY:{"score":8,"level":"High","reason":"Possible meningitis"}]',
      '[DIAGNOSIS:{"conditions":[{"name":"Bacterial Meningitis","probability":45,"confidence":"moderate"},{"name":"Viral Meningitis","probability":35,"confidence":"moderate"}],"recommendations":["Seek emergency care immediately"],"seekCareUrgency":"emergency"}]',
      '[SUGGESTIONS:["Tell me more"]]',
    ].join(' ');

    const result = parseAIResponse(raw);

    expect(result.severity).toEqual({ score: 8, level: 'High', reason: 'Possible meningitis' });
    expect(result.diagnosis.conditions).toHaveLength(2);
    expect(result.diagnosis.seekCareUrgency).toBe('emergency');
    expect(result.suggestions).toEqual(['Tell me more']);
    expect(result.text).toBe('Here is my assessment.');
  });
});
