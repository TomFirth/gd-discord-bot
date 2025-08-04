import Parser from 'rss-parser';
import config from 'config';

const parser = new Parser();
const channelId = config.get('channelIds.freegames');
const feedUrl = config.get('urls.free');

export const free = async (client) => {
  try {
    const feed = await parser.parseURL(feedUrl);
    const channel = await client.channels.fetch(channelId);

    feed.items.forEach(item => {
      const message = `${item.title}\n${item.link}`;
      if (channel) {
        channel.send(message);
      }
    });
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
  }
};
