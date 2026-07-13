import { CronJob } from 'cron';
import dotenv from 'dotenv';
import axios from 'axios';
import { withRetry } from '../utils/retry.js';

dotenv.config();

if (process.env.NODE_APP_INSTANCE === '0') {
  delete process.env.NODE_APP_INSTANCE;
}

const { default: config } = await import('config');

const channelId = config.get('channelIds.general');
const schedule = config.get('schedule.theme');
const LLM_BASE_URL = process.env.LLAMA_BASE_URL || process.env.LLAMA_SERVER_URL || 'http://192.168.1.81:1234/v1';
const LLM_MODEL = process.env.LLAMA_MODEL;
const LLM_API_KEY = process.env.LLAMA_API_KEY;

const FALLBACK_THEMES = [
  'Night Market',
  'Time-Travel',
  'Lost Expedition',
  'Robot Rebellion',
  'Underwater Mystery',
  'Gravity Shift',
  'Heist',
  'Haunted',
];

const cleanThemeText = (text) => {
  if (!text) return '';
  const firstLine = text.split('\n')[0].trim();
  return firstLine.replace(/^["'\s]+/, '').replace(/["'\s\.\!\?]+$/, '').trim();
};

const fetchLlmTheme = async () => {
  const prompt = 'Generate one creative (but don\'t be too weird, make it appropriate for a gamejam and try to make it a single word) game jam theme. Respond with only the theme text, no explanation or punctuation.';
  const body = {
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
  };

  if (LLM_MODEL) {
    body.model = LLM_MODEL;
  }

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

const getFallbackTheme = () =>
  FALLBACK_THEMES[Math.floor(Math.random() * FALLBACK_THEMES.length)];

export const runThemeNow = async (send) => {
  try {
    let theme = await fetchLlmTheme();

    if (!theme) {
      console.warn('Theme generation failed; using fallback theme list.');
      theme = getFallbackTheme();
    }

    send(theme);
  } catch (error) {
    console.error('Theme generation error:', error.message);
    send(getFallbackTheme());
  }
};

export const theme = (client) => {
  new CronJob(schedule, () => {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;
    runThemeNow((msg) => channel.send(`GameJam theme: ${msg}`));
  }).start();
};
