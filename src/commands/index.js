import { REST, Routes } from 'discord.js';
import { command as compareGamesCommand, compareGames } from './steam.js';
import config from 'config';

const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(config.get(process.env.BOT_ID), config.get('guildId')), {
      body: [compareGamesCommand.toJSON()],
    });
    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error(error);
  }
})();

export const commandHandlers = {
  compareGames,
};
