import { Client, GatewayIntentBits } from 'discord.js';

// import { commandHandlers } from './src/commands';

import initializeScheduledEvents from './src/cron';
import initializeStreams from './src/stream';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.login(process.env.BOT_TOKEN);

client.once('ready', () => {
  console.log(`Bot started at ${new Date()}`);
  initializeScheduledEvents();
  initializeStreams();
});

/* client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'comparegames') {
    await commandHandlers.compareGames(interaction);
  }
}); */

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
});
