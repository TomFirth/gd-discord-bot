import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder } from 'discord.js';
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
        include_played_free_games: true,
        include_free_subs: true,
        format: 'json',
      },
    });
    return response.data.response.games || [];
  } catch (error) {
    console.error('Error fetching owned games:', error.message);
    return [];
  }
};

const fetchAppDetails = async (appid) => {
  try {
    const response = await axios.get('https://store.steampowered.com/api/appdetails', {
      params: {
        appids: appid,
        cc: 'us',
        l: 'en',
        filters: 'categories',
      },
    });

    return response.data?.[appid]?.data?.categories || [];
  } catch (error) {
    console.error(`Error fetching Steam app details for ${appid}:`, error.message);
    return [];
  }
};

const MULTIPLAYER_CATEGORY_IDS = new Set([1, 9, 38, 44, 49, 36, 47, 27, 48]);
const MULTIPLAYER_CATEGORY_RE = /multi[- ]player|multiplayer|co[- ]op|online co-op|online pvp|lan pvp|pvp|cross-platform/i;

const isMultiplayerApp = (categories) => {
  if (!Array.isArray(categories)) return false;
  return categories.some((category) => {
    if (MULTIPLAYER_CATEGORY_IDS.has(category.id)) return true;
    return MULTIPLAYER_CATEGORY_RE.test(category.description);
  });
};

const getCommonMultiplayerGames = async (commonGames) => {
  const multiplayerGames = [];
  const results = await Promise.all(commonGames.map(async (game) => {
    const categories = await fetchAppDetails(game.appid);
    return isMultiplayerApp(categories) ? game : null;
  }));

  for (const game of results) {
    if (game && multiplayerGames.length < 12) {
      multiplayerGames.push(game);
    }
  }

  return multiplayerGames;
};

export async function compareGames(interaction) {
  await interaction.deferReply();

  try {
    const yourSteamId = interaction.options.getString('your_steam_id');
    const otherSteamId = interaction.options.getString('other_steam_id');

    if (!yourSteamId || !otherSteamId) {
      return interaction.editReply('Both Steam IDs are required.');
    }

    const resolvedYourSteamId = await resolveSteamId(yourSteamId);
    const resolvedOtherSteamId = await resolveSteamId(otherSteamId);

    if (!resolvedYourSteamId || !resolvedOtherSteamId) {
      return interaction.editReply('Could not resolve one or both Steam IDs. Use a valid Steam64 ID or vanity URL name.');
    }

    const yourGames = await fetchOwnedGames(resolvedYourSteamId);
    const otherGames = await fetchOwnedGames(resolvedOtherSteamId);

    if (yourGames.length === 0 || otherGames.length === 0) {
      return interaction.editReply('Could not retrieve one or both game libraries. The Steam profile may be private or invalid.');
    }

    const commonGames = yourGames.filter((yourGame) =>
      otherGames.some((otherGame) => otherGame.appid === yourGame.appid)
    );

    if (commonGames.length === 0) {
      return interaction.editReply(`No common games found between you and **${otherSteamId}**.`);
    }

    const multiplayerGames = await getCommonMultiplayerGames(commonGames);

    if (multiplayerGames.length === 0) {
      return interaction.editReply(`No common multiplayer games found between you and **${otherSteamId}**.`);
    }

    const description = multiplayerGames
      .map((game, index) => `${index + 1}. ${game.name}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`Common multiplayer games with ${otherSteamId}`)
      .setDescription(description)
      .setFooter({ text: `${multiplayerGames.length} common multiplayer game${multiplayerGames.length === 1 ? '' : 's'}` });

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Steam compare command error:', error);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply('An error occurred while comparing Steam libraries.');
    }
    return interaction.reply({ content: 'An error occurred while comparing Steam libraries.', ephemeral: true });
  }
}

export default {
  data: command,
  execute: compareGames,
};
