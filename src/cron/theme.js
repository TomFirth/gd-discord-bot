import { CronJob } from 'cron';
import dotenv from 'dotenv';
import axios from 'axios';
import { withRetry } from '../utils/retry.js';
import { queueLlmRequest } from '../services/llmQueue.js';

dotenv.config();

if (process.env.NODE_APP_INSTANCE) {
  delete process.env.NODE_APP_INSTANCE;
}

const { default: config } = await import('config');

const channelId = config.get('channelIds.general');
const schedule = config.get('schedule.theme');
const LLM_BASE_URL = process.env.LLAMA_BASE_URL;
const LLM_MODEL = process.env.LLAMA_MODEL;
const LLM_API_KEY = process.env.LLAMA_API_KEY;

const cleanThemeText = (text) => {
  if (!text) return '';

  const firstLine = text.split('\n')[0].trim();

  return firstLine
    .replace(/^["'\s]+/, '')
    .replace(/["'\s.!?]+$/, '')
    .trim();
};

const fetchLlmTheme = async () => {
  const prompt = 'Generate one creative but accessible single-word game jam theme. Respond with only the theme text, without explanation or punctuation.';

  const body = {
    model: LLM_MODEL || 'qwen2.5-coder-3b-instruct-q4_k_m.gguf',
    stream: false,
    max_tokens: 32,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const url = `${LLM_BASE_URL}/v1/chat/completions`
    .replace(/\/v1\/v1\//, '/v1/');

  console.log(`LLM Request URL (theme): ${url}`);
  console.log('Theme request body:', JSON.stringify(body));

  const startedAt = Date.now();

  const response = await queueLlmRequest(() =>
    withRetry(
      () => axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json',
          ...(LLM_API_KEY
            ? { Authorization: `Bearer ${LLM_API_KEY}` }
            : {}),
        },
        timeout: 90000,
      }),
      {
        retries: 0,
        baseDelayMs: 400,
      }
    )
  );

  console.log(`Theme response received in ${Date.now() - startedAt}ms`);

  const generated = response.data?.choices?.[0]?.message?.content;
  return cleanThemeText(generated);
};

export const runThemeNow = async () => {
  try {
    const generatedTheme = await fetchLlmTheme();

    if (!generatedTheme) {
      console.warn('Theme generation returned an empty response.');
      return '';
    }

    return generatedTheme;
  } catch (error) {
    console.error('Theme generation error:', {
      message: error.message,
      code: error.code,
    });

    return '';
  }
};

export const theme = (client) => {
  new CronJob(schedule, async () => {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    const generatedTheme = await runThemeNow();

    await channel.send(
      generatedTheme
        ? `GameJam theme: ${generatedTheme}`
        : 'GameJam theme generation failed.'
    );
  }).start();
};