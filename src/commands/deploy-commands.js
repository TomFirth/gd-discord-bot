import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from 'config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];

// Grab all the command folders from the commands directory
const foldersPath = __dirname;
const commandFolders = fs.readdirSync(foldersPath);

const commandFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.js') && file !== 'deploy-commands.js');

for (const file of commandFiles) {
  const filePath = path.join(__dirname, file);
  const commandModule = await import(`file://${filePath}`);
  const command = commandModule.default ?? commandModule;

  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing "data" or "execute".`);
  }
}


// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.BOT_ID, config.guildId),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
