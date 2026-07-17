const DEFAULT_RETRYABLE_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);

const isRetryableError = (error) => {
  if (!error) return false;

  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
    return true;
  }

  if (typeof error.status === 'number') {
    return DEFAULT_RETRYABLE_STATUS_CODES.has(error.status);
  }

  const message = String(error.message || '').toLowerCase();
  return message.includes('429') || message.includes('503') || message.includes('timeout');
};

export const withRetry = async (operation, { retries = 3, baseDelayMs = 500 } = {}) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === retries || !isRetryableError(error)) {
        throw error;
      }

      const delayMs = baseDelayMs * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
};
