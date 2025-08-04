import Parser from 'rss-parser';
import config from 'config';
import fs from 'fs/promises';
import path from 'path';

const parser = new Parser();
const channelId = config.get('channelIds.freegames');
const feedUrl = config.get('urls.free');

const postedItemsFile = path.resolve('./data/posted-items.json');

async function loadPostedItems() {
  try {
    const data = await fs.readFile(postedItemsFile, 'utf8');
    return new Set(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') return new Set();
    throw err;
  }
}

async function savePostedItems(set) {
  const arr = Array.from(set);
  await fs.writeFile(postedItemsFile, JSON.stringify(arr, null, 2));
}

export const free = async (client) => {
  try {
    const postedItems = await loadPostedItems();
    const feed = await parser.parseURL(feedUrl);
    const channel = await client.channels.fetch(channelId);

    if (!channel || !feed.items) {
      console.warn('Channel or feed missing');
      return;
    }

    let newPosts = false;

    for (const item of feed.items) {
    const uniqueId = item.link || item.guid || item.title;

    if (postedItems.has(uniqueId)) continue;

    const messageContent = `${item.title}\n${item.link}`;
    const sentMessage = await channel.send(messageContent);

    try {
      await sentMessage.react('👍');
      await sentMessage.react('👎');
    } catch (err) {
      console.warn('Failed to add reactions:', err);
    }

    postedItems.add(uniqueId);
    newPosts = true;
  }

    if (newPosts) {
      await savePostedItems(postedItems);
    }
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
  }
};

export function startFreeStream(client) {
  free(client);
  setInterval(() => free(client), 60 * 60 * 1000);
}
