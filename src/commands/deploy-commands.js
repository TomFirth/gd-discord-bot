import { Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../../config/default.json' with { type: 'json' };

// --------------------------------------------------
// ESM replacement for __dirname
// --------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------
// Load commands
// --------------------------------------------------
const commands = [];
const foldersPath = path.resolve(__dirname);
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs
		.readdirSync(commandsPath)
		.filter(file => file.endsWith('.js'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);

		// 🔥 ESM dynamic import
		const command = await import(`file://${filePath}`);

		if (command.default?.data && command.default?.execute) {
			commands.push(command.default.data.toJSON());
		} else {
			console.warn(
				`[WARNING] The command at ${filePath} is missing "data" or "execute".`
			);
		}
	}
}

// --------------------------------------------------
// Deploy commands
// --------------------------------------------------
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
	try {
		console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

		const data = await rest.put(
			Routes.applicationGuildCommands(
				process.env.BOT_ID,
				config.guildId
			),
			{ body: commands }
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error('Error deploying commands:', error);
	}
})();
