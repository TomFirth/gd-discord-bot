import axios from 'axios';
import Parser from 'rss-parser';
import { CronJob } from 'cron';
import dotenv from 'dotenv';
import { withRetry } from '../utils/retry.js';

const RETRY_DELAY_MS = 2000;

dotenv.config();

if (process.env.NODE_APP_INSTANCE === '0') {
  delete process.env.NODE_APP_INSTANCE;
}

const { default: config } = await import('config');

const parser = new Parser();
const USER_AGENT = 'DiscordBot/1.0 (by u/yourusername)';

const getRedditRssUrl = (subreddit) =>
  `https://www.reddit.com/r/${subreddit}/top/.rss?limit=1&t=day`;

export const fetchRedditTopItem = async (subreddit) => {
  try {
    const res = await withRetry(() => axios.get(getRedditRssUrl(subreddit), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml',
      },
      responseType: 'text',
      timeout: 15000,
      maxRedirects: 3,
    }), { retries: 3, baseDelayMs: RETRY_DELAY_MS });

    const feed = await parser.parseString(res.data);
    const item = feed.items?.[0];
    if (!item) return null;

    return {
      title: item.title || 'Untitled',
      url: item.link || `https://reddit.com/r/${subreddit}`,
      subreddit,
      published: item.isoDate || item.pubDate || '',
    };
  } catch (error) {
    console.error(`Failed to fetch Reddit RSS for /r/${subreddit}:`, error.message);
    return null;
  }
};

export const startRedditFeeds = (client) => {
  const feeds = config.get('reddit.feeds');

  Object.values(feeds).forEach((feedConfig) => {
    const { schedule, channel, subreddits } = feedConfig;
    const channelId = config.get(`channelIds.${channel}`);

    new CronJob(schedule, async () => {
      const discordChannel = client.channels.cache.get(channelId);
      if (!discordChannel) return;

      const posts = [];
      for (const subreddit of subreddits) {
        const post = await fetchRedditTopItem(subreddit);
        if (post) posts.push(post);
      }

      const validPosts = posts.filter(Boolean);
      if (validPosts.length === 0) return;

      const message = validPosts.map((post) => `/${post.subreddit}: [${post.title}](${post.url})`).join('\n\n');
      await discordChannel.send(message);
    }).start();
  });
};
