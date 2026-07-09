import { CronJob } from 'cron';
import config from 'config';
import axios from 'axios';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const channelId = config.get('channelIds.general');
const FEATHERLESS_API_KEY = process.env.FEATHERLESS_API_KEY;
const FEATHERLESS_MODEL = process.env.FEATHERLESS_MODEL || 'GalrionSoftworks/Margnum-12B-v1';
const FEATHERLESS_BASE_URL = 'https://api.featherless.ai/v1';

const generatePromptText = async (type) => {
  if (!FEATHERLESS_API_KEY) {
    return getFallbackPrompt(type);
  }

  const prompts = {
    devtip: 'Give one concise game development tip or best practice. Respond with only the tip text, no bullet points, no explanation.',
    moodboard: 'Suggest one game genre, one tone, and one colour scheme combo. Respond in a single short sentence with the format: Genre: ..., Tone: ..., Colour scheme: ...',
    showcase: 'Suggest one indie game developer or studio to showcase. Respond with only the name of the developer or studio and a brief description of their style.',
    audio: 'Suggest one short sound effect idea for a game scene. Respond with only the idea text, no explanation.',
    story: 'Create one short game story hook or lore prompt. Respond with only the hook text, no explanation.',
  };

  try {
    const response = await axios.post(
      `${FEATHERLESS_BASE_URL}/chat/completions`,
      {
        model: FEATHERLESS_MODEL,
        messages: [{ role: 'user', content: prompts[type] }],
        temperature: 0.8,
        top_p: 0.95,
        top_k: 40,
        max_tokens: 48,
      },
      {
        headers: {
          Authorization: `Bearer ${FEATHERLESS_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Title': 'GD Bot Prompt Generator',
        },
      }
    );

    const generated = response.data?.choices?.[0]?.message?.content;
    return cleanPromptText(generated) || getFallbackPrompt(type);
  } catch (error) {
    console.error(`Prompt generation error (${type}):`, error.message);
    return getFallbackPrompt(type);
  }
};

const cleanPromptText = (text) => {
  if (!text) return '';
  return text
    .split('\n')[0]
    .trim()
    .replace(/^['"\s]+/, '')
    .replace(/['"\s.?!]+$/, '')
    .trim();
};

const getFallbackPrompt = (type) => {
  const fallbacks = {
    devtip: 'Keep your core loop readable before you add more systems.',
    moodboard: 'Genre: Cozy mystery, Tone: dreamy, Colour scheme: teal, lavender, and warm amber',
    showcase: 'A Short Hike',
    audio: 'A soft chime that plays when a hidden door unlocks.',
    story: 'A forgotten lighthouse keeper receives a message from the sea.',
  };

  return fallbacks[type] || 'Keep the player experience focused and legible.';
};

const createMoodboardImage = (promptText) => {
  const palette = [
    '#1C1C2B',
    '#5B4B8A',
    '#8E7CC3',
    '#F2C14E',
    '#F7E7C6',
  ];

  const textHash = createHash('sha1').update(promptText).digest('hex');
  const accent = palette[parseInt(textHash.slice(0, 2), 16) % palette.length];
  const bg = palette[parseInt(textHash.slice(2, 4), 16) % palette.length];

  const width = 1200;
  const height = 675;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${bg}" />
      <rect x="80" y="80" width="1040" height="515" rx="36" fill="${accent}" opacity="0.24" />
      <circle cx="950" cy="220" r="180" fill="${palette[3]}" opacity="0.8" />
      <circle cx="300" cy="460" r="220" fill="${palette[4]}" opacity="0.9" />
      <rect x="120" y="140" width="320" height="24" rx="12" fill="${palette[4]}" opacity="0.95" />
      <rect x="120" y="190" width="560" height="28" rx="14" fill="${palette[4]}" opacity="0.9" />
      <rect x="120" y="240" width="460" height="28" rx="14" fill="${palette[4]}" opacity="0.9" />
      <text x="120" y="420" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="${palette[4]}">Moodboard</text>
      <text x="120" y="485" font-family="Arial, sans-serif" font-size="26" fill="${palette[4]}">${promptText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
    </svg>`;

  return Buffer.from(svg);
};

const getMoodboardAttachment = async (promptText) => {
  const imageBuffer = createMoodboardImage(promptText);
  const fileName = `moodboard-${createHash('sha1').update(promptText).digest('hex').slice(0, 8)}.svg`;
  return {
    attachment: imageBuffer,
    name: fileName,
  };
};

const sendPrompt = async (client, type) => {
  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  const promptText = await generatePromptText(type);
  const header = `**${type.toUpperCase()}**\n\n`;

  if (type === 'moodboard') {
    const attachment = await getMoodboardAttachment(promptText);
    await channel.send({ content: `${header}${promptText}`, files: [attachment] });
    return;
  }

  await channel.send(`${header}${promptText}`);
};

const schedulePrompt = (client, type, cronSchedule) => {
  new CronJob(cronSchedule, () => {
    sendPrompt(client, type);
  }).start();
};

export const initializePromptSchedules = (client) => {
  const scheduleConfig = config.get('schedule');
  schedulePrompt(client, 'devtip', scheduleConfig.devtip);
  schedulePrompt(client, 'moodboard', scheduleConfig.moodboard);
  schedulePrompt(client, 'showcase', scheduleConfig.showcase);
  schedulePrompt(client, 'audio', scheduleConfig.audio);
  schedulePrompt(client, 'story', scheduleConfig.story);
};
