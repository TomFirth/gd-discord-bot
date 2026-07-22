import { compareGames } from './steam.js';
import gamedevCommand from './idea.js';
import { prompts } from './prompts.js';

export const commandHandlers = {
  compareGames,
  gamedev: gamedevCommand.execute,
  prompts
};
