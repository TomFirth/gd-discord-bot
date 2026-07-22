import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketingMessage } from '../src/services/prompts.js';

test('buildMarketingMessage creates a standout marketing card', () => {
  const suggestion = "Post a 10-second GIF showing your game's most satisfying mechanic.";
  const message = buildMarketingMessage(suggestion);

  assert.match(message.content, /\*\*Marketing idea\*\*/);
  assert.ok(message.embeds?.[0]?.color);
  assert.equal(message.embeds[0].description, suggestion);
  assert.ok(message.embeds[0].color > 0);
});
