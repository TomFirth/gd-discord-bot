import Parser from 'rss-parser';
import config from 'config';

const parser = new Parser();
const channelId = config.get('channelIds.freegames');
const feedUrl = config.get('urls.free');

const postedItems = new Set();

export const free = async (client) => {
  try {
    const feed = await parser.parseURL(feedUrl);
    const channel = await client.channels.fetch(channelId);

    if (!channel || !feed.items) {
      console.warn('Channel or feed missing');
      return;
    }

    for (const item of feed.items) {
      const uniqueId = item.link || item.guid || item.title;

      // Skip if already posted
      if (postedItems.has(uniqueId)) continue;

      const message = `${item.title}\n${item.link}`;
      await channel.send(message);
      postedItems.add(uniqueId);
    }
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
  }
};

export function startFreeStream(client) {
  free(client);
  setInterval(() => free(client), 60 * 60 * 1000);
}
