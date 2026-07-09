import axios from 'axios';
import Parser from 'rss-parser';
import { CronJob } from 'cron';
import config from 'config';

const parser = new Parser();
const USER_AGENT = 'DiscordBot/1.0 (by u/yourusername)';

const getRedditRssUrl = (subreddit) =>
  `https://www.reddit.com/r/${subreddit}/top/.rss?limit=1&t=day`;

export const fetchRedditTopItem = async (subreddit) => {
  try {
    const res = await axios.get(getRedditRssUrl(subreddit), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml',
      },
      responseType: 'text',
      timeout: 15000,
    });

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

const formatPost = (post) =>
  `**r/${post.subreddit}**: ${post.title}\n${post.url}`;

export const startRedditFeeds = (client) => {
  const feeds = config.get('reddit.feeds');

  Object.values(feeds).forEach((feedConfig) => {
    const { schedule, channel, subreddits } = feedConfig;
    const channelId = config.get(`channelIds.${channel}`);

    new CronJob(schedule, async () => {
      const discordChannel = client.channels.cache.get(channelId);
      if (!discordChannel) return;

      const posts = await Promise.all(subreddits.map(fetchRedditTopItem));
      const validPosts = posts.filter(Boolean);
      if (validPosts.length === 0) return;

      const message = validPosts.map(formatPost).join('\n\n');
      await discordChannel.send(message);
    }).start();
  });
};
