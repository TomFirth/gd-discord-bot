const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');

const command = new SlashCommandBuilder()
  .setName('steamcompare')
  .setDescription('Compares games between two Steam users')
  .addStringOption(option =>
    option.setName('your_steam_id')
      .setDescription('Your Steam ID')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('other_steam_id')
      .setDescription('Other user\'s Steam ID')
      .setRequired(true)
  );

async function compareGames(interaction) {
  const yourSteamId = interaction.options.getString('your_steam_id');
  const otherSteamId = interaction.options.getString('other_steam_id');

  if (!yourSteamId || !otherSteamId) {
    return interaction.reply('Both Steam IDs are required.');
  }

  const fetchOwnedGames = async (steamId) => {
    const STEAM_OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/';

    try {
      const response = await axios.get(STEAM_OWNED_GAMES_URL, {
        params: {
          key: process.env.STEAM_API_KEY,
          steamid: steamId,
          include_appinfo: true,
          format: 'json',
        },
      });
      return response.data.response.games || [];
    } catch (error) {
      console.error('Error fetching owned games:', error.message);
      return [];
    }
  };

  const yourGames = await fetchOwnedGames(yourSteamId);
  const otherGames = await fetchOwnedGames(otherSteamId);

  const yourGameTitles = yourGames.map((game) => game.name);
  const otherGameTitles = otherGames.map((game) => game.name);

  const commonGames = yourGameTitles.filter((game) => otherGameTitles.includes(game));

  if (commonGames.length > 0) {
    await interaction.reply(`Common games between you and **${otherSteamId}**:\n${commonGames.join(', ')}`);
  } else {
    await interaction.reply(`No common games found between you and **${otherSteamId}**.`);
  }
}

module.exports = { command, compareGames };
