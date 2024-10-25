import Parser from 'rss-parser';
import { Client, TextChannel } from 'discord.js';
import config from 'config';

const parser = new Parser();
const channelId = config.get<string>('channelIds.freegames');
const feedUrl = config.get<string>('urls.free');

const client = new Client({ intents: [] });

const free = async () => {
  try {
    const feed = await parser.parseURL(feedUrl);
    const channel = await client.channels.fetch(channelId) as TextChannel;

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

setInterval(free, 60 * 60 * 1000);

export default free;