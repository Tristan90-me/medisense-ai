// Thin GridFS helper for storing photo bytes. Deliberately not S3 —
// locked decision per the roadmap plan. The bucket is constructed lazily
// inside each function (never at module load time) because
// mongoose.connection.db only exists once mongoose.connect() has resolved,
// which it always has by the time a request handler runs, but is not
// guaranteed at require()-time (e.g. when a test file requires this module
// before tests/setup.js's beforeAll connects).
//
// `bucketName` defaults to 'photos' (symptom photos, the original caller)
// so every existing call site is unaffected; other features (e.g. progress
// photos) pass their own bucket name to keep their files in a separate
// GridFS bucket rather than commingling with symptom photos.
const mongoose = require('mongoose');
const { Readable } = require('stream');

const getBucket = (bucketName = 'photos') => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });

// Uploads a Buffer to GridFS and resolves with the new file's ObjectId.
const uploadBuffer = (buffer, filename, contentType, bucketName = 'photos') => new Promise((resolve, reject) => {
  const bucket = getBucket(bucketName);
  const uploadStream = bucket.openUploadStream(filename, { contentType });
  uploadStream.on('error', reject);
  uploadStream.on('finish', () => resolve(uploadStream.id));
  Readable.from(buffer).pipe(uploadStream);
});

// Deletes a GridFS file by id. Swallows a "file not found" error so cleanup
// callers (e.g. deletePhoto) stay idempotent — deleting something already
// gone is not a failure.
const deleteFile = async (fileId, bucketName = 'photos') => {
  const bucket = getBucket(bucketName);
  try {
    await bucket.delete(fileId);
  } catch (err) {
    if (/file.*not found/i.test(err.message)) return;
    throw err;
  }
};

module.exports = { getBucket, uploadBuffer, deleteFile };
