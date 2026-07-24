import { CronJob } from 'cron';
import dotenv from 'dotenv';
import axios from 'axios';
import { withRetry } from '../utils/retry.js';

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
  return firstLine.replace(/^["'\s]+/, '').replace(/["'\s\.\!\?]+$/, '').trim();
};

const fetchLlmTheme = async () => {
  const prompt = 'Generate one creative (but don\'t be too weird, make it appropriate for a gamejam and try to make it a single word) game jam theme. Respond with only the theme text, no explanation or punctuation.';
  const body = {
    model: LLM_MODEL || 'qwen2.5-coder',
    stream: false,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const response = await withRetry(() => axios.post(
    `${LLM_BASE_URL}/chat/completions`,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        ...(LLM_API_KEY ? { Authorization: `Bearer ${LLM_API_KEY}` } : {}),
      },
    }
  ), { retries: 3, baseDelayMs: 400 });

  const generated = response.data?.choices?.[0]?.message?.content;
  return cleanThemeText(generated);
};

export const runThemeNow = async (send) => {
  try {
    let theme = await fetchLlmTheme();

    if (!theme) {
      console.warn('Theme generation failed.');
    }

    send(theme);
  } catch (error) {
    console.error('Theme generation error:', error.message);
  }
};

export const theme = (client) => {
  new CronJob(schedule, () => {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;
    runThemeNow((msg) => channel.send(`GameJam theme: ${msg}`));
  }).start();
};
