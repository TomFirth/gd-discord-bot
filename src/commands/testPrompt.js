import { SlashCommandBuilder } from 'discord.js';
import { generatePromptText } from '../services/prompts.js';

export default {
  data: new SlashCommandBuilder()
    .setName('prompt-test')
    .setDescription('Generate a random AI prompt'),

  async execute(interaction) {
    await interaction.deferReply();

    const types = Object.keys(prompts);
    const randomType = types[Math.floor(Math.random() * types.length)];

    try {
      const result = await generatePromptText(randomType);

      await interaction.editReply({
        content: `**${randomType.toUpperCase()}**\n\n${result || 'No response generated'}`
      });

    } catch (error) {
      console.error('Prompt test failed:', error);

      await interaction.editReply({
        content: 'Failed to generate prompt.'
      });
    }
  },
};