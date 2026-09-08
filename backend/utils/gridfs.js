// Thin GridFS helper for storing symptom-photo bytes (bucket: 'photos').
// Deliberately not S3 — locked decision per the roadmap plan. The bucket is
// constructed lazily inside each function (never at module load time)
// because mongoose.connection.db only exists once mongoose.connect() has
// resolved, which it always has by the time a request handler runs, but is
// not guaranteed at require()-time (e.g. when a test file requires this
// module before tests/setup.js's beforeAll connects).
const mongoose = require('mongoose');
const { Readable } = require('stream');

const getBucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'photos' });

// Uploads a Buffer to GridFS and resolves with the new file's ObjectId.
const uploadBuffer = (buffer, filename, contentType) => new Promise((resolve, reject) => {
  const bucket = getBucket();
  const uploadStream = bucket.openUploadStream(filename, { contentType });
  uploadStream.on('error', reject);
  uploadStream.on('finish', () => resolve(uploadStream.id));
  Readable.from(buffer).pipe(uploadStream);
});

// Deletes a GridFS file by id. Swallows a "file not found" error so cleanup
// callers (e.g. deletePhoto) stay idempotent — deleting something already
// gone is not a failure.
const deleteFile = async (fileId) => {
  const bucket = getBucket();
  try {
    await bucket.delete(fileId);
  } catch (err) {
    if (/file.*not found/i.test(err.message)) return;
    throw err;
  }
};

module.exports = { getBucket, uploadBuffer, deleteFile };
