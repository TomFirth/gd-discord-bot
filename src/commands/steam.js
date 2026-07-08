import { SlashCommandBuilder } from '@discordjs/builders';
import axios from 'axios';

const command = new SlashCommandBuilder()
  .setName('steamcompare')
  .setDescription('Compares games between two Steam users')
  .addStringOption(option =>
    option.setName('your_steam_id')
      .setDescription('Your Steam ID or vanity name')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('other_steam_id')
      .setDescription('Other user\'s Steam ID or vanity name')
      .setRequired(true)
  );

const resolveSteamId = async (steamIdOrVanity) => {
  if (/^\d+$/.test(steamIdOrVanity)) {
    return steamIdOrVanity;
  }

  try {
    const response = await axios.get('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/', {
      params: {
        key: process.env.STEAM_API_KEY,
        vanityurl: steamIdOrVanity,
      },
    });

    if (response.data?.response?.success === 1) {
      return response.data.response.steamid;
    }

    return null;
  } catch (error) {
    console.error('Error resolving Steam vanity URL:', error.message);
    return null;
  }
};

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

export async function compareGames(interaction) {
  const yourSteamId = interaction.options.getString('your_steam_id');
  const otherSteamId = interaction.options.getString('other_steam_id');

  if (!yourSteamId || !otherSteamId) {
    return interaction.reply('Both Steam IDs are required.');
  }

  const resolvedYourSteamId = await resolveSteamId(yourSteamId);
  const resolvedOtherSteamId = await resolveSteamId(otherSteamId);

  if (!resolvedYourSteamId || !resolvedOtherSteamId) {
    return interaction.reply('Could not resolve one or both Steam IDs. Use a valid Steam64 ID or vanity URL name.');
  }

  const yourGames = await fetchOwnedGames(resolvedYourSteamId);
  const otherGames = await fetchOwnedGames(resolvedOtherSteamId);

  const yourGameTitles = yourGames.map((game) => game.name);
  const otherGameTitles = otherGames.map((game) => game.name);

  if (yourGameTitles.length === 0 || otherGameTitles.length === 0) {
    return interaction.reply('Could not retrieve one or both game libraries. The Steam profile may be private or invalid.');
  }

  const commonGames = yourGameTitles.filter((game) => otherGameTitles.includes(game));

  if (commonGames.length > 0) {
    await interaction.reply(`Common games between you and **${otherSteamId}**:\n${commonGames.join(', ')}`);
  } else {
    await interaction.reply(`No common games found between you and **${otherSteamId}**.`);
  }
}

export default {
  data: command,
  execute: compareGames,
};
