import assert from 'node:assert/strict';
import test from 'node:test';
import { toolCatalog } from '../../shared/toolCatalog.mjs';
import { governmentImagePresets, governmentPresetByTool } from '../../shared/imagePresets.mjs';

const requiredToolSlugs = [
  'kerala-psc-photo-resizer', 'kerala-psc-signature-resizer', 'psc-photo-kb-compressor', 'psc-signature-kb-compressor',
  'psc-photo-background-changer', 'psc-photo-signature-maker', 'psc-thumb-impression-resizer',
  'police-recruitment-photo-maker', 'army-recruitment-photo-maker', 'india-post-photo-resizer', 'navy-recruitment-photo-maker',
  'air-force-photo-resizer', 'government-application-signature-maker',
  'passport-size-photo-maker', 'government-id-photo-maker', 'certificate-photo-resizer', 'document-kb-compressor',
  'document-dpi-changer', 'signature-background-remover',
  'ssc-photo-resizer', 'ssc-signature-resizer', 'ssc-photo-compressor', 'ssc-signature-compressor',
  'upsc-photo-resizer', 'upsc-signature-resizer', 'upsc-document-resizer', 'upsc-photo-compressor',
  'rrb-photo-resizer', 'rrb-signature-resizer', 'rrb-thumb-impression-resizer', 'rrb-document-compressor',
  'aadhaar-photo-resizer', 'pan-card-photo-resizer', 'aadhaar-pdf-compressor', 'pan-document-compressor'
];

test('all 35 government tools use the shared image or document processing routes', () => {
  const governmentTools = toolCatalog.filter((tool) => tool.gov && tool.category !== 'Social Media');
  assert.equal(governmentTools.length, 35);
  assert.deepEqual(governmentTools.map(({ slug }) => slug).sort(), [...requiredToolSlugs].sort());
  for (const tool of governmentTools) {
    assert.ok(['government-image', 'compress'].includes(tool.endpoint), `${tool.slug} has a working custom route`);
    assert.ok(tool.description.length >= 40, `${tool.slug} has a distinct tool description`);
  }
});

test('every recruitment preset follows the configurable authority and notice schema', () => {
  const fields = [
    'status', 'recruitmentAuthority', 'agency', 'recruitmentName', 'postName', 'notificationNumber', 'notificationYear', 'width', 'height',
    'minKb', 'maxKb', 'format', 'dpi', 'signatureWidth', 'signatureHeight', 'thumbWidth', 'thumbHeight',
    'background', 'validThrough', 'officialUrl', 'lastUpdated'
  ];
  for (const [id, preset] of Object.entries(governmentImagePresets)) {
    for (const field of fields) assert.ok(Object.hasOwn(preset, field), `${id} should define ${field}`);
    assert.ok(['verified', 'example', 'custom', 'custom-required'].includes(preset.status), `${id} has an explicit verification status`);
    if (preset.status === 'verified') assert.match(preset.officialUrl || '', /^https:\/\//, `${id} links to an official source`);
  }
  assert.equal(governmentImagePresets.noticeSpecificImage.status, 'custom-required');
  assert.equal(governmentImagePresets.noticeSpecificImage.width, null);
  for (const slug of requiredToolSlugs) {
    const presetId = governmentPresetByTool[slug];
    if (presetId) assert.ok(governmentImagePresets[presetId], `${slug} references an existing preset`);
  }
});

test('the passport 35 by 45 preset is clearly an example, not a universal recruitment rule', () => {
  const passport = governmentImagePresets.passportPrint;
  assert.equal(passport.status, 'example');
  assert.equal(passport.width, 413);
  assert.equal(passport.height, 531);
  assert.match(passport.note, /not certified for passport submission/i);
});
