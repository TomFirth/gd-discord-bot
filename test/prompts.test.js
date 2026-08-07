import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketingMessage, cleanPromptText } from '../src/services/prompts.js';

test('buildMarketingMessage creates a standout marketing embed', () => {
  const suggestion = "Post a 10-second GIF showing your game's most satisfying mechanic.";
  const message = buildMarketingMessage(suggestion);

  assert.equal(message.embeds?.[0]?.description, suggestion);
  assert.ok(message.embeds?.[0]?.color);
  assert.ok(message.embeds[0].color > 0);
});

test('cleanPromptText preserves complete story sentences', () => {
  const story = 'A lonely spaceship drifts through a ruined star system, searching for a forgotten beacon with danger in the dark.';
  const result = cleanPromptText(story, 'story');

  assert.equal(result, story);
});

test('cleanPromptText strips back to the last full stop if story output trails off', () => {
  const story = 'A young wizard discovers an ancient relic. The shadows are closing in';
  const result = cleanPromptText(story, 'story');

  assert.equal(result, 'A young wizard discovers an ancient relic.');
});
