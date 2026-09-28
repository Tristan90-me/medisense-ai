// Runs before the test framework is installed and before any test file
// requires app.js / models — so every env var the app code reads (at module
// load time or lazily at call time) is guaranteed to already have a safe
// test value. None of these point at real services: MONGO_URI itself isn't
// even needed here because tests connect mongoose directly to the in-memory
// server (see tests/setup.js), never to config/db.js's real Atlas URI.
process.env.NODE_ENV = 'test';

process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';
process.env.JWT_EXPIRE = '1h';

process.env.CLIENT_URL = 'http://localhost:5173';

// Nodemailer transport target — never actually used because utils/email.js
// is mocked in every test file that touches a route which sends email.
process.env.EMAIL_HOST = 'smtp.test.local';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USER = 'test@test.local';
process.env.EMAIL_PASS = 'test-pass';
process.env.EMAIL_FROM = 'MediSense AI <test@medisense.local>';

// utils/gemini.js constructs a GoogleGenAI client at module-load time (when
// routes/ai.js -> controllers/aiController.js -> utils/gemini.js gets
// required via app.js). The constructor doesn't make a network call and
// doesn't throw without a key, but set a dummy value to keep it quiet.
process.env.GEMINI_API_KEY = 'test-gemini-key';
