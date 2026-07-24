import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { google } from 'googleapis';
import { withRetry } from '../utils/retry.js';

const command = new SlashCommandBuilder()
  .setName('gamedev')
  .setDescription('Posts a random game idea from one of your configured Google Docs.');

const randomColour = () => Math.floor(Math.random() * 0xffffff);
const LLM_BASE_URL = process.env.LLAMA_BASE_URL;

const normalizeDocumentId = (value) => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/i);
  if (match?.[1]) return match[1];

  return trimmed.replace(/\/edit.*$/i, '').split('/').pop() || null;
};

export const getConfiguredDocumentIds = () => {
  const rawValue = process.env.GAME_IDEAS_DOC_IDS || process.env.GAME_IDEAS_DOC_ID || '';
  return rawValue
    .split(',')
    .map(normalizeDocumentId)
    .filter(Boolean);
};

const getParagraphText = (paragraph) => {
  if (!paragraph?.elements?.length) return '';

  return paragraph.elements
    .map((element) => element.textRun?.content ?? '')
    .join('')
    .trim();
};

const collectTextFromBlocks = (blocks = []) => {
  return blocks
    .map((block) => {
      if (block?.paragraph) {
        return getParagraphText(block.paragraph);
      }

      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
};

export const extractGameIdeas = (document) => {
  const ideas = [];

  if (Array.isArray(document?.body?.content) && document.body.content.length > 0) {
    let currentTitle = null;
    const currentDescription = [];

    const flush = () => {
      if (currentTitle) {
        const description = currentDescription.join('\n').trim();
        ideas.push({ title: currentTitle, description });
      }
    };

    for (const block of document.body.content) {
      if (!block?.paragraph) continue;

      const styleType = block.paragraph.paragraphStyle?.namedStyleType;
      const text = getParagraphText(block.paragraph);

      if (!text) continue;

      if (styleType?.startsWith('HEADING_')) {
        flush();
        currentTitle = text;
        currentDescription.length = 0;
        continue;
      }

      if (currentTitle) {
        if (styleType === 'NORMAL_TEXT' || styleType === 'LIST_ITEM' || styleType === 'SUBTITLE') {
          currentDescription.push(text);
        }
      }
    }

    flush();
  }

  if (Array.isArray(document?.tabs) && document.tabs.length > 0) {
    for (const tab of document.tabs) {
      const title = tab?.title || tab?.tabTitle || tab?.name || 'Untitled tab';
      const description = collectTextFromBlocks(tab?.body?.content || tab?.content || []);

      if (title && description) {
        ideas.push({ title, description });
      }
    }
  }

  return ideas.filter((idea) => idea.title && idea.description);
};

export const buildIdeaPrompt = (idea) => {
  const title = idea.title?.trim() || 'Untitled idea';
  const description = idea.description?.trim() || 'No description was provided.';

  return [
    'You are a game design assistant.',
    'I have a raw game idea from a Google Doc and I want you to expand it into a concise, exciting pitch for a Discord post.',
    `Game title: ${title}`,
    `Game idea: ${description}`,
    'Please respond with valid JSON only using this exact shape:',
    '{"mvp":"...","mechanic":"...","twist":"...","artStyle":"...","platform":"..."}',
    'Requirements:',
    '- The mvp value should briefly describe a tiny prototype or MVP.',
    '- The mechanic value should describe one exciting new mechanic.',
    '- The twist value should add a fresh twist of your own.',
    '- The artStyle value should suggest an art style that suits the idea.',
    '- The platform value should be one of: console, PC, mobile, or itch.io.',
    '- Keep each value to one clear sentence.',
  ].join('\n');
};

export const parseLlmEnhancement = (rawText = '') => {
  const cleaned = String(rawText)
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      mvp: parsed.mvp || 'A small prototype that proves the core loop in a single scene.',
      mechanic: parsed.mechanic || 'A single bold mechanic that makes the experience memorable.',
      twist: parsed.twist || 'A small twist that adds surprise without overcomplicating the concept.',
      artStyle: parsed.artStyle || 'A bold, readable style with strong silhouettes.',
      platform: parsed.platform || 'PC',
    };
  } catch {
    return {
      mvp: 'A small prototype that proves the core loop in a single scene.',
      mechanic: 'A single bold mechanic that makes the experience memorable.',
      twist: 'A small twist that adds surprise without overcomplicating the concept.',
      artStyle: 'A bold, readable style with strong silhouettes.',
      platform: 'PC',
    };
  }
};

const fetchIdeaEnhancement = async (idea) => {
  const prompt = buildIdeaPrompt(idea);
  const body = {
    model: process.env.LLAMA_MODEL || 'qwen2.5-coder',
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
        ...(process.env.LLAMA_API_KEY ? { Authorization: `Bearer ${process.env.LLAMA_API_KEY}` } : {}),
      },
    },
  ), { retries: 3, baseDelayMs: 400 });

  const rawResponse = response.data?.choices?.[0]?.message?.content || '';
  return parseLlmEnhancement(rawResponse);
};

export const buildIdeaEmbed = (idea, enhancement = {}) => {
  const title = idea.title?.trim() || 'Untitled idea';
  const description = idea.description?.trim() || 'No description was provided.';
  const fields = {
    mvp: enhancement.mvp || 'A small prototype that proves the core loop in a single scene.',
    mechanic: enhancement.mechanic || 'A single bold mechanic that makes the experience memorable.',
    twist: enhancement.twist || 'A small twist that adds surprise without overcomplicating the concept.',
    artStyle: enhancement.artStyle || 'A bold, readable style with strong silhouettes.',
    platform: enhancement.platform || 'PC',
  };

  return new EmbedBuilder()
    .setTitle(`Random game idea: ${title}`)
    .setColor(randomColour())
    .setDescription(description)
    .addFields(
      { name: 'MVP / Prototype', value: fields.mvp, inline: false },
      { name: 'Key mechanic', value: fields.mechanic, inline: false },
      { name: 'One more twist', value: fields.twist, inline: false },
      { name: 'Art style', value: fields.artStyle, inline: true },
      { name: 'Platform', value: fields.platform, inline: true },
    )
    .setFooter({ text: idea.sourceDocumentId ? `Source document: ${idea.sourceDocumentId}` : 'Powered by Google Docs' });
};

export const loadGoogleCredentials = () => {
  const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const defaultPath = path.join(process.cwd(), 'credentials.json');
  const credentialsPath = configuredPath || (existsSync(defaultPath) ? defaultPath : null);

  if (credentialsPath) {
    try {
      const rawCredentials = readFileSync(credentialsPath, 'utf8');
      const parsedCredentials = JSON.parse(rawCredentials);

      if (parsedCredentials.private_key && parsedCredentials.client_email) {
        return parsedCredentials;
      }
    } catch (error) {
      console.warn(`Could not read Google credentials from ${credentialsPath}:`, error.message);
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    return {
      type: 'service_account',
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    };
  }

  return null;
};

const createAuth = () => {
  const credentials = loadGoogleCredentials();

  if (!credentials) {
    throw new Error('Google credentials were not found. Set GOOGLE_APPLICATION_CREDENTIALS or provide FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.');
  }

  return google.auth.fromJSON(credentials, ['https://www.googleapis.com/auth/documents.readonly']);
};

const commandHandler = async (interaction) => {
  const documentIds = getConfiguredDocumentIds();

  if (!documentIds.length) {
    return interaction.reply({
      content: 'No Google Doc IDs are configured. Set GAME_IDEAS_DOC_IDS to a comma-separated list of document IDs or URLs.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const auth = createAuth();
    const docs = google.docs({ version: 'v1', auth });

    const ideaSets = await Promise.all(documentIds.map(async (documentId) => {
      try {
        const response = await docs.documents.get({ documentId });
        return extractGameIdeas(response.data).map((idea) => ({ ...idea, sourceDocumentId: documentId }));
      } catch (error) {
        console.error(`Failed to load game ideas document ${documentId}:`, error);
        return [];
      }
    }));

    const ideas = ideaSets.flat();

    if (!ideas.length) {
      return interaction.editReply('No ideas were found in the configured Google Docs.');
    }

    const selectedIdea = ideas[Math.floor(Math.random() * ideas.length)];
    const enhancement = await fetchIdeaEnhancement(selectedIdea);
    const embed = buildIdeaEmbed(selectedIdea, enhancement);

    await interaction.channel.send({ embeds: [embed] });
    return interaction.editReply('A fresh game idea is posted.');
  } catch (error) {
    console.error('Game idea command failed:', error);
    return interaction.editReply('The game idea command hit an error. Check the bot logs or your Google Docs credentials.');
  }
};

export default {
  data: command,
  execute: commandHandler,
};