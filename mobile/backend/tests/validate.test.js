// Isolated unit tests for the validate() middleware factory itself
// (middleware/validate.js), using a tiny throwaway express app and a small
// express-validator rule array instead of exercising it only indirectly
// through the full auth routes.
const express = require('express');
const request = require('supertest');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

function buildTestApp(rules) {
  const app = express();
  app.use(express.json());
  app.post(
    '/test',
    validate(rules),
    (req, res) => res.status(200).json({ success: true, received: req.body })
  );
  return app;
}

const rules = [
  body('email').isEmail().withMessage('A valid email is required'),
  body('age').isInt({ min: 18 }).withMessage('Age must be at least 18'),
];

describe('validate() middleware', () => {
  test('calls next() and reaches the route handler when all rules pass', async () => {
    const app = buildTestApp(rules);
    const res = await request(app).post('/test').send({ email: 'a@b.com', age: 21 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, received: { email: 'a@b.com', age: 21 } });
  });

  test('short-circuits with 400 on the first failing rule, without reaching the route handler', async () => {
    const app = buildTestApp(rules);
    const res = await request(app).post('/test').send({ email: 'not-an-email', age: 21 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('A valid email is required');
  });

  test('collects every failing field into the errors array, not just the first', async () => {
    const app = buildTestApp(rules);
    const res = await request(app).post('/test').send({ email: 'not-an-email', age: 10 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { field: 'email', message: 'A valid email is required' },
        { field: 'age', message: 'Age must be at least 18' },
      ])
    );
    expect(res.body.errors.length).toBe(2);
  });

  test('the response shape is always {success:false, message, errors} on failure', async () => {
    const app = buildTestApp(rules);
    const res = await request(app).post('/test').send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.any(String),
        errors: expect.any(Array),
      })
    );
  });

  test('an empty rules array always calls next() regardless of body content', async () => {
    const app = buildTestApp([]);
    const res = await request(app).post('/test').send({ anything: 'goes' });

    expect(res.status).toBe(200);
    expect(res.body.received).toEqual({ anything: 'goes' });
  });
});
