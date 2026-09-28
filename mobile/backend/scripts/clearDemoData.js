// Removes demo data created by scripts/seedDemoData.js — scoped strictly to
// users whose email lives on SEED_EMAIL_DOMAIN, matching that script's only
// marker. Never touches any other document in the database.
//
// Standalone usage:
//   node scripts/clearDemoData.js            (dry run — prints what WOULD be deleted)
//   node scripts/clearDemoData.js --confirm  (actually deletes)
//
// Also exports clearByUserIds(userIds) for reuse (seedDemoData.js calls this
// itself, against an already-open connection, to make re-running idempotent).
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const HealthProfile = require('../models/HealthProfile');
const Dependent = require('../models/Dependent');
const Session = require('../models/Session');
const Medication = require('../models/Medication');
const EmergencyContact = require('../models/EmergencyContact');
const PhotoLog = require('../models/PhotoLog');
const { deleteFile, getBucket } = require('../utils/gridfs');

const SEED_EMAIL_DOMAIN = 'seed.medisense.local';
// Exclusive to seedDemoData.js's shared placeholder photos — a real user's
// upload always keeps their own original filename, never this one. Swept
// directly by filename (not just by PhotoLog reference) so an uploaded-but-
// never-referenced placeholder can't linger as an orphaned GridFS file.
const PLACEHOLDER_FILENAME = 'demo-seed-placeholder.png';

// Every per-user collection here carries its own top-level `user` field even
// when the record is actually about a dependent (see models/*.js), so a
// single `user: { $in: userIds }` scope already catches dependent-linked
// records too — only Dependent itself is scoped by `owner` instead.
// Deletes every GridFS file named PLACEHOLDER_FILENAME, referenced or not —
// covers both photos still linked to a PhotoLog (about to be deleted below
// anyway) and any uploaded-but-never-referenced placeholder left behind by
// a seeding run.
async function clearPlaceholderImages() {
  const bucket = getBucket();
  const files = await bucket.find({ filename: PLACEHOLDER_FILENAME }).toArray();
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    await deleteFile(file._id);
  }
  return files.length;
}

async function clearByUserIds(userIds) {
  if (!userIds || userIds.length === 0) return { users: 0 };

  const gridfsFilesDeleted = await clearPlaceholderImages();

  const [photoRes, medRes, contactRes, sessionRes, profileRes, depRes, userRes] = await Promise.all([
    PhotoLog.deleteMany({ user: { $in: userIds } }),
    Medication.deleteMany({ user: { $in: userIds } }),
    EmergencyContact.deleteMany({ user: { $in: userIds } }),
    Session.deleteMany({ user: { $in: userIds } }),
    HealthProfile.deleteMany({ user: { $in: userIds } }),
    Dependent.deleteMany({ owner: { $in: userIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);

  return {
    users: userRes.deletedCount,
    healthProfiles: profileRes.deletedCount,
    dependents: depRes.deletedCount,
    sessions: sessionRes.deletedCount,
    medications: medRes.deletedCount,
    emergencyContacts: contactRes.deletedCount,
    photoLogs: photoRes.deletedCount,
    gridfsFiles: gridfsFilesDeleted,
  };
}

async function countByUserIds(userIds) {
  if (!userIds || userIds.length === 0) return { users: 0 };
  const [photos, meds, contacts, sessions, profiles, deps] = await Promise.all([
    PhotoLog.countDocuments({ user: { $in: userIds } }),
    Medication.countDocuments({ user: { $in: userIds } }),
    EmergencyContact.countDocuments({ user: { $in: userIds } }),
    Session.countDocuments({ user: { $in: userIds } }),
    HealthProfile.countDocuments({ user: { $in: userIds } }),
    Dependent.countDocuments({ owner: { $in: userIds } }),
  ]);
  return {
    users: userIds.length, healthProfiles: profiles, dependents: deps,
    sessions, medications: meds, emergencyContacts: contacts, photoLogs: photos,
  };
}

async function runCli() {
  const confirmed = process.argv.includes('--confirm') || process.argv.includes('--yes');

  await mongoose.connect(process.env.MONGO_URI);
  const seedUsers = await User.find({ email: { $regex: `@${SEED_EMAIL_DOMAIN}$` } }).select('_id');
  const userIds = seedUsers.map((u) => u._id);

  if (userIds.length === 0) {
    console.log(`No seed users found on @${SEED_EMAIL_DOMAIN} — nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const counts = await countByUserIds(userIds);
  console.log(`Found ${userIds.length} seed user(s) on @${SEED_EMAIL_DOMAIN}:`);
  console.log(counts);

  if (!confirmed) {
    console.log('\nDry run only — nothing deleted. Re-run with --confirm to actually delete this data.');
    await mongoose.disconnect();
    return;
  }

  console.log('\n--confirm passed — deleting now...');
  const result = await clearByUserIds(userIds);
  console.log('Deleted:', result);
  await mongoose.disconnect();
}

module.exports = { clearByUserIds, countByUserIds, SEED_EMAIL_DOMAIN };

if (require.main === module) {
  runCli().catch((err) => { console.error(err); process.exit(1); });
}
