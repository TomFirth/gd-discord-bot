// src/services/llmQueue.js

let pending = Promise.resolve();

export const queueLlmRequest = (request) => {
  const result = pending.then(request, request);

  pending = result.catch(() => {
    // Keep the queue usable after a failed request.
  });

  return result;
};