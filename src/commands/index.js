import { compareGames } from './steam.js';
import gamedevCommand from './idea.js';
import promptTestCommand from './testPrompt.js';

export const commandHandlers = {
  steamcompare: compareGames,
  gamedev: gamedevCommand.execute,
  'prompt-test': promptTestCommand.execute,
};
