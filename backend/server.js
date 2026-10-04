require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');

// CLIENT_URL has no fallback where it's used (CORS allowlist, verification/
// invite email links) — if it's missing in production, those emails would
// silently contain the literal string "undefined" instead of a real link.
if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_URL) {
  console.warn('WARNING: CLIENT_URL is not set — CORS and email links (verification, admin invite) will be broken.');
}

connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`));
