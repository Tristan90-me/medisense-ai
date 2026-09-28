// Pure storage-mechanics tests for utils/gridfs.js against the isolated
// mongodb-memory-server (tests/setup.js) — real GridFS behavior, nothing to
// mock here since none of this touches Gemini.
const mongoose = require('mongoose');
const { uploadBuffer, deleteFile, getBucket } = require('../utils/gridfs');

describe('GridFS helper', () => {
  test('uploads a buffer and downloads back the identical bytes', async () => {
    const original = Buffer.from('hello gridfs, this is a fake image payload');
    const fileId = await uploadBuffer(original, 'test.jpg', 'image/jpeg');
    expect(mongoose.isValidObjectId(fileId)).toBe(true);

    const chunks = [];
    const downloadStream = getBucket().openDownloadStream(fileId);
    await new Promise((resolve, reject) => {
      downloadStream.on('data', (chunk) => chunks.push(chunk));
      downloadStream.on('end', resolve);
      downloadStream.on('error', reject);
    });

    const downloaded = Buffer.concat(chunks);
    expect(downloaded.equals(original)).toBe(true);
  });

  test('deleting a file makes a subsequent download error/reject', async () => {
    const fileId = await uploadBuffer(Buffer.from('to be deleted'), 'gone.jpg', 'image/jpeg');
    await deleteFile(fileId);

    await expect(new Promise((resolve, reject) => {
      const downloadStream = getBucket().openDownloadStream(fileId);
      downloadStream.on('data', () => {});
      downloadStream.on('end', resolve);
      downloadStream.on('error', reject);
    })).rejects.toThrow();
  });

  test('deleting a nonexistent id is idempotent and does not throw', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await expect(deleteFile(fakeId)).resolves.toBeUndefined();
  });
});
