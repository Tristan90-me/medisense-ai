// Generates realistic demo users exercising every part of the app —
// sessions (with REAL rule-based triage + ML classifier output, not faked),
// dependents, medications, emergency contacts, and photo-log entries — for
// assessing the system's capabilities against real-shaped data.
//
// Every seeded user's email lives on a single, obviously-fake domain
// (SEED_EMAIL_DOMAIN below). That's the ONLY marker this script relies on —
// no schema changes, no tracking collection — and it's exactly what
// scripts/clearDemoData.js scopes its cleanup to. Re-running this script is
// safe: it first removes any of its own previously-seeded users (matched by
// that same domain) before generating a fresh batch.
//
// Usage: node scripts/seedDemoData.js [userCount]   (default 100)
require('dotenv').config();
const mongoose = require('mongoose');
const zlib = require('zlib');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const HealthProfile = require('../models/HealthProfile');
const Dependent = require('../models/Dependent');
const Session = require('../models/Session');
const Medication = require('../models/Medication');
const EmergencyContact = require('../models/EmergencyContact');
const PhotoLog = require('../models/PhotoLog');
const { computeTriageScore } = require('../utils/triage');
const { classifySymptoms } = require('../ml/symptomClassifier');
const { uploadBuffer } = require('../utils/gridfs');

const SEED_EMAIL_DOMAIN = 'seed.medisense.local';
const NUM_USERS = Math.max(1, Math.min(100, parseInt(process.argv[2], 10) || 100));
const SEED_PASSWORD = 'DemoSeed!2026';

// ── Small local RNG helpers ────────────────────────────────────────────────
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randChoice = (arr) => arr[randInt(0, arr.length - 1)];
const randChoices = (arr, n) => {
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < n && pool.length; i += 1) {
    out.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  }
  return out;
};
const chance = (p) => Math.random() < p;
// Weighted date: ~45% within the last 7 days (feeds Community Insights'
// default window + Dashboard's "sessions this week"), the rest spread over
// the last 90 days (feeds HealthStats' trend chart with real history).
const randPastDate = () => {
  const daysAgo = chance(0.45) ? randInt(0, 7) : randInt(8, 90);
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  d.setHours(randInt(7, 22), randInt(0, 59), 0, 0);
  return d;
};

// ── Names ───────────────────────────────────────────────────────────────────
const FIRST_NAMES = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Daniel', 'Nancy', 'Matthew', 'Lisa', 'Anthony', 'Betty', 'Mark', 'Margaret', 'Donald', 'Sandra', 'Amara', 'Kwame', 'Chidi', 'Ngozi', 'Yusuf', 'Fatima', 'Aisha', 'Tunde', 'Priya', 'Rohan', 'Wei', 'Mei', 'Carlos', 'Sofia', 'Luca', 'Giulia'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Okafor', 'Adeyemi', 'Diallo', 'Mensah', 'Patel', 'Sharma', 'Chen', 'Wang', 'Kim', 'Nguyen', 'Rossi', 'Ferrari', 'Silva', 'Santos', 'Muller'];
const DEPENDENT_NAMES = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Riley', 'Casey', 'Morgan', 'Avery', 'Peyton', 'Quinn'];

// ── Symptom templates ────────────────────────────────────────────────────────
// Symptom names are drawn from ml/conditionProfiles.js's SYMPTOM_VOCABULARY
// so classifySymptoms() below always has real matching terms to work with —
// these aren't arbitrary strings, they're the exact vocabulary the app's own
// third diagnostic signal was trained on. Concentrating many distinct users
// on a handful of common templates (rather than fully randomizing every
// session) is deliberate: communityController.js only surfaces a symptom
// once at least 10 distinct users reported it in-window.
const TEMPLATES = [
  {
    condition: 'Common Cold', urgency: 'self-care', band: [1, 3],
    symptoms: ['runny nose', 'sore throat', 'cough', 'nasal congestion', 'fatigue'],
    recommendations: ['Rest and stay hydrated', 'Over-the-counter decongestants may help', 'See a doctor if symptoms last beyond 10 days'],
  },
  {
    condition: 'Influenza', urgency: 'monitor', band: [4, 6],
    symptoms: ['fever', 'chills', 'body aches', 'fatigue', 'headache'],
    recommendations: ['Rest and stay hydrated', 'Monitor your temperature', 'Seek care if fever persists beyond 3 days'],
  },
  {
    condition: 'Tension Headache', urgency: 'self-care', band: [1, 4],
    symptoms: ['headache', 'stiffness', 'difficulty concentrating'],
    recommendations: ['Rest in a quiet, dark room', 'Stay hydrated', 'Over-the-counter pain relief may help'],
  },
  {
    condition: 'Food Poisoning', urgency: 'see-doctor', band: [5, 7],
    symptoms: ['nausea', 'vomiting', 'diarrhea', 'abdominal pain', 'abdominal cramps'],
    recommendations: ['Stay hydrated with small sips of water', 'Avoid solid food until symptoms ease', 'See a doctor if symptoms persist beyond 2 days'],
  },
  {
    condition: 'Urinary Tract Infection', urgency: 'see-doctor', band: [4, 6],
    symptoms: ['burning urination', 'frequent urination', 'pelvic pain'],
    recommendations: ['See a doctor for a urine test', 'Drink plenty of water', 'Avoid delaying treatment — UTIs can worsen quickly'],
  },
  {
    condition: 'Muscle Strain', urgency: 'self-care', band: [2, 4],
    symptoms: ['back pain', 'joint pain', 'stiffness', 'limited range of motion'],
    recommendations: ['Rest the affected area', 'Apply ice for the first 48 hours', 'See a doctor if pain worsens or doesn’t improve in a week'],
  },
  {
    condition: 'GERD (Acid Reflux)', urgency: 'monitor', band: [2, 5],
    symptoms: ['heartburn', 'regurgitation', 'bloating', 'chest tightness'],
    recommendations: ['Avoid large meals close to bedtime', 'Limit spicy/fatty foods and caffeine', 'See a doctor if symptoms are frequent'],
  },
  {
    condition: 'Allergic Rhinitis', urgency: 'self-care', band: [1, 3],
    symptoms: ['sneezing', 'itchy eyes', 'nasal congestion', 'runny nose', 'red eyes'],
    recommendations: ['Antihistamines may help', 'Identify and avoid triggers where possible', 'See a doctor if symptoms are persistent'],
  },
  {
    condition: 'Anxiety Episode', urgency: 'monitor', band: [3, 6],
    symptoms: ['anxiety', 'restlessness', 'rapid heartbeat', 'difficulty sleeping'],
    recommendations: ['Practice slow, deep breathing', 'Consider speaking with a mental health professional', 'Seek care if this significantly affects daily life'],
  },
  // Deliberately trips utils/triage.js's chest_pain_cardiac rule — a small,
  // controlled number of these seed real entries into AdminFlaggedSessions.
  {
    condition: 'Possible Cardiac Event', urgency: 'emergency', band: [9, 10], emergency: true,
    symptoms: ['chest pain', 'shortness of breath', 'rapid heartbeat'],
    recommendations: ['Seek emergency care immediately', 'Do not drive yourself', 'Call emergency services'],
  },
];

const durationOptions = ['a few hours', 'about a day', '2 days', 'about a week', 'over a week'];
const onsetOptions = ['sudden', 'gradual'];

const levelForScore = (score) => (score <= 3 ? 'Low' : score <= 6 ? 'Moderate' : score <= 8 ? 'High' : 'Critical');

// Builds one fully-populated Session (minus user/dependent/_id, added by the
// caller) — real triage + ML output computed from the SAME symptom list the
// templated conversation below describes, exactly like aiController.js does
// for a live session.
function buildSession(template, healthProfile) {
  const pickedSymptoms = randChoices(template.symptoms, Math.min(template.symptoms.length, randInt(2, template.symptoms.length)));
  const symptoms = pickedSymptoms.map((name) => ({
    name, duration: randChoice(durationOptions), onset: randChoice(onsetOptions),
  }));

  const score = randInt(template.band[0], template.band[1]);
  const level = levelForScore(score);
  const emergency = !!template.emergency;

  const ruleBasedTriage = computeTriageScore(symptoms, healthProfile);
  const severityMismatch = ruleBasedTriage.level === 'Critical' && level !== 'Critical' && !emergency;
  const mlClassification = classifySymptoms(symptoms);

  const status = chance(0.08) ? 'abandoned' : chance(0.1) ? 'active' : 'completed';
  const first = pickedSymptoms[0];
  const rest = pickedSymptoms.slice(1);
  const userLine1 = rest.length
    ? `I've been dealing with ${first} and ${rest.join(', ')} for ${symptoms[0].duration}.`
    : `I've been dealing with ${first} for ${symptoms[0].duration}.`;

  const messages = [
    { role: 'user', content: userLine1 },
    { role: 'assistant', content: `Thanks for sharing that. Would you say it came on suddenly or gradually, and has anything made it better or worse?` },
    { role: 'user', content: `It came on ${symptoms[0].onset}. Nothing's really helped so far.` },
  ];
  if (status !== 'active') {
    messages.push({
      role: 'assistant',
      content: emergency
        ? `Based on what you've described, this combination of symptoms needs urgent attention. Please seek emergency care right away.`
        : `Based on what you've described, this looks consistent with ${template.condition}. ${template.recommendations[0]}.`,
    });
  }

  return {
    mode: chance(0.7) ? 'quick' : 'full',
    status,
    messages,
    symptoms,
    severityScore: score,
    severityLevel: level,
    diagnosis: status === 'active' ? undefined : {
      conditions: [
        { name: template.condition, probability: randInt(55, 85), confidence: 'moderate' },
        { name: randChoice(TEMPLATES.filter((t) => t !== template)).condition, probability: randInt(10, 30), confidence: 'low' },
      ],
      recommendations: template.recommendations,
      seekCareUrgency: template.urgency,
    },
    emergencyDetected: emergency,
    ruleBasedTriage,
    severityMismatch,
    flaggedForReview: emergency || severityMismatch,
    mlClassification,
    summary: status === 'active' ? undefined : `${template.condition} suspected — ${template.urgency.replace('-', ' ')} recommended.`,
    _plannedCreatedAt: randPastDate(),
  };
}

// ── A tiny, correctly-checksummed solid-color PNG, built by hand rather
// than trusting a memorized base64 string — CRC32 computed for real so the
// file is guaranteed valid, not just probably valid. Photo Log entries don't
// need to look like anything specific for this purpose, just be a real,
// streamable image (imageRef is a required, actually-fetched GridFS file). ─
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function makeSolidPng(r, g, b, size = 8) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; ihdrData[9] = 2; ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const p = rowStart + 1 + x * 3;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b;
    }
  }
  const idatData = zlib.deflateSync(raw);
  return Buffer.concat([sig, pngChunk('IHDR', ihdrData), pngChunk('IDAT', idatData), pngChunk('IEND', Buffer.alloc(0))]);
}

const PHOTO_BODY_REGIONS = ['Forearm', 'Lower leg', 'Back', 'Neck', 'Hand'];
const PHOTO_CAPTIONS = ['Rash that appeared this morning', 'Swelling after a fall', 'Bruise that hasn’t faded', 'Skin irritation, mildly itchy', 'Redness around a small cut'];
const PHOTO_FINDINGS = [
  ['Mild redness observed', 'No visible signs of infection'],
  ['Slight swelling present', 'Recommend monitoring over 48 hours'],
  ['Surface-level bruising', 'No open wound visible'],
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected. Seeding ${NUM_USERS} demo user(s) on @${SEED_EMAIL_DOMAIN}...`);

  // Idempotent: wipe this script's own previous batch first (scoped strictly
  // to the seed domain — never touches anything else) so re-running doesn't
  // collide on unique emails or double up data.
  const existing = await User.find({ email: { $regex: `@${SEED_EMAIL_DOMAIN}$` } }).select('_id');
  if (existing.length) {
    console.log(`Removing ${existing.length} previously-seeded user(s) first...`);
    // eslint-disable-next-line global-require
    const { clearByUserIds } = require('./clearDemoData');
    await clearByUserIds(existing.map((u) => u._id));
  }

  // A handful of shared placeholder images, uploaded once and referenced by
  // many PhotoLog entries — no need for 100+ unique images.
  console.log('Uploading placeholder photo assets to GridFS...');
  const palette = [[212, 165, 116], [190, 140, 140], [170, 150, 190], [150, 180, 170]];
  const photoRefs = [];
  for (const [r, g, b] of palette) {
    // eslint-disable-next-line no-await-in-loop
    photoRefs.push(await uploadBuffer(makeSolidPng(r, g, b), 'demo-seed-placeholder.png', 'image/png'));
  }

  const userDocs = [];
  const profileDocs = [];
  const dependentDocs = [];
  const sessionDocs = [];
  const medicationDocs = [];
  const contactDocs = [];
  const photoDocs = [];

  for (let i = 1; i <= NUM_USERS; i += 1) {
    const first = randChoice(FIRST_NAMES);
    const last = randChoice(LAST_NAMES);
    const userId = new mongoose.Types.ObjectId();
    const sex = randChoice(['male', 'female', 'other']);
    const dob = new Date(Date.now() - randInt(18, 75) * 365.25 * 24 * 60 * 60 * 1000);

    userDocs.push({
      _id: userId,
      name: `${first} ${last}`,
      email: `seed-user-${String(i).padStart(3, '0')}@${SEED_EMAIL_DOMAIN}`,
      password: SEED_PASSWORD, // hashed below in one batch, see note before insertMany
      role: 'user',
      isActive: true,
      isEmailVerified: true,
    });

    profileDocs.push({
      user: userId, dependent: null,
      dateOfBirth: dob, sex,
      weight: randInt(50, 95), height: randInt(155, 190),
      bloodType: randChoice(['A+', 'A-', 'B+', 'O+', 'O-', 'AB+', 'unknown']),
      preExistingConditions: chance(0.25) ? randChoices(['Asthma', 'Hypertension', 'Diabetes Type 2', 'Migraine'], 1) : [],
      allergies: chance(0.2) ? randChoices(['Penicillin', 'Pollen', 'Peanuts'], 1) : [],
      currentMedications: [],
      familyHistory: chance(0.15) ? randChoices(['Heart disease', 'Diabetes'], 1) : [],
      smokingStatus: randChoice(['never', 'never', 'never', 'former', 'current']),
      alcoholUse: randChoice(['none', 'occasional', 'occasional', 'moderate']),
      onboardingComplete: true,
    });

    // Sessions for the account owner. ~15% of users concentrate on the
    // emergency template (still a small minority) so AdminFlaggedSessions
    // has real data without dominating the batch.
    const sessionCount = randInt(1, 4);
    const templatesForUser = chance(0.15)
      ? [TEMPLATES[TEMPLATES.length - 1], ...randChoices(TEMPLATES.slice(0, -1), sessionCount - 1)]
      : randChoices(TEMPLATES.slice(0, -1), sessionCount);
    for (const template of templatesForUser) {
      sessionDocs.push({ ...buildSession(template, profileDocs[profileDocs.length - 1]), user: userId, dependent: null });
    }

    // Dependents — ~35% of users have one, ~10% have two.
    const depCount = chance(0.1) ? 2 : chance(0.35) ? 1 : 0;
    for (let d = 0; d < depCount; d += 1) {
      const depId = new mongoose.Types.ObjectId();
      const relationship = randChoice(['child', 'spouse', 'parent', 'sibling']);
      dependentDocs.push({
        _id: depId, owner: userId, name: randChoice(DEPENDENT_NAMES),
        relationship, sex: randChoice(['male', 'female', 'other']),
        dateOfBirth: new Date(Date.now() - randInt(relationship === 'child' ? 2 : 20, relationship === 'child' ? 17 : 80) * 365.25 * 24 * 60 * 60 * 1000),
      });
      profileDocs.push({
        user: userId, dependent: depId,
        dateOfBirth: dependentDocs[dependentDocs.length - 1].dateOfBirth,
        sex: dependentDocs[dependentDocs.length - 1].sex,
        onboardingComplete: true,
        weight: randInt(15, 90), height: randInt(90, 185),
        bloodType: 'unknown', preExistingConditions: [], allergies: [], currentMedications: [], familyHistory: [],
        smokingStatus: 'never', alcoholUse: 'none',
      });
      if (chance(0.5)) {
        const depTemplate = randChoice(TEMPLATES.slice(0, -1));
        sessionDocs.push({ ...buildSession(depTemplate, profileDocs[profileDocs.length - 1]), user: userId, dependent: depId });
      }
    }

    // Medications — mix of active/inactive.
    if (chance(0.5)) {
      const medNames = randChoices(['Amoxicillin', 'Ibuprofen', 'Metformin', 'Lisinopril', 'Loratadine', 'Omeprazole', 'Vitamin D', 'Atorvastatin'], randInt(1, 3));
      medNames.forEach((name) => medicationDocs.push({
        user: userId, dependent: null, name,
        dosage: randChoice(['250mg', '500mg', '10mg', '1 tablet']),
        frequency: randChoice(['Once daily', 'Twice daily', 'As needed']),
        active: chance(0.75),
      }));
    }

    // Emergency contacts.
    if (chance(0.4)) {
      const contactCount = chance(0.3) ? 2 : 1;
      for (let c = 0; c < contactCount; c += 1) {
        contactDocs.push({
          user: userId,
          name: `${randChoice(FIRST_NAMES)} ${randChoice(LAST_NAMES)}`,
          relationship: randChoice(['Spouse', 'Parent', 'Sibling', 'Friend']),
          phone: `+1-555-${randInt(200, 999)}-${randInt(1000, 9999)}`,
          isPrimary: c === 0,
        });
      }
    }

    // Photo log — ~20% of users, referencing the shared placeholder images.
    if (chance(0.2)) {
      const n = randInt(1, 2);
      for (let p = 0; p < n; p += 1) {
        photoDocs.push({
          user: userId, dependent: null,
          imageRef: randChoice(photoRefs),
          mimeType: 'image/png',
          caption: randChoice(PHOTO_CAPTIONS),
          bodyRegion: randChoice(PHOTO_BODY_REGIONS),
          aiAnalysis: {
            description: 'Automated visual review of the uploaded photo.',
            findings: randChoice(PHOTO_FINDINGS),
            confidence: randChoice(['low', 'moderate']),
            flaggedForReview: false,
          },
        });
      }
    }
  }

  console.log('Hashing passwords...');
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 12);
  userDocs.forEach((u) => { u.password = hashedPassword; });

  console.log(`Inserting ${userDocs.length} users, ${profileDocs.length} profiles, ${dependentDocs.length} dependents, ${sessionDocs.length} sessions, ${medicationDocs.length} medications, ${contactDocs.length} contacts, ${photoDocs.length} photo-log entries...`);

  // Inserted via each model's own insertMany (validated, correctly-typed) —
  // NOT the raw collection driver — so schema rules still apply. createdAt
  // still lands as "now" from Mongoose's timestamps hook at this point;
  // fixed up for Sessions in the follow-up pass below.
  await User.insertMany(userDocs);
  await HealthProfile.insertMany(profileDocs);
  if (dependentDocs.length) await Dependent.insertMany(dependentDocs);
  const insertedSessions = sessionDocs.length ? await Session.insertMany(sessionDocs) : [];
  if (medicationDocs.length) await Medication.insertMany(medicationDocs);
  if (contactDocs.length) await EmergencyContact.insertMany(contactDocs);
  if (photoDocs.length) await PhotoLog.insertMany(photoDocs);

  // Backdate session timestamps to the planned spread (see randPastDate) —
  // confirmed live that Mongoose's own bulkWrite() silently strips createdAt
  // out of $set (its timestamps middleware protects that field on update
  // operations), reporting a modified count while leaving the value
  // unchanged. Going through the raw driver's collection.bulkWrite()
  // bypasses that middleware entirely, so the $set actually takes effect.
  if (insertedSessions.length) {
    console.log('Backdating session timestamps for a realistic history spread...');
    const ops = insertedSessions.map((doc, idx) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { createdAt: sessionDocs[idx]._plannedCreatedAt, updatedAt: sessionDocs[idx]._plannedCreatedAt } },
      },
    }));
    await Session.collection.bulkWrite(ops);
  }

  console.log('Done.');
  console.log(`Sign in as any seeded user with password: ${SEED_PASSWORD}`);
  console.log(`e.g. seed-user-001@${SEED_EMAIL_DOMAIN}`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
