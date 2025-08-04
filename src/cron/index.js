import challenge from './challenge.js';
import gameJam from './gamejam.js';
import theme from './theme.js';

export const initializeScheduledEvents = () => {
  challenge();
  gameJam();
  theme();
};
