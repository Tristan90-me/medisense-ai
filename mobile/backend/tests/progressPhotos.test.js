// Integration tests for /api/progress-photos (routes/progressPhotos.js ->
// controllers/progressPhotoController.js). GridFS storage is exercised for
// real against the in-memory MongoDB — same convention as tests/photoLog.test.js,
// but no Gemini mock needed since this controller never calls analyzePhoto.
const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const ProgressPhoto = require('../models/ProgressPhoto');

async function createUser(overrides = {}) {
  return User.create({
    name: 'Test User',
    email: `user-${Date.now()}-${Math.random()}@example.com`,
    password: 'userpass123',
    role: 'user',
    isEmailVerified: true,
    ...overrides,
  });
}

const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

const FAKE_JPEG = Buffer.from('fake-jpeg-bytes-not-a-real-image-but-nothing-decodes-it-server-side');

describe('POST /api/progress-photos', () => {
  test('uploads a progress photo', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/progress-photos')
      .set(auth(user))
      .field('caption', 'Week 1')
      .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.progressPhoto).toMatchObject({ caption: 'Week 1', mimeType: 'image/jpeg' });
    expect(res.body.progressPhoto.imageBuffer).toBeUndefined();
  });

  test('rejects a non-image file', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/progress-photos')
      .set(auth(user))
      .attach('photo', Buffer.from('just some text'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });

  test('requires a file', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/progress-photos').set(auth(user)).field('caption', 'No file');
    expect(res.status).toBe(400);
  });

  test("404s uploading against someone else's dependent", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const kid = await Dependent.create({ owner: owner._id, name: 'Kiddo', relationship: 'child' });

    const res = await request(app)
      .post('/api/progress-photos')
      .set(auth(intruder))
      .field('dependent', String(kid._id))
      .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/progress-photos/:id/image', () => {
  test('streams back the exact original bytes with the right Content-Type', async () => {
    const user = await createUser();
    const upload = await request(app)
      .post('/api/progress-photos')
      .set(auth(user))
      .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });
    const id = upload.body.progressPhoto._id;

    const imageRes = await request(app)
      .get(`/api/progress-photos/${id}/image`)
      .set(auth(user))
      .buffer()
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(imageRes.status).toBe(200);
    expect(imageRes.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(imageRes.body, FAKE_JPEG)).toBe(0);
  });

  test("404s reading someone else's photo image", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const upload = await request(app)
      .post('/api/progress-photos')
      .set(auth(owner))
      .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

    const res = await request(app).get(`/api/progress-photos/${upload.body.progressPhoto._id}/image`).set(auth(intruder));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/progress-photos', () => {
  test('lists only the requester\'s own photos', async () => {
    const user = await createUser();
    const other = await createUser();
    await request(app).post('/api/progress-photos').set(auth(user)).attach('photo', FAKE_JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
    await request(app).post('/api/progress-photos').set(auth(other)).attach('photo', FAKE_JPEG, { filename: 'b.jpg', contentType: 'image/jpeg' });

    const res = await request(app).get('/api/progress-photos').set(auth(user));
    expect(res.body.progressPhotos).toHaveLength(1);
  });
});

describe('DELETE /api/progress-photos/:id', () => {
  test('deletes the metadata row and the underlying GridFS file', async () => {
    const user = await createUser();
    const upload = await request(app)
      .post('/api/progress-photos')
      .set(auth(user))
      .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });
    const id = upload.body.progressPhoto._id;

    const res = await request(app).delete(`/api/progress-photos/${id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(await ProgressPhoto.findById(id)).toBeNull();

    const imageRes = await request(app).get(`/api/progress-photos/${id}/image`).set(auth(user));
    expect(imageRes.status).toBe(404);
  });

  test("404s deleting someone else's photo", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const upload = await request(app)
      .post('/api/progress-photos')
      .set(auth(owner))
      .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

    const res = await request(app).delete(`/api/progress-photos/${upload.body.progressPhoto._id}`).set(auth(intruder));
    expect(res.status).toBe(404);
    expect(await ProgressPhoto.findById(upload.body.progressPhoto._id)).not.toBeNull();
  });
});
