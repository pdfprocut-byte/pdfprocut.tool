import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';

test('a guest can check session state while the account endpoint requires sign-in', async () => {
  await request(app)
    .get('/api/auth/session')
    .expect('Cache-Control', 'no-store')
    .expect(200, { success: true, data: { user: null } });

  await request(app).get('/api/auth/me').expect(401);
});

test('a signed-in session exposes only the public account fields', async (context) => {
  const user = {
    _id: 'session-test-user',
    name: 'Session Test',
    email: 'session@example.test',
    role: 'user',
    emailVerified: true,
    sessionVersion: 2,
    password: 'test-password-hash'
  };
  context.mock.method(jwt, 'verify', () => ({ id: user._id, sessionVersion: 2 }));
  context.mock.method(User, 'findById', () => ({ select: async () => user }));

  const response = await request(app)
    .get('/api/auth/session')
    .set('Authorization', 'Bearer session-test')
    .expect('Cache-Control', 'no-store')
    .expect(200);

  assert.deepEqual(response.body.data.user, {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: '',
    profession: '',
    age: null,
    country: '',
    profilePhoto: '',
    role: 'user',
    emailVerified: true
  });
});
