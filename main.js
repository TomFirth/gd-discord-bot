import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

import { commandHandlers } from './src/commands/index.js';
import { initializeScheduledEvents } from './src/cron/index.js';
import { initializeStreams } from './src/stream/index.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.login(process.env.BOT_TOKEN);

client.once('ready', async () => {
  console.log(`Bot started at ${new Date()}`);
  await initializeScheduledEvents(client);
  await initializeStreams(client);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'comparegames') {
    await commandHandlers.compareGames(interaction);
  }
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
});
