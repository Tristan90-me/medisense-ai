module.exports = {
  testEnvironment: 'node',
  // Set safe env vars before anything (app.js, models, etc.) gets required.
  setupFiles: ['<rootDir>/tests/env.setup.js'],
  // Spin up / tear down the in-memory MongoDB and clear collections between tests.
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // mongodb-memory-server's first binary download/boot can be slow (a ~270MB
  // one-time download) — 30s was too tight and caused every beforeAll to
  // time out before the download finished. Only the very first run on a
  // machine pays this cost; once cached, hooks resolve in a couple seconds.
  testTimeout: 180000,
  verbose: true,
  clearMocks: true,
};
