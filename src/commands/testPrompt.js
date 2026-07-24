import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { generatePromptText, prompts } from '../services/prompts.js';

const ALLOWED_USER_ID = '603324775833665553';

export default {
  data: new SlashCommandBuilder()
    .setName('prompt-test')
    .setDescription('Generate a random AI prompt')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('The type of prompt to generate')
        .setRequired(false)
        .addChoices(
          { name: 'Challenge', value: 'challenge' },
          { name: 'Theme', value: 'theme' },
          { name: 'Dev Tip', value: 'devtip' },
          { name: 'Showcase', value: 'showcase' },
          { name: 'Story', value: 'story' },
          { name: 'Marketing', value: 'marketing' },
          { name: 'Help', value: 'help' },
        )
    ),

  async execute(interaction) {
    if (interaction.user.id !== ALLOWED_USER_ID) {
      return interaction.reply({
        content: 'This command is only available to the bot owner.',
        flags: [MessageFlags.Ephemeral],
      });
    }

    try {
      const typeOption = interaction.options.getString('type')?.toLowerCase();
      const availableTypes = [...Object.keys(prompts), 'theme'];

      if (typeOption === 'help') {
        return interaction.reply({
          content: `**Available prompt types:**\n- ${availableTypes.join('\n- ')}\n\nLeave blank for a random one.`,
          flags: [MessageFlags.Ephemeral],
        });
      }

      let targetType = typeOption;
      if (!targetType) {
        targetType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      }

      if (!availableTypes.includes(targetType)) {
        // This case shouldn't be reached often due to Choices, but good for manual API calls
        return interaction.reply({
          content: `Unknown prompt type: \`${targetType}\`. Use \`/prompt-test help\` to see available types.`,
          flags: [MessageFlags.Ephemeral],
        });
      }

      await interaction.deferReply();

      console.log(`Generating prompt: ${targetType}`);

      let result;
      if (targetType === 'theme') {
        const { runThemeNow } = await import('../cron/theme.js');
        await new Promise((resolve, reject) => {
          runThemeNow((msg) => {
            result = msg;
            resolve();
          }).catch(reject);
        });
      } else {
        result = await generatePromptText(targetType);
      }

      await interaction.editReply({
        content: `**${targetType.toUpperCase()}**\n\n${result || 'No response generated'}`
      });

    } catch (error) {
      console.error('Prompt test failed:', error);

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: 'Failed to generate prompt.'
        });
      } else {
        await interaction.reply({
          content: 'Failed to generate prompt.',
          flags: [MessageFlags.Ephemeral],
        });
      }
    }
  },
};
