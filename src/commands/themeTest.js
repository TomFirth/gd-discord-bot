import { SlashCommandBuilder } from '@discordjs/builders';
import { runThemeNow } from '../cron/theme.js';

const OWNER_ID = '603324775833665553';

const data = new SlashCommandBuilder()
  .setName('theme-test')
  .setDescription('Run the theme cron generator immediately (owner only)');

export async function testTheme(interaction) {
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  await runThemeNow(async (theme) => {
    await interaction.editReply({ content: `GameJam theme: ${theme}` });
  });
}

export default {
  data,
  execute: testTheme,
};
