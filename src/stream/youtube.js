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

// Files used for persistence
const POSTED_ITEMS_FILE = path.resolve('./data/youtube-posted-items.json');
const LASTSEEN_FILE = path.resolve('./data/youtube-lastseen.json');

// Ensure data folder exists
async function ensureDataFolder() {
  await fs.mkdir(path.dirname(POSTED_ITEMS_FILE), { recursive: true });
}

// Posted items (Set) helpers — similar to src/stream/free.js
const loadPostedItems = async () => {
  try {
    const data = await fs.readFile(POSTED_ITEMS_FILE, 'utf8');
    return new Set(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') return new Set();
    throw err;
  }
};

const savePostedItems = async (set) => {
  const arr = Array.from(set);
  await fs.writeFile(POSTED_ITEMS_FILE, JSON.stringify(arr, null, 2), 'utf8');
};

// Last-seen per feed helpers
const readLastSeen = async () => {
  try {
    const raw = await fs.readFile(LASTSEEN_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
};

const writeLastSeen = async (data) => {
  await fs.writeFile(LASTSEEN_FILE, JSON.stringify(data, null, 2), 'utf8');
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

export const startYoutubeFeeds = (client) => {
  if (!config?.has || !config.has('youtube.feeds')) {
    console.log('youtube.feeds not configured — skipping YouTube streamer');
    return;
  }

  const feeds = config.get('youtube.feeds');

  // Default polling interval (seconds) if not provided per-feed
  const DEFAULT_INTERVAL_SECONDS = 60 * 60; // 1 hour

  Object.entries(feeds).forEach(([feedKey, feedConfig]) => {
    const intervalSeconds = feedConfig.intervalSeconds || DEFAULT_INTERVAL_SECONDS;

    const runOnce = async () => {
      try {
        await ensureDataFolder();
        const postedItems = await loadPostedItems();
        const lastSeen = await readLastSeen();
        lastSeen[feedKey] = lastSeen[feedKey] || null;

        const feedOpts = {
          channelId: feedConfig.channelId || null,
          channelHandle: feedConfig.channelHandle || null,
        };

        const feed = await fetchYoutubeFeed(feedOpts);
        if (!feed || !feed.items || feed.items.length === 0) return;

        const item = feed.items[0];
        if (!item) return;

        const itemPub = item.pubDate || item.isoDate || '';
        const itemTitle = item.title || '';
        const uniqueId = `${item.link || (item.id && item.id.split(':').pop()) || item.guid || itemTitle}-${itemPub}`;

        // First run for this feed: set lastSeen to current item and don't post older items
        if (!lastSeen[feedKey]) {
          lastSeen[feedKey] = itemPub;
          await writeLastSeen(lastSeen);
          return;
        }

        // If we've already processed this latest item (by pub date), skip
        if (lastSeen[feedKey] === itemPub) return;

        // If item already posted (in posted items set), skip
        if (postedItems.has(uniqueId)) {
          // still update lastSeen so we don't check again
          lastSeen[feedKey] = itemPub;
          await writeLastSeen(lastSeen);
          return;
        }

        // Check title patterns
        let matched = null;
        for (const p of PATTERNS) {
          if (p.regex.test(itemTitle)) { matched = p; break; }
        }

        // Decide target channel: pattern-mapped channel wins, otherwise feed-config channel
        const targetName = matched ? matched.channel : feedConfig.discordChannel;

        if (matched) {
          const discordChannelId = config.get(`channelIds.${targetName}`);
          let discordChannel = client.channels.cache.get(discordChannelId);
          if (!discordChannel) {
            try {
              discordChannel = await client.channels.fetch(discordChannelId);
            } catch (err) {
              console.log('Failed to fetch Discord channel for YouTube post:', { feedKey, discordChannelId, err: err && err.message ? err.message : err });
            }
          }

          if (discordChannel) {
            try {
              // Build embed similar to other stream jobs
              let description = '';
              if (item.content || item.contentSnippet || item.description) {
                description = item.content || item.contentSnippet || item.description || '';
                description = description.replace(/<\/?[^>]+(>|$)/gi, '');
              }
              const url = item.link || `https://youtu.be/${(item.id && item.id.split(':').pop()) || ''}`;

              // Send plain URL so Discord will unfurl the video preview
              await discordChannel.send({ content: url });

              // Mark posted and update lastSeen
              postedItems.add(uniqueId);
              await savePostedItems(postedItems);
              lastSeen[feedKey] = itemPub;
              await writeLastSeen(lastSeen);
            } catch (err) {
              // Log failure for later debugging and do not advance lastSeen so it can be retried
              console.log('Failed to send YouTube post to Discord:', { feedKey, title: itemTitle, id: uniqueId, err: err && err.stack ? err.stack : (err && err.message ? err.message : err) });
            }
          }
        } else {
          // Not matched — update lastSeen so we don't repeatedly check the same latest video
          lastSeen[feedKey] = itemPub;
          await writeLastSeen(lastSeen);
        }
      } catch (err) {
        console.log('YouTube feed check failed for', feedKey, err && err.stack ? err.stack : (err && err.message ? err.message : err));
      }
    };

    // Run immediately, then on interval
    runOnce();
    setInterval(runOnce, intervalSeconds * 1000);
  });
};
