import { compareGames } from './steam.js';
import { testTheme } from './themeTest.js';
import gamedevCommand from './idea.js';

export const commandHandlers = {
  compareGames,
  testTheme,
  gamedev: gamedevCommand.execute,
};
