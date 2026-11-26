import assert from 'node:assert/strict';
import test from 'node:test';
import { toolCatalog } from '../../shared/toolCatalog.mjs';
import { socialPostPresets, socialProfilePresets, socialStoryPresets } from '../../shared/imagePresets.mjs';
import { getToolCategoryLabel } from '../src/tools.js';

test('document menu category labels omit government wording', () => {
  assert.equal(getToolCategoryLabel('Common Government Document Tools'), 'Common Document Tools');
});

test('the tool directory has the requested three sections', () => {
  assert.deepEqual([...new Set(toolCatalog.map(({ section }) => section))].sort(), ['Documents', 'Public Service', 'Social Media'].sort());
  assert.ok(toolCatalog.filter(({ gov }) => gov).every(({ section, category }) => section === (category === 'Social Media' ? 'Social Media' : 'Public Service')));
});

test('all social media tools have section placement and a valid default size preset', () => {
  const socialTools = toolCatalog.filter(({ category }) => category === 'Social Media');
  assert.deepEqual(socialTools.map(({ slug }) => slug), [
    'social-media-profile-resizer',
    'social-media-post-resizer',
    'social-media-story-resizer'
  ]);

  const presetGroups = { profile: socialProfilePresets, post: socialPostPresets, story: socialStoryPresets };
  for (const tool of socialTools) {
    assert.equal(tool.section, 'Social Media');
    const groupName = tool.gov.presetGroup || 'profile';
    const preset = presetGroups[groupName].find(({ id }) => id === tool.gov.defaultPreset);
    assert.ok(preset, `${tool.slug} should point to a preset in the ${groupName} group`);
    assert.ok(Number.isInteger(preset.width) && preset.width > 0);
    assert.ok(Number.isInteger(preset.height) && preset.height > 0);
    assert.ok(preset.guidance);
  }
});
