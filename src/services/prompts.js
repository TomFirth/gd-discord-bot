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
const LLM_BASE_URL = process.env.LLAMA_BASE_URL;
const LLM_MODEL = process.env.LLAMA_MODEL;
const LLM_API_KEY = process.env.LLAMA_API_KEY;

export const prompts = {
  challenge: 'Give one concise game development challenge for today. Something that can be done in a few hours. Respond with only the challenge text, no bullet points, no explanation.',
  devtip: 'Give one concise game development tip or best practice. Respond with only the tip text, no bullet points, no explanation.',
  showcase: 'Suggest one indie game developer or studio to showcase. Respond with the name and a brief description of their style, then include one relevant link to a YouTube trailer, Reddit post, or official website.',
  story: 'Create one short game story hook or lore prompt. Respond with only the hook text, no explanation.',
  marketing: 'Give one actionable marketing task for a game studio posting to social media. Keep it concise, specific, and easy to execute. Respond with only the task text, no bullet points, no explanation.',
};

export const generatePromptText = async (type) => {
  if (!prompts[type]) {
    throw new Error(`Unknown prompt type: ${type}`);
  }

  try {
    const body = {
      model: LLM_MODEL || 'qwen2.5-coder-3b-instruct-q4_k_m.gguf',
      stream: false,
      max_tokens: 32,
      messages: [
        {
          role: 'user',
          content: prompts[type],
        },
      ],
    };

    const url = `${LLM_BASE_URL}/v1/chat/completions`.replace(/\/v1\/v1\//, '/v1/');
    console.log(`LLM Request URL (prompt): ${url}`);

    const response = await withRetry(() => axios.post(
      url,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(LLM_API_KEY ? { Authorization: `Bearer ${LLM_API_KEY}` } : {}),
        },
        timeout: 30000,
      }
    ), { retries: 3, baseDelayMs: 400 });

    const generated = response.data?.choices?.[0]?.message?.content;
    return cleanPromptText(generated);
  } catch (error) {
    console.error(`Prompt generation error (${type}):`, error.message);
    return '';
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

export const buildMarketingMessage = (suggestion) => {
  const cleanedSuggestion = (suggestion || '').trim();
  const highlightedText = cleanedSuggestion.length > 120
    ? `${cleanedSuggestion.slice(0, 117)}...`
    : cleanedSuggestion;

  return {
    embeds: [{
      color: 0x1d4ed8,
      title: 'Marketing idea',
      description: highlightedText,
    }],
  };
};

const sendPrompt = async (client, type) => {
  const targetChannelId = type === 'marketing' ? config.get('channelIds.marketing') : channelId;
  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) return;

  const promptText = await generatePromptText(type);
  const header = `**${type.toUpperCase()}: **`;

  if (type === 'marketing') {
    await channel.send(buildMarketingMessage(promptText));
    return;
  }

  await channel.send(
    promptText
      ? `${header}${promptText}`
      : `${header}Failed to generate prompt`
  );
};

const schedulePrompt = (client, type, cronSchedule) => {
  new CronJob(cronSchedule, () => {
    sendPrompt(client, type);
  }).start();
};

export const initializePromptSchedules = (client) => {
  const scheduleConfig = config.get('schedule');
  schedulePrompt(client, 'challenge', scheduleConfig.challenge);
  schedulePrompt(client, 'devtip', scheduleConfig.devtip);
  schedulePrompt(client, 'showcase', scheduleConfig.showcase);
  schedulePrompt(client, 'story', scheduleConfig.story);
  schedulePrompt(client, 'marketing', scheduleConfig.marketing);
};
