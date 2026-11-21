import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app.js';
import ContactMessage from '../models/ContactMessage.js';
import User from '../models/User.js';

const submitted = {
  name: ' Support Tester ',
  email: 'tester@example.test',
  topic: 'Using a tool',
  message: ' A test message. '
};

function mockConnectedMessageStore(context) {
  const original = ContactMessage.db;
  ContactMessage.db = { readyState: 1 };
  context.after(() => { ContactMessage.db = original; });
}

test('a guest can send a validated contact message with CSRF protection', async (context) => {
  mockConnectedMessageStore(context);
  const create = context.mock.method(ContactMessage, 'create', async () => {});
  const guest = request.agent(app);
  await guest.post('/api/contact').send(submitted).expect(403);
  const { body: { data: { csrfToken } } } = await guest.get('/api/auth/csrf').expect(200);

  await guest.post('/api/contact').set('X-CSRF-Token', csrfToken).send({ ...submitted, message: '    ' }).expect(400);
  await guest.post('/api/contact').set('X-CSRF-Token', csrfToken).send({ ...submitted, role: 'admin' }).expect(201, { success: true });
  assert.equal(create.mock.callCount(), 1);
  assert.deepEqual(create.mock.calls[0].arguments[0], {
    name: 'Support Tester',
    email: submitted.email,
    topic: submitted.topic,
    message: 'A test message.'
  });
});

test('the contact inbox is restricted to administrators and paginates the stored messages', async (context) => {
  const message = { _id: 'oldest-message', ...submitted, createdAt: '2026-11-20T10:00:00.000Z' };
  const accounts = { admin: { role: 'admin', emailVerified: true }, user: { role: 'user', emailVerified: true } };
  mockConnectedMessageStore(context);
  context.mock.method(jwt, 'verify', (token) => ({ id: token, sessionVersion: 0 }));
  context.mock.method(User, 'findById', (id) => ({ select: async () => accounts[id] }));
  const count = context.mock.method(ContactMessage, 'countDocuments', async () => 21);
  context.mock.method(ContactMessage, 'find', () => ({
    select() { return this; },
    sort(order) {
      assert.deepEqual(order, { createdAt: -1, _id: -1 });
      return this;
    },
    skip(offset) {
      assert.equal(offset, 20);
      return this;
    },
    limit(size) {
      assert.equal(size, 20);
      return this;
    },
    lean: async () => [message]
  }));

  await request(app).get('/api/admin/messages').expect(401);
  await request(app).get('/api/admin/messages').set('Authorization', 'Bearer user').expect(403);
  assert.equal(count.mock.callCount(), 0);
  await request(app).get('/api/admin/messages?page=2').set('Authorization', 'Bearer admin').expect('Cache-Control', 'no-store')
    .expect(200, { success: true, data: { items: [message], page: 2, pages: 2, total: 21 } });
});
