import { CronJob } from 'cron';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { withRetry } from '../utils/retry.js';
import { queueLlmRequest } from './llmQueue.js';

dotenv.config();

if (process.env.NODE_APP_INSTANCE) {
  delete process.env.NODE_APP_INSTANCE;
}

const { default: config } = await import('config');

const channelId = config.get('channelIds.general');
const LLM_BASE_URL = process.env.LLAMA_BASE_URL;
const LLM_MODEL = process.env.LLAMA_MODEL;
const LLM_API_KEY = process.env.LLAMA_API_KEY;

const promptHistoryDir = path.resolve('./data');
const promptHistoryFile = path.resolve(promptHistoryDir, 'prompt-history.json');
const MAX_RECENT_PROMPTS = 50;
const DUPLICATE_THRESHOLD = 0.75;
const MAX_PROMPT_DUPLICATE_ATTEMPTS = 4;

const ensureHistoryFolder = async () => {
  await fs.mkdir(promptHistoryDir, { recursive: true });
};

const loadPromptHistory = async () => {
  try {
    const data = await fs.readFile(promptHistoryFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
};

const savePromptHistory = async (history) => {
  await ensureHistoryFolder();
  await fs.writeFile(promptHistoryFile, JSON.stringify(history.slice(-MAX_RECENT_PROMPTS), null, 2));
};

const normalizeText = (text) => text
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const similarity = (a, b) => {
  if (!a || !b) return 0;

  const aWords = normalizeText(a).split(' ');
  const bWords = normalizeText(b).split(' ');
  const setA = new Set(aWords);
  const setB = new Set(bWords);

  const intersection = [...setA].filter((word) => setB.has(word)).length;
  const union = new Set([...aWords, ...bWords]).size;

  return union === 0 ? 0 : intersection / union;
};

const isDuplicateResponse = async (type, response) => {
  const history = await loadPromptHistory();
  const normalizedResponse = normalizeText(response);

  return history
    .filter((entry) => entry.type === type)
    .some((entry) => similarity(entry.text, normalizedResponse) >= DUPLICATE_THRESHOLD);
};

const recordPromptResponse = async (type, response) => {
  const history = await loadPromptHistory();
  history.push({
    type,
    text: normalizeText(response),
    createdAt: new Date().toISOString(),
  });
  await savePromptHistory(history);
};

const generateUniquePromptText = async (type) => {
  let lastResponse = '';

  for (let attempt = 1; attempt <= MAX_PROMPT_DUPLICATE_ATTEMPTS; attempt += 1) {
    const response = await generatePromptText(type);
    lastResponse = response;

    if (!response) {
      return '';
    }

    const duplicate = await isDuplicateResponse(type, response);
    if (!duplicate) {
      await recordPromptResponse(type, response);
      return response;
    }

    console.log(`Duplicate prompt detected for type=${type}, attempt=${attempt}. Retrying...`);
  }

  console.warn(`Unable to generate a unique prompt for type=${type} after ${MAX_PROMPT_DUPLICATE_ATTEMPTS} attempts.`);
  return lastResponse;
};

export const prompts = {
  challenge: 'Give one concise game development challenge for today. Something that can be done in a few hours. Respond with only the challenge text, no bullet points, no explanation.',
  devtip: 'Give one concise game development tip or best practice. Respond with only the tip text, no bullet points, no explanation.',
  showcase: 'Suggest one indie game developer or studio to showcase. Respond with the name and a brief description of their style, then include one relevant link to a YouTube trailer, Reddit post, or official website.',
  tutorial: 'Find a recent, quick, simple game development tutorial on YouTube. Keep it broadly applicable to any engine or toolkit. Respond with only one YouTube video link and nothing else.',
};

export const generatePromptText = async (type) => {
  if (!prompts[type]) {
    throw new Error(`Unknown prompt type: ${type}`);
  }

  const startedAt = Date.now();

  try {
    const body = {
      model: LLM_MODEL || 'qwen2.5-coder-3b-instruct-q4_k_m.gguf',
      stream: false,
      max_tokens: 32,
      messages: [
        {
          role: 'system',
          content: 'You have up to 32 tokens available for your response. Please respond using 32 tokens or fewer.',
        },
        {
          role: 'user',
          content: prompts[type],
        },
      ],
    };

    const url = `${LLM_BASE_URL}/v1/chat/completions`
      .replace(/\/v1\/v1\//, '/v1/');

    console.log(`LLM request queued (${type}): ${url}`);

    const response = await queueLlmRequest(async () => {
      console.log(`LLM request started (${type})`);

      return withRetry(() => axios.post(
        url,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(LLM_API_KEY
              ? { Authorization: `Bearer ${LLM_API_KEY}` }
              : {}),
          },
          timeout: 90000,
        }
      ), {
        retries: 0,
        baseDelayMs: 400,
      });
    });

    console.log(
      `LLM response received (${type}) in ${Date.now() - startedAt}ms`
    );

    const generated = response.data?.choices?.[0]?.message?.content;
    return cleanPromptText(generated, type);
  } catch (error) {
    console.error(`Prompt generation error (${type}) after ${Date.now() - startedAt}ms:`, {
      message: error.message,
      code: error.code,
    });

    return '';
  }
};

export const cleanPromptText = (text, type = '') => {
  if (!text) return '';

  let cleaned = text
    .split('\n')[0]
    .trim()
    .replace(/^['"\s]+/, '')
    .replace(/['"\s]+$/, '')
    .trim();

  return cleaned;
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
  schedulePrompt(client, 'tutorial', scheduleConfig.tutorial);
};


