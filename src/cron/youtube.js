import axios from 'axios';
import Parser from 'rss-parser';
import { EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { withRetry } from '../utils/retry.js';

dotenv.config();

const { default: config } = await import('config');
const parser = new Parser();
const USER_AGENT = 'GDBot/2.0 (youtube-watcher)';

const DATA_FILE = path.resolve(process.cwd(), 'data', 'youtube-posted.json');

const ensureDataFile = async () => {
  try {
    await fs.access(DATA_FILE);
  } catch (err) {
    // create directory and file
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify({}), 'utf8');
  }
};

const readPostedData = async () => {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw || '{}');
};

const writePostedData = async (data) => {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
};

const getChannelIdFromHandle = async (handle) => {
  // handle may be like "@unity" or "unity"; normalize
  const h = handle.startsWith('@') ? handle : `@${handle}`;
  const url = `https://www.youtube.com/${h}`;
  try {
    const res = await withRetry(() => axios.get(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      timeout: 15000,
    }), { retries: 3, baseDelayMs: 2000 });

    const html = res.data;
    const m = html.match(/channel\/(UC[0-9A-Za-z_-]{22})/);
    if (m) return m[1];
  } catch (err) {
    console.error(`Failed to fetch channel page for ${handle}:`, err.message);
  }
  return null;
};

const getFeedUrlFor = (opts) => {
  if (opts.channelId) return `https://www.youtube.com/feeds/videos.xml?channel_id=${opts.channelId}`;
  if (opts.channelHandle) return `https://www.youtube.com/feeds/videos.xml?channel_id=${opts.resolvedChannelId}`;
  return null;
};

export const fetchYoutubeFeed = async (opts) => {
  try {
    // resolve channel id if handle was provided
    if (!opts.channelId && opts.channelHandle && !opts.resolvedChannelId) {
      const resolved = await getChannelIdFromHandle(opts.channelHandle);
      opts.resolvedChannelId = resolved;
    }

    const feedUrl = getFeedUrlFor(opts);
    if (!feedUrl) return null;

    const res = await withRetry(() => axios.get(feedUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml' },
      responseType: 'text',
      timeout: 15000,
    }), { retries: 3, baseDelayMs: 2000 });

    const feed = await parser.parseString(res.data);
    return feed;
  } catch (error) {
    console.error('Failed to fetch YouTube RSS:', error.message);
    return null;
  }
};

const PATTERNS = [
  { regex: /\blaunch trailer\b/i, channel: 'unrelated' },
  { regex: /^what('?|’)s new\b/i, channel: 'general' },
  { regex: /\btutorial\b/i, channel: 'general' },
];

export { startYoutubeFeeds } from '../stream/youtube.js';
