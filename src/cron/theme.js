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
const FEATHERLESS_API_KEY = process.env.FEATHERLESS_API_KEY;
const FEATHERLESS_MODEL = process.env.FEATHERLESS_MODEL || 'GalrionSoftworks/Margnum-12B-v1';
const FEATHERLESS_BASE_URL = 'https://api.featherless.ai/v1';

const FALLBACK_THEMES = [
  'Neon Night Market',
  'Time-Travel',
  'Lost Expedition',
  'Robot Rebellion',
  'Underwater Mystery',
  'Gravity Shift',
  'Heist',
  'Marketplace',
  'Haunted',
];

const cleanThemeText = (text) => {
  if (!text) return '';
  const firstLine = text.split('\n')[0].trim();
  return firstLine.replace(/^["'\s]+/, '').replace(/["'\s\.\!\?]+$/, '').trim();
};

const fetchFeatherlessTheme = async () => {
  if (!FEATHERLESS_API_KEY) return null;

  const prompt = 'Generate one creative (but don\'t be too weird, make it appropriate for a gamejam and try to make it a single word) game jam theme. Respond with only the theme text, no explanation or punctuation.';
  const response = await withRetry(() => axios.post(
    `${FEATHERLESS_BASE_URL}/chat/completions`,
    {
      model: FEATHERLESS_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      top_p: 0.95,
      top_k: 40,
      max_tokens: 32,
    },
    {
      headers: {
        Authorization: `Bearer ${FEATHERLESS_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'GD Bot Theme Generator',
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
    let theme = null;

    if (FEATHERLESS_API_KEY) {
      theme = await fetchFeatherlessTheme();
    }

    if (!theme) {
      console.warn('No Featherless key configured for weekly theme generation; using fallback theme list.');
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
