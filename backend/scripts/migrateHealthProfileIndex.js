// One-time migration: HealthProfile.user used to be a field-level `unique:
// true` index (one profile per user, ever). Phase 4 (Family/Dependents)
// replaces that with a compound { user, dependent } unique index so a user
// can have one profile per dependent as well as their own.
//
// Mongoose's autoIndex only ADDS indexes declared in the schema — it never
// drops ones no longer declared. Without running this, the old single-field
// `user_1` unique index survives, and the first attempt to create a second
// HealthProfile for the same user (a dependent's profile) throws an
// E11000 duplicate key error, silently breaking the feature.
//
// No data backfill is needed: MongoDB treats a missing `dependent` field
// identically to an explicit null for both query matching and unique
// indexing, so every pre-existing profile keeps resolving via
// { user, dependent: null } once the new index is in place.
//
// Usage: node scripts/migrateHealthProfileIndex.js

require('dotenv').config();
const mongoose = require('mongoose');
const HealthProfile = require('../models/HealthProfile');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  try {
    const before = await HealthProfile.collection.indexes();
    console.log('Indexes before migration:');
    console.log(before.map((i) => ({ name: i.name, key: i.key, unique: !!i.unique })));

    const oldIndex = before.find((i) => i.name === 'user_1');
    if (oldIndex) {
      await HealthProfile.collection.dropIndex('user_1');
      console.log('Dropped old single-field unique index: user_1');
    } else {
      console.log('No old user_1 index found (already migrated, or fresh database).');
    }

    await HealthProfile.syncIndexes();

    const after = await HealthProfile.collection.indexes();
    console.log('Indexes after migration:');
    console.log(after.map((i) => ({ name: i.name, key: i.key, unique: !!i.unique })));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
