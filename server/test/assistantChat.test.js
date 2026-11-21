import assert from 'node:assert/strict';
import test from 'node:test';
import { chatWithAssistant } from '../controllers/assistantController.js';
import { toolCatalog } from '../../shared/toolCatalog.mjs';

async function ask(question, options = {}) {
  const response = { status: 200, headers: {} };
  const res = {
    set(name, value) { response.headers[name] = value; return this; },
    status(code) { response.status = code; return this; },
    json(body) { response.body = body; return this; }
  };
  await chatWithAssistant({ body: { question, ...options } }, res, (error) => { throw error; });
  return response;
}

for (const [question, slug] of [
  ['merge', 'merge-pdf'],
  ['rotate all pages', 'rotate-pdf'],
  ['remove every blank page', 'remove-pages'],
  ['unlock pdf', 'unlock-pdf'],
  ['lock pdf', 'protect-pdf'],
  ['PDF to Word', 'pdf-to-document'],
  ['Word to PDF', 'word-to-pdf'],
  ['DOCX to PDF', 'word-to-pdf'],
  ['PDF to PPT', 'pdf-to-powerpoint'],
  ['PPT to PDF', 'powerpoint-to-pdf'],
  ['PDF to image', 'pdf-to-jpg'],
  ['JPG to PDF', 'convert-to-pdf'],
  ['reduce PDF size', 'compress-files'],
  ['reduce photo size', 'compress-image'],
  ['image size kurakkan', 'compress-image'],
  ['How do I search a scanned PDF?', 'ocr-pdf']
]) {
  test(`the assistant selects the intended tool for "${question}"`, async () => {
    const { body, headers } = await ask(question);
    assert.equal(body.success, true);
    assert.match(body.data.answer, new RegExp(`Open: /tools/${slug}(?: |$)`));
    assert.equal(headers['Cache-Control'], 'no-store');
  });
}

test('a new topic takes priority over previous questions and the open tool page', async () => {
  const { body } = await ask('compress image', {
    currentPath: '/tools/merge-pdf',
    history: [
      { role: 'user', content: 'How do I merge and combine PDFs?' },
      { role: 'user', content: 'Can I join PDFs together?' }
    ]
  });
  assert.match(body.data.answer, /Open: \/tools\/compress-image /);
  assert.doesNotMatch(body.data.answer, /\/tools\/merge-pdf/);
});

for (const question of ['hello', 'clock', 'design', 'something unrelated', 'it is raining', 'how do I sign in?']) {
  test(`"${question}" does not recommend a tool just because its page is open`, async () => {
    const { body } = await ask(question, { currentPath: '/tools/protect-pdf' });
    assert.doesNotMatch(body.data.answer, /For this, use|Open: \/tools\//);
  });
}

test('every catalog tool remains discoverable by its name', async () => {
  for (const { name, slug } of toolCatalog) {
    const { body } = await ask(name);
    assert.match(body.data.answer, new RegExp(`Open: /tools/${slug}(?: |$)`), name);
  }
});

for (const question of ['word', 'image', 'password', 'compress', 'convert']) {
  test(`"${question}" asks for clarification instead of guessing a tool`, async () => {
    const { body } = await ask(question);
    assert.match(body.data.answer, /\?/);
    assert.doesNotMatch(body.data.answer, /For this, use|Open: \/tools\//);
  });
}

test('a short follow-up can use the previous tool without leaking it into a new topic', async () => {
  const { body } = await ask('tell me more', {
    history: [{ role: 'user', content: 'merge pdf' }]
  });
  assert.match(body.data.answer, /Open: \/tools\/merge-pdf /);
});

test('a follow-up about this tool can use the open page', async () => {
  const { body } = await ask('how does this tool work?', { currentPath: '/tools/rotate-pdf' });
  assert.match(body.data.answer, /Open: \/tools\/rotate-pdf /);
});

test('a file-type reply can resolve an ambiguous compression question', async () => {
  const { body } = await ask('image', { history: [{ role: 'user', content: 'compress' }] });
  assert.match(body.data.answer, /Open: \/tools\/compress-image /);
});

test('an unrelated short message does not reuse a previous tool', async () => {
  const { body } = await ask('hello', { history: [{ role: 'user', content: 'merge pdf' }] });
  assert.doesNotMatch(body.data.answer, /Open: \/tools\/merge-pdf/);
});

test('an unresolved previous question does not pick up an unrelated open tool', async () => {
  const { body } = await ask('how do I use it?', {
    currentPath: '/tools/merge-pdf',
    history: [{ role: 'user', content: 'compress' }]
  });
  assert.doesNotMatch(body.data.answer, /Open: \/tools\/merge-pdf/);
  assert.match(body.data.answer, /\?/);
});

for (const question of ['list all tools', 'what can you do?', 'ella tools enthaanu?']) {
  test(`"${question}" still lists the available tools`, async () => {
    const { body } = await ask(question);
    assert.match(body.data.answer, /Organize PDF: Merge PDF/);
  });
}

test('the storage FAQ is answered without recommending a tool mentioned in its answer', async () => {
  const { body } = await ask('Are uploaded documents stored?');
  assert.match(body.data.answer, /Most standard tools process source uploads in server memory/);
  assert.match(body.data.answer, /Related: \/guides/);
});

test('the upload limit is answered without interpreting size as a compression request', async () => {
  const { body } = await ask('What is the maximum upload size?');
  assert.match(body.data.answer, /25 MB per file/);
  assert.doesNotMatch(body.data.answer, /For this, use|Open: \/tools\//);
});

test('empty or excessively long questions are still rejected', async () => {
  for (const question of ['', ' '.repeat(4), 'a'.repeat(1201)]) {
    const response = await ask(question);
    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
  }
});
