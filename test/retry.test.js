import test from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../src/utils/retry.js';

test('retries transient failures before succeeding', async () => {
  let attempts = 0;

  const result = await withRetry(async () => {
    attempts += 1;
    if (attempts < 3) {
      const error = new Error('Request failed with status code 503');
      error.status = 503;
      throw error;
    }

    return 'ok';
  }, { retries: 3, baseDelayMs: 1 });

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
});

test('does not retry non-transient failures', async () => {
  let attempts = 0;

  await assert.rejects(
    () => withRetry(async () => {
      attempts += 1;
      const error = new Error('Request failed with status code 400');
      error.status = 400;
      throw error;
    }, { retries: 3, baseDelayMs: 1 }),
    /400/
  );

  assert.equal(attempts, 1);
});
