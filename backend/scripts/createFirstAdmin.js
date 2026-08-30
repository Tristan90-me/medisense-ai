// One-time CLI bootstrap for the very first admin account. Not exposed as an
// API route on purpose — admin provisioning after this point goes through
// the invite flow (adminController.inviteAdmin), which requires an existing
// admin to send the invite. This script exists only to break that
// chicken-and-egg problem on a fresh system.
//
// Usage:
//   node scripts/createFirstAdmin.js --name "Jane Doe" --email jane@example.com --password "min6chars"
//   node scripts/createFirstAdmin.js --name "..." --email "..." --password "..." --force   (allow creating another admin)

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      if (key === 'force') {
        args.force = true;
      } else {
        args[key] = argv[i + 1];
        i++;
      }
    }
  }
  return args;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const name = args.name;
  const email = args.email;
  const password = args.password;
  const force = !!args.force;

  if (!name || !email || !password) {
    console.error('Usage: node scripts/createFirstAdmin.js --name "Jane Doe" --email jane@example.com --password "min6chars" [--force]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const existingAdminCount = await User.countDocuments({ role: 'admin' });
    if (existingAdminCount > 0 && !force) {
      console.error(`Refusing to run: ${existingAdminCount} admin account(s) already exist. Use the in-app invite flow, or pass --force to create another via this script anyway.`);
      process.exit(1);
    }

    if (await User.findOne({ email })) {
      console.error('A user with that email already exists.');
      process.exit(1);
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'admin',
      isEmailVerified: true, // no inviter to send a verification email from; running this script is already a trusted action
    });

    console.log(`Admin created: ${user.email} (${user._id})`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
