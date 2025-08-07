import axios from 'axios';
import { CronJob } from 'cron';
import config from 'config';

const subreddits = ['unity', 'Unity3D', 'Unity2D', 'godot', 'unrealengine'];
const channelId = config.get('channelIds.unrelated');
const schedule = config.get('schedule.topPost');

const getTopPost = async (subreddit) => { 
  try {
    const res = await axios.get(`https://www.reddit.com/r/${subreddit}/top.json`, {
      params: { limit: 1, t: 'day' },
      headers: { 'User-Agent': 'DiscordBot/1.0 (by u/yourusername)' }
    });

    const post = res.data?.data?.children?.[0]?.data;
    if (!post) return null;

    return {
      title: post.title,
      score: post.score,
      url: `https://reddit.com${post.permalink}`,
      subreddit,
    };
  } catch (err) {
    console.error(`Failed to fetch from /r/${subreddit}:`, err.message);
    return null;
  }
}

export const topPost = (client) => {
  new CronJob(schedule, async () => {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    const posts = await Promise.all(subreddits.map(getTopPost));
    const validPosts = posts.filter(Boolean);
    if (validPosts.length === 0) return;

    const top = validPosts.reduce((a, b) => (a.score > b.score ? a : b));
    const message = `🔥${top.subreddit}**\n**${top.title}**\n⬆️ ${top.score} upvotes\n🔗 ${top.url}`;

    await channel.send(message);
  }).start();
};
