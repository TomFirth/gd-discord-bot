import { CronJob } from 'cron';
import dotenv from 'dotenv';
import axios from 'axios';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { withRetry } from '../utils/retry.js';

dotenv.config();

if (process.env.NODE_APP_INSTANCE === '0') {
  delete process.env.NODE_APP_INSTANCE;
}

const { default: config } = await import('config');

const channelId = config.get('channelIds.general');
const LLM_BASE_URL = process.env.LLAMA_BASE_URL || process.env.LLAMA_SERVER_URL || 'http://localhost:1234/v1';
const LLM_MODEL = process.env.LLAMA_MODEL;
const LLM_API_KEY = process.env.LLAMA_API_KEY;

const generatePromptText = async (type) => {
  const prompts = {
    devtip: 'Give one concise game development tip or best practice. Respond with only the tip text, no bullet points, no explanation.',
    moodboard: 'Suggest one game genre, one tone, and one colour scheme combo. Respond in a single short sentence with the format: Genre: ..., Tone: ..., Colour scheme: ...',
    showcase: 'Suggest one indie game developer or studio to showcase. Respond with the name and a brief description of their style, then include one relevant link to a YouTube trailer, Reddit post, or official website.',
    story: 'Create one short game story hook or lore prompt. Respond with only the hook text, no explanation.',
    marketing: 'Give one actionable marketing task for a game studio posting to social media. Keep it concise, specific, and easy to execute. Respond with only the task text, no bullet points, no explanation.',
  };

  try {
    const body = {
      messages: [{ role: 'user', content: prompts[type] }],
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
    .replace(/['"\s]+$/, '')
    .trim();
};

const getFallbackPrompt = (type) => {
  const fallbacks = {
    devtip: 'Keep your core loop readable before you add more systems.',
    moodboard: 'Genre: Cozy mystery, Tone: dreamy, Colour scheme: teal, lavender, and warm amber',
    showcase: 'A Short Hike - https://ashort.hike.game/',
    story: 'A forgotten lighthouse keeper receives a message from the sea.',
    marketing: 'Post a quick before-and-after progress clip showing a polished mechanic.',
  };

  return fallbacks[type] || 'Keep the player experience focused and legible.';
};

const createMoodboardImage = (promptText) => {
  const palette = [
    '#16162b',
    '#5b4b8a',
    '#8e7cc3',
    '#f7e7c6',
    '#ffb347',
  ];

  const textHash = createHash('sha1').update(promptText).digest('hex');
  const accent = palette[parseInt(textHash.slice(0, 2), 16) % palette.length];
  const bg = palette[parseInt(textHash.slice(2, 4), 16) % palette.length];
  const glow = palette[parseInt(textHash.slice(4, 6), 16) % palette.length];

  const width = 1200;
  const height = 675;
  const escapedText = promptText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const wrapText = (text, maxChars) => {
    const words = text.split(' ');
    const lines = [];
    let current = '';

    for (const word of words) {
      if ((current + ' ' + word).trim().length <= maxChars) {
        current = (current + ' ' + word).trim();
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
    return lines;
  };

  const lines = wrapText(escapedText, 32);
  const textLines = lines.map((line, index) => `
        <tspan x="120" dy="1.2em">${line}</tspan>`
  ).join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bg}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000" flood-opacity="0.18" />
        </filter>
      </defs>

      <rect width="${width}" height="${height}" fill="url(#bgGradient)" />
      <path d="M0 150 Q300 80 600 160 T1200 140 L1200 675 L0 675 Z" fill="${glow}" opacity="0.16" />
      <path d="M0 320 Q250 260 520 340 T1200 310 L1200 675 L0 675 Z" fill="#000" opacity="0.08" />
      <circle cx="980" cy="170" r="150" fill="#fff" opacity="0.12" />
      <circle cx="220" cy="520" r="170" fill="#fff" opacity="0.08" />
      <rect x="80" y="80" width="1040" height="515" rx="42" fill="#10101f" opacity="0.88" filter="url(#shadow)" />
      <rect x="120" y="120" width="360" height="46" rx="18" fill="${glow}" opacity="0.95" />
      <text x="140" y="155" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800" fill="#12121b">MOODBOARD</text>
      <text x="120" y="220" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="700" fill="#fff">${textLines}</text>
      <text x="120" y="520" font-family="Inter, Arial, sans-serif" font-size="20" fill="#d8d3f2" opacity="0.9">A bold prompt background for creative spark.</text>
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

export const buildMarketingMessage = (suggestion) => {
  const cleanedSuggestion = (suggestion || '').trim() || getFallbackPrompt('marketing');
  const highlightedText = cleanedSuggestion.length > 120
    ? `${cleanedSuggestion.slice(0, 117)}...`
    : cleanedSuggestion;

  return {
    content: `**Marketing idea**\n\n> ${highlightedText}`,
    embeds: [{
      color: 0x1d4ed8,
      title: 'Marketing idea',
      description: highlightedText,
      footer: { text: 'One practical post idea for the next update' },
    }],
  };
};

const sendPrompt = async (client, type) => {
  const targetChannelId = type === 'marketing' ? config.get('channelIds.marketing') : channelId;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const promptText = await generatePromptText(type);
  const header = `**${type.toUpperCase()}**\n\n`;

  if (type === 'moodboard') {
    const attachment = await getMoodboardAttachment(promptText);
    await channel.send({ content: `${header}${promptText}`, files: [attachment] });
    return;
  }

  if (type === 'marketing') {
    await channel.send(buildMarketingMessage(promptText));
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
  schedulePrompt(client, 'story', scheduleConfig.story);
  schedulePrompt(client, 'marketing', scheduleConfig.marketing);
};
