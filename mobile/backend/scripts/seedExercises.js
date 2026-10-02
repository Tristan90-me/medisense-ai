// Seeds the shared Exercise library from wger's open, free exercise
// database (https://wger.de/api/v2/exerciseinfo/) — no API key needed.
//
// Unlike seedDemoData.js (which wipes and reinserts throwaway demo users),
// this UPSERTS by {source: 'wger', externalId} and never deletes. Exercise
// documents are referenced by ObjectId from WorkoutPlan/WorkoutLog/
// PersonalRecord, so re-running this script to pick up wger corrections
// must update those same rows in place, never replace them with new ids.
//
// Usage: node scripts/seedExercises.js [limit]   (default 200)
require('dotenv').config();
const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');

const WGER_BASE = 'https://wger.de/api/v2';
const ENGLISH_LANGUAGE_ID = 2;
const LIMIT = Math.max(1, Math.min(1000, parseInt(process.argv[2], 10) || 200));
const PAGE_SIZE = 50;
const USER_AGENT = 'MediSenseAI/1.0 (health app; exercise library seed script)';

// wger's category names -> this app's Exercise.category enum. Falls back to
// 'other' for anything unrecognized rather than failing the whole import.
const CATEGORY_MAP = {
  Abs: 'core',
  Arms: 'arms',
  Back: 'back',
  Calves: 'legs',
  Chest: 'chest',
  Legs: 'legs',
  Shoulders: 'shoulders',
  Cardio: 'cardio',
};

// wger descriptions are HTML — stripped to plain text since Exercise.instructions
// is a plain string. Good enough for an instructional blurb, not a full parser.
function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPage(offset) {
  const url = `${WGER_BASE}/exerciseinfo/?language=${ENGLISH_LANGUAGE_ID}&limit=${PAGE_SIZE}&offset=${offset}`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`wger API responded ${response.status} for ${url}`);
  return response.json();
}

// One wger exerciseinfo item -> our Exercise shape, or null if it has no
// English translation (can't seed a nameless exercise).
function normalize(item) {
  const translation = (item.translations || []).find((t) => t.language === ENGLISH_LANGUAGE_ID && t.name);
  if (!translation) return null;

  const categoryName = item.category && item.category.name;
  return {
    source: 'wger',
    externalId: String(item.id),
    name: translation.name.trim(),
    category: CATEGORY_MAP[categoryName] || 'other',
    equipment: (item.equipment || []).map((e) => e.name).filter(Boolean),
    // wger doesn't reliably distinguish flexibility/mobility work from its
    // category taxonomy — defaulting non-cardio to 'strength' is an MVP
    // simplification, same as the WorkoutLog.type default.
    exerciseType: categoryName === 'Cardio' ? 'cardio' : 'strength',
    instructions: stripHtml(translation.description).slice(0, 4000),
  };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected. Seeding up to ${LIMIT} exercises from wger...`);

  let imported = 0;
  let skipped = 0;
  for (let offset = 0; offset < LIMIT; offset += PAGE_SIZE) {
    // eslint-disable-next-line no-await-in-loop
    const page = await fetchPage(offset);
    const items = page.results || [];
    if (items.length === 0) break;

    // eslint-disable-next-line no-await-in-loop
    await Promise.all(items.map(async (item) => {
      const normalized = normalize(item);
      if (!normalized) { skipped += 1; return; }
      await Exercise.findOneAndUpdate(
        { source: normalized.source, externalId: normalized.externalId },
        normalized,
        { upsert: true, setDefaultsOnInsert: true },
      );
      imported += 1;
    }));

    console.log(`  ...page at offset ${offset}: ${items.length} fetched (${imported} imported so far, ${skipped} skipped)`);
    if (!page.next) break;
  }

  console.log(`Done. Imported/updated ${imported} exercises (${skipped} skipped for missing an English translation).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Exercise seed failed:', err.message);
  process.exit(1);
});
