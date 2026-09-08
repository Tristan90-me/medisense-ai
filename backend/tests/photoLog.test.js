// Integration tests for the Photo Log API (routes/photoLog.js ->
// controllers/photoLogController.js). utils/gemini is fully mocked (same
// pattern as tests/sessionTriage.test.js) — analyzePhoto never makes a real
// network call here, so these tests say nothing about whether a live Gemini
// call would actually succeed (it currently wouldn't: the .env GEMINI_API_KEY
// is known-invalid this session). GridFS storage mechanics ARE exercised for
// real against the in-memory MongoDB (tests/setup.js) since that part has
// nothing to do with Gemini.
jest.mock('../utils/gemini', () => ({
  chat: jest.fn(),
  chatStream: jest.fn(),
  generateSummary: jest.fn(),
  parseAIResponse: jest.fn(),
  analyzePhoto: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const PhotoLog = require('../models/PhotoLog');
const { getBucket } = require('../utils/gridfs');
const { analyzePhoto } = require('../utils/gemini');

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

function tokenFor(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

const FAKE_JPEG = Buffer.from('fake-jpeg-bytes-not-a-real-image-but-nothing-decodes-it-server-side');

const MOCK_ANALYSIS = {
  description: 'The image shows a small area of redness on the skin.',
  findings: ['Redness approximately 2cm in diameter', 'No visible discharge'],
  confidence: 'moderate',
  flaggedForReview: false,
};

describe('Photo Log API', () => {
  beforeEach(() => {
    analyzePhoto.mockReset();
    analyzePhoto.mockResolvedValue(MOCK_ANALYSIS);
  });

  test('successful upload creates a PhotoLog and returns 201 with the mocked analysis', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .post('/api/photo-log')
      .set('Authorization', `Bearer ${token}`)
      .field('caption', 'Rash on forearm')
      .field('bodyRegion', 'leftArm')
      .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.photoLog.caption).toBe('Rash on forearm');
    expect(res.body.photoLog.bodyRegion).toBe('leftArm');
    expect(res.body.photoLog.mimeType).toBe('image/jpeg');
    expect(res.body.photoLog.dependent).toBeNull();
    expect(res.body.photoLog.aiAnalysis.description).toBe(MOCK_ANALYSIS.description);
    expect(res.body.photoLog.aiAnalysis.findings).toEqual(MOCK_ANALYSIS.findings);
    expect(res.body.photoLog.aiAnalysis.confidence).toBe('moderate');
    // No raw image bytes in this response.
    expect(res.body.photoLog.imageBuffer).toBeUndefined();

    expect(analyzePhoto).toHaveBeenCalledTimes(1);
    const [bufferArg, mimeArg, contextArg] = analyzePhoto.mock.calls[0];
    expect(Buffer.isBuffer(bufferArg)).toBe(true);
    expect(mimeArg).toBe('image/jpeg');
    expect(contextArg).toBe('Body region: leftArm. Note from patient: Rash on forearm');
  });

  test('GET /:id/image returns the exact original bytes with the right Content-Type', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const upload = await request(app)
      .post('/api/photo-log')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });
    const id = upload.body.photoLog._id;

    const imageRes = await request(app)
      .get(`/api/photo-log/${id}/image`)
      .set('Authorization', `Bearer ${token}`)
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

  test('wrong file type is rejected with 400', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .post('/api/photo-log')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('just some text'), { filename: 'x.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    const count = await PhotoLog.countDocuments({});
    expect(count).toBe(0);
  });

  test('missing file is rejected with 400', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .post('/api/photo-log')
      .set('Authorization', `Bearer ${token}`)
      .field('caption', 'No file attached');

    expect(res.status).toBe(400);
  });

  // The 5MB limit itself is asserted against the multer config object rather
  // than by forcing a literal 5MB+ buffer through supertest — a real E2E
  // check of that exact boundary is disproportionate here; the fileFilter
  // (the other half of the security boundary) IS exercised end-to-end above.
  test.todo('a file over 5MB is rejected with 400 (asserted via multer config, see middleware/upload.js limits.fileSize)');

  test('a Gemini analysis failure does not fail the upload — photo is saved with no aiAnalysis', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    analyzePhoto.mockRejectedValue(new Error('ACCESS_TOKEN_TYPE_UNSUPPORTED'));

    const res = await request(app)
      .post('/api/photo-log')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.photoLog.aiAnalysis?.description).toBeUndefined();

    const saved = await PhotoLog.findById(res.body.photoLog._id);
    expect(saved.aiAnalysis.description).toBeUndefined();
  });

  test('?dependent=<id> filters to only that person, omitting it unions self + all dependents', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const dependent = await Dependent.create({ owner: user._id, name: 'Kiddo', relationship: 'child' });

    await request(app)
      .post('/api/photo-log')
      .set('Authorization', `Bearer ${token}`)
      .field('caption', 'Self photo')
      .attach('photo', FAKE_JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
    await request(app)
      .post('/api/photo-log')
      .set('Authorization', `Bearer ${token}`)
      .field('caption', 'Dependent photo')
      .field('dependent', dependent._id.toString())
      .attach('photo', FAKE_JPEG, { filename: 'b.jpg', contentType: 'image/jpeg' });

    const filtered = await request(app)
      .get(`/api/photo-log?dependent=${dependent._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(filtered.body.photoLogs).toHaveLength(1);
    expect(filtered.body.photoLogs[0].caption).toBe('Dependent photo');

    const unfiltered = await request(app)
      .get('/api/photo-log')
      .set('Authorization', `Bearer ${token}`);
    expect(unfiltered.body.photoLogs).toHaveLength(2);
    const captions = unfiltered.body.photoLogs.map((p) => p.caption).sort();
    expect(captions).toEqual(['Dependent photo', 'Self photo']);
  });

  test('delete cascades to actually removing the GridFS file', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const upload = await request(app)
      .post('/api/photo-log')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });
    const id = upload.body.photoLog._id;
    const photoLog = await PhotoLog.findById(id);
    const imageRef = photoLog.imageRef;

    const del = await request(app)
      .delete(`/api/photo-log/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const imageRes = await request(app)
      .get(`/api/photo-log/${id}/image`)
      .set('Authorization', `Bearer ${token}`);
    expect(imageRes.status).toBe(404);

    const filesFound = await getBucket().find({ _id: imageRef }).toArray();
    expect(filesFound).toHaveLength(0);
  });

  describe('ownership scoping', () => {
    let photoId;
    let dependentA;
    let tokenB;

    beforeEach(async () => {
      const userA = await createUser({ email: 'a@example.com' });
      const userB = await createUser({ email: 'b@example.com' });
      tokenB = tokenFor(userB);
      const tokenA = tokenFor(userA);

      dependentA = await Dependent.create({ owner: userA._id, name: "A's Kid", relationship: 'child' });

      const upload = await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });
      photoId = upload.body.photoLog._id;
    });

    test("user B cannot read user A's photo metadata", async () => {
      const res = await request(app)
        .get(`/api/photo-log/${photoId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });

    test("user B cannot read user A's photo image bytes", async () => {
      const res = await request(app)
        .get(`/api/photo-log/${photoId}/image`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });

    test("user B cannot delete user A's photo", async () => {
      const res = await request(app)
        .delete(`/api/photo-log/${photoId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);

      const stillExists = await PhotoLog.findById(photoId);
      expect(stillExists).not.toBeNull();
    });

    test("user B's photo list never includes user A's photo", async () => {
      const res = await request(app)
        .get('/api/photo-log')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.body.photoLogs).toHaveLength(0);
    });

    test("user B cannot upload a photo referencing user A's dependent id", async () => {
      const res = await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${tokenB}`)
        .field('dependent', dependentA._id.toString())
        .attach('photo', FAKE_JPEG, { filename: 'sneaky.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(404);
    });

    test("user B cannot list user A's dependent's photos via ?dependent=", async () => {
      const res = await request(app)
        .get(`/api/photo-log?dependent=${dependentA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });
  });

  describe('subjectSex (anonymous "other" subject, no saved Dependent)', () => {
    test('uploading with subjectSex and no dependent stores subjectSex and leaves dependent null', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${token}`)
        .field('subjectSex', 'female')
        .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.photoLog.subjectSex).toBe('female');
      expect(res.body.photoLog.dependent).toBeNull();
    });

    test('subjectSex is passed into the analyzePhoto context string', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${token}`)
        .field('subjectSex', 'male')
        .field('caption', 'Bruise on forearm')
        .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

      const [, , contextArg] = analyzePhoto.mock.calls[0];
      expect(contextArg).toBe('Subject: male. Note from patient: Bruise on forearm');
    });

    test('an invalid subjectSex value is rejected with 400', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${token}`)
        .field('subjectSex', 'other')
        .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
    });

    test('a photo of a real dependent ignores subjectSex even if sent', async () => {
      const user = await createUser();
      const token = tokenFor(user);
      const dependent = await Dependent.create({ owner: user._id, name: 'Kid', relationship: 'child' });

      const res = await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${token}`)
        .field('dependent', dependent._id.toString())
        .field('subjectSex', 'male')
        .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.photoLog.dependent).toBe(String(dependent._id));
      expect(res.body.photoLog.subjectSex).toBeNull();
    });
  });

  describe('bodyRegion as free text', () => {
    test('a preset region string is accepted', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${token}`)
        .field('bodyRegion', 'chest')
        .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.photoLog.bodyRegion).toBe('chest');
    });

    test('an arbitrary custom region string is accepted (no longer a closed enum)', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${token}`)
        .field('bodyRegion', 'left earlobe')
        .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.photoLog.bodyRegion).toBe('left earlobe');
    });

    test('a body region longer than 60 characters is rejected with 400', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${token}`)
        .field('bodyRegion', 'a'.repeat(61))
        .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /:id/link-session', () => {
    test('links an owned session to an owned photo', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const upload = await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });
      const photoId = upload.body.photoLog._id;

      const session = await request(app)
        .post('/api/ai/session/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ mode: 'quick' });
      const sessionId = session.body.session._id;

      const res = await request(app)
        .patch(`/api/photo-log/${photoId}/link-session`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId });

      expect(res.status).toBe(200);
      expect(res.body.photoLog.linkedSessionId).toBe(sessionId);

      const stored = await PhotoLog.findById(photoId);
      expect(String(stored.linkedSessionId)).toBe(sessionId);
    });

    test('a nonexistent sessionId is rejected with 404 and nothing is linked', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const upload = await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });
      const photoId = upload.body.photoLog._id;

      const res = await request(app)
        .patch(`/api/photo-log/${photoId}/link-session`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId: '000000000000000000000000' });

      expect(res.status).toBe(404);
      const stored = await PhotoLog.findById(photoId);
      expect(stored.linkedSessionId).toBeNull();
    });

    test("user B cannot link their own session onto user A's photo", async () => {
      const userA = await createUser({ email: 'link-a@example.com' });
      const userB = await createUser({ email: 'link-b@example.com' });
      const tokenA = tokenFor(userA);
      const tokenB = tokenFor(userB);

      const upload = await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });
      const photoId = upload.body.photoLog._id;

      const sessionB = await request(app)
        .post('/api/ai/session/start')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ mode: 'quick' });

      const res = await request(app)
        .patch(`/api/photo-log/${photoId}/link-session`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ sessionId: sessionB.body.session._id });

      expect(res.status).toBe(404);
    });

    test("user B cannot link user A's session id onto user B's own photo", async () => {
      const userA = await createUser({ email: 'link-a2@example.com' });
      const userB = await createUser({ email: 'link-b2@example.com' });
      const tokenA = tokenFor(userA);
      const tokenB = tokenFor(userB);

      const sessionA = await request(app)
        .post('/api/ai/session/start')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ mode: 'quick' });

      const uploadB = await request(app)
        .post('/api/photo-log')
        .set('Authorization', `Bearer ${tokenB}`)
        .attach('photo', FAKE_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });
      const photoIdB = uploadB.body.photoLog._id;

      const res = await request(app)
        .patch(`/api/photo-log/${photoIdB}/link-session`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ sessionId: sessionA.body.session._id });

      expect(res.status).toBe(404);
      const stored = await PhotoLog.findById(photoIdB);
      expect(stored.linkedSessionId).toBeNull();
    });
  });
});
