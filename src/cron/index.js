import codeChallenge from './challenge';
import gameJam from './gamejam';
import theme from './theme';

const initializeScheduledEvents = () => {
  codeChallenge();
  gameJam();
  theme();
}

export default initializeScheduledEvents;