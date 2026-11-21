import test from 'node:test';
import assert from 'node:assert/strict';
import mammoth from 'mammoth';
import request from 'supertest';
import app from '../app.js';
import { validateTree, cleanSettings } from '../controllers/wordDocumentController.js';
import { wordJsonToDocx } from '../services/wordDocumentService.js';

const paragraph = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

test('validates document trees and safe embedded images', () => {
  assert.doesNotThrow(() => validateTree({ type: 'doc', content: [paragraph('Hello'), { type: 'image', attrs: { src: 'data:image/png;base64,AAAA' } }] }));
  assert.throws(() => validateTree({ type: 'doc', content: [{ type: 'image', attrs: { src: 'https://example.com/image.png' } }] }), /embedded PNG or JPEG/);
  assert.throws(() => validateTree({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }), /link is invalid/);
  assert.throws(() => validateTree({ type: 'paragraph', content: [] }), /content is invalid/);
});

test('validates paper settings and rejects unsafe margin ranges', () => {
  assert.deepEqual(cleanSettings({ pageSize: 'letter', orientation: 'landscape', margins: { top: 15 } }), {
    pageSize: 'letter', orientation: 'landscape', margins: { top: 15, right: 20, bottom: 20, left: 20 },
    header: '', footer: '', pageNumbers: true, pageColor: '#ffffff'
  });
  assert.throws(() => cleanSettings({ margins: { left: 2 } }), /between 5 and 60/);
  assert.throws(() => cleanSettings({ pageSize: 'legal' }), /Choose A4 or Letter/);
});

test('exports formatted document content, headings, lists, and tables to DOCX', async () => {
  const content = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Project plan' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'A bold sentence', marks: [{ type: 'bold' }] }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('First item')] }] },
    { type: 'table', content: [{ type: 'tableRow', content: [
      { type: 'tableHeader', content: [paragraph('Name')] },
      { type: 'tableCell', content: [paragraph('Arun')] }
    ] }] }
  ] };
  const buffer = await wordJsonToDocx({ title: 'Test', content, settings: { pageSize: 'a4', orientation: 'portrait', margins: { top: 20, right: 20, bottom: 20, left: 20 }, pageNumbers: true } });
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000);
  const html = await mammoth.convertToHtml({ buffer });
  assert.match(html.value, /<h1>Project plan<\/h1>/);
  assert.match(html.value, /A bold sentence/);
  assert.match(html.value, /First item/);
  assert.match(html.value, /<table>/);
});

test('embeds supported document images in DOCX exports', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/yD8AAAAASUVORK5CYII=';
  const buffer = await wordJsonToDocx({
    content: { type: 'doc', content: [{ type: 'image', attrs: { src: `data:image/png;base64,${png}`, width: 80, height: 60 } }] },
    settings: { pageSize: 'a4', orientation: 'portrait', margins: { top: 20, right: 20, bottom: 20, left: 20 } }
  });
  assert.ok(buffer.length > 1000);
});

test('document APIs require an authenticated account', async () => {
  await request(app).get('/api/documents').expect(401);
  await request(app).get('/api/documents/0123456789abcdef01234567').expect(401);
  await request(app).post('/api/documents').send({ title: 'Private document' }).expect(401);
});
