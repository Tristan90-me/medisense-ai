// Global DB lifecycle for every test file (wired via jest.config.js's
// setupFilesAfterEnv). Each test file gets its own isolated in-memory
// MongoDB instance — never the real MongoDB Atlas cluster from .env.
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  // Clear all collections between tests so state doesn't leak across tests.
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});
