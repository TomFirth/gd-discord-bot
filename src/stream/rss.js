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
const USER_AGENT = 'GDBot/2.0 (rss-watcher)';

// File to track posted items per feed
const POSTED_ITEMS_FILE = path.resolve('./data/rss-posted-items.json');

async function ensureDataFolder() {
  await fs.mkdir(path.dirname(POSTED_ITEMS_FILE), { recursive: true });
}

const readPostedObj = async () => {
  try {
    const raw = await fs.readFile(POSTED_ITEMS_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
};

const writePostedObj = async (obj) => {
  await fs.writeFile(POSTED_ITEMS_FILE, JSON.stringify(obj, null, 2), 'utf8');
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const checkSingleFeed = async (client, feedKey, feedConfig) => {
  try {
    const feedUrl = feedConfig.url;
    if (!feedUrl) return;

    await ensureDataFolder();

    // Load latest posted items for this feed only
    const postedObj = await readPostedObj();
    const postedSet = new Set(postedObj[feedKey] || []);

    // Fetch feed with retries and proper headers
    const res = await withRetry(() => axios.get(feedUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml' },
      responseType: 'text',
      timeout: 15000,
    }), { retries: 3, baseDelayMs: 2000 });

    const feed = await parser.parseString(res.data);
    if (!feed || !feed.items || feed.items.length === 0) return;

    // If this feed hasn't been seen before (no entry in the posted-items store),
    // initialize it with the current items and do NOT post historical items.
    if (postedObj[feedKey] === undefined) {
      const currentIds = [];
      for (const it of feed.items) {
        const id = `${it.link || it.guid || it.title}-${it.pubDate || it.isoDate || ''}`;
        currentIds.push(id);
      }
      postedObj[feedKey] = currentIds;
      await writePostedObj(postedObj);
      console.log(`Initialized RSS feed '${feedKey}' with ${currentIds.length} existing items — will post only new items going forward.`);
      return;
    }

    // Process items oldest-first so posts appear in chronological order
    for (const item of feed.items.reverse()) {
      const uniqueId = `${item.link || item.guid || item.title}-${item.pubDate || item.isoDate || ''}`;
      if (postedSet.has(uniqueId)) continue;

      // Use the item's URL as plain message content so Discord will unfurl it
      const url = item.link || '';

      // Resolve discord channel id
      const targetName = feedConfig.channel || 'general';
      let discordChannelId;
      try {
        discordChannelId = config.get(`channelIds.${targetName}`);
      } catch (err) {
        console.warn('Invalid channel mapping for RSS feed', feedKey, targetName);
        continue;
      }

      let discordChannel = client.channels.cache.get(discordChannelId);
      if (!discordChannel) {
        try {
          discordChannel = await client.channels.fetch(discordChannelId);
        } catch (err) {
          console.warn('Failed to fetch Discord channel for RSS post:', { feedKey, discordChannelId, err: err && err.message ? err.message : err });
        }
      }

      if (!discordChannel || !discordChannel.isTextBased()) {
        console.warn('Discord channel missing or not text-based for RSS post', { feedKey, discordChannelId });
        // don't mark as posted so we can retry later
        continue;
      }

      try {
        const sent = await discordChannel.send({ content: url });
        try { await sent.crosspost(); } catch (err) { /* ignore */ }
        try { await sent.react('👍'); await sent.react('👎'); } catch (err) { /* ignore */ }

        // Mark posted and persist
        postedSet.add(uniqueId);
        postedObj[feedKey] = Array.from(postedSet);
        await writePostedObj(postedObj);
      } catch (err) {
        console.error('Failed to send RSS post to Discord:', { feedKey, title: item.title, err: err && err.stack ? err.stack : (err && err.message ? err.message : err) });
        // don't mark as posted so it can be retried
      }

      // Small pause between posting multiple items
      await sleep(1500);
    }
  } catch (err) {
    console.warn('RSS feed check failed for', feedKey, err && err.stack ? err.stack : (err && err.message ? err.message : err));
  }
};

export const startRssFeeds = (client) => {
  if (!config?.has || !config.has('rss.feeds')) {
    console.log('rss.feeds not configured — skipping RSS streamer');
    return;
  }

  const feeds = config.get('rss.feeds');
  const feedEntries = Object.entries(feeds);
  if (feedEntries.length === 0) return;

  // Default to once per day (seconds)
  const DEFAULT_INTERVAL_SECONDS = 24 * 60 * 60;

  feedEntries.forEach(([feedKey, feedConfig], idx) => {
    const intervalSeconds = feedConfig.intervalSeconds || DEFAULT_INTERVAL_SECONDS;

    // Stagger the initial run so feeds don't all run at the same time.
    // Spread initial runs evenly across the interval window, with a small random jitter.
    const baseDelayMs = Math.floor((idx * (intervalSeconds / feedEntries.length)) * 1000);
    const jitterMs = Math.floor(Math.random() * 5 * 60 * 1000); // up to 5 minutes
    const initialDelayMs = baseDelayMs + jitterMs;

    const runOnce = async () => {
      await checkSingleFeed(client, feedKey, feedConfig);
    };

    // Schedule first run after initialDelayMs, then on interval
    setTimeout(() => {
      runOnce();
      setInterval(runOnce, intervalSeconds * 1000);
    }, initialDelayMs);
  });
};
