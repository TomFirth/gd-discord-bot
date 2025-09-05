import { EmbedBuilder } from 'discord.js';
import Parser from 'rss-parser';
import config from 'config';
import fs from 'fs/promises';
import path from 'path';

const parser = new Parser();
const channelId = config.get('channelIds.freegames');
const feedUrl = config.get('urls.free');

// File to track already posted items
const postedItemsFile = path.resolve('./data/posted-items.json');

// Ensure data folder exists
async function ensureDataFolder() {
  await fs.mkdir(path.dirname(postedItemsFile), { recursive: true });
}

// Load previously posted items
const loadPostedItems = async (): Promise<Set<string>> => {
  try {
    const data = await fs.readFile(postedItemsFile, 'utf8');
    return new Set(JSON.parse(data));
  } catch (err: any) {
    if (err.code === 'ENOENT') return new Set();
    throw err;
  }
};

// Save posted items
const savePostedItems = async (set: Set<string>) => {
  const arr = Array.from(set);
  await fs.writeFile(postedItemsFile, JSON.stringify(arr, null, 2));
};

export const free = async (client) => {
  try {
    await ensureDataFolder();

    const postedItems = await loadPostedItems();
    const feed = await parser.parseURL(feedUrl);
    const channel = await client.channels.fetch(channelId);

    if (!channel?.isTextBased() || !feed.items) {
      console.warn('Channel or feed missing');
      return;
    }

    let newPosts = false;

    for (const item of feed.items) {
      const uniqueId = `${item.link || item.guid || item.title}-${item.pubDate || ''}`;

      if (postedItems.has(uniqueId)) continue;

      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(item.title || 'Untitled')
        .setURL(item.link || '')
        .setDescription(item.contentSnippet || item.content || item.description || 'No description available.');

      const sentMessage = await channel.send({ embeds: [embed] });

      try {
        await sentMessage.crosspost();
      } catch (err) {
        console.warn('Failed to crosspost message:', err);
      }

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
