import { compareGames } from './steam.js';
import gamedevCommand from './idea.js';

export const commandHandlers = {
  compareGames,
  gamedev: gamedevCommand.execute
};
