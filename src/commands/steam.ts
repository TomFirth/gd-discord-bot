import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';
import config from 'config';

export const command = new SlashCommandBuilder()
  .setName('comparegames')
  .setDescription('Compares games between two Steam users')
  .addStringOption(option =>
    option.setName('your_steam_id')
          .setDescription('Your Steam ID')
          .setRequired(true))
  .addStringOption(option =>
    option.setName('other_steam_id')
          .setDescription('Other user\'s Steam ID')
          .setRequired(true));

export const compareGames = async (interaction: ChatInputCommandInteraction ) => {
  const yourSteamId = interaction.options.getString('your_steam_id')!;
  const otherSteamId = interaction.options.getString('other_steam_id')!;

  const fetchOwnedGames = async (steamId: string) => {
    const STEAM_API_KEY = config.get<string>('steamApiKey');
    const STEAM_OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/';

    try {
      const response = await axios.get(STEAM_OWNED_GAMES_URL, {
        params: {
          key: STEAM_API_KEY,
          steamid: steamId,
          include_appinfo: true,
          format: 'json',
        },
      });
      return response.data.response.games || [];
    } catch (error) {
      console.error('Error fetching owned games:', error);
      return [];
    }
  };

  const yourGames = await fetchOwnedGames(yourSteamId);
  const otherGames = await fetchOwnedGames(otherSteamId);

  const yourGameTitles = yourGames.map((game: { name: any; }) => game.name);
  const otherGameTitles = otherGames.map((game: { name: any; }) => game.name);

  const commonGames = yourGameTitles.filter((game: any) => otherGameTitles.includes(game));

  if (commonGames.length > 0) {
    await interaction.reply(`Common games between you and <@${otherSteamId}>:\n${commonGames.join(', ')}`);
  } else {
    await interaction.reply(`No common games found between you and <@${otherSteamId}>.`);
  }
};
