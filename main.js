import { Client, GatewayIntentBits, MessageFlags } from 'discord.js';
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

client.once('clientReady', async (readyClient) => {
  console.log(`Bot started at ${new Date()}`);
  await initializeScheduledEvents(readyClient);
  await initializeStreams(readyClient);
});

const commandCooldowns = new Map();
const COMMAND_COOLDOWN_MS = 10000;

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, user } = interaction;
  const key = `${user.id}:${commandName}`;
  const now = Date.now();
  const last = commandCooldowns.get(key) ?? 0;

  if (now - last < COMMAND_COOLDOWN_MS) {
    const remaining = Math.ceil((COMMAND_COOLDOWN_MS - (now - last)) / 1000);
    return interaction.reply({
      content: `Please wait ${remaining} second${remaining === 1 ? '' : 's'} before using \`/${commandName}\` again.`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  commandCooldowns.set(key, now);
  setTimeout(() => {
    if (commandCooldowns.get(key) === now) {
      commandCooldowns.delete(key);
    }
  }, COMMAND_COOLDOWN_MS);

  try {
    const handler = commandHandlers[commandName];

    if (!handler) {
      return interaction.reply({
        content: `Unknown command: ${commandName}`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    await handler(interaction);
  } catch (error) {
    console.error('Command execution error:', error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'An internal error occurred while running this command.' });
    } else {
      await interaction.reply({ content: 'An internal error occurred while running this command.', flags: [MessageFlags.Ephemeral] });
    }
  }
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith('!remindme')) {
    message.channel.send('Remind yourself.');
  }
});
