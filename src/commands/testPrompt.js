import { SlashCommandBuilder } from 'discord.js';
import { generatePromptText, prompts } from '../services/prompts.js';

export default {
  data: new SlashCommandBuilder()
    .setName('prompt-test')
    .setDescription('Generate a random AI prompt'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const types = Object.keys(prompts);
      const randomType = types[Math.floor(Math.random() * types.length)];

      console.log(`Generating prompt: ${randomType}`);

      const result = await generatePromptText(randomType);

      await interaction.editReply({
        content: `**${randomType.toUpperCase()}**\n\n${result || 'No response generated'}`
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
          ephemeral: true
        });
      }
    }
  },
};