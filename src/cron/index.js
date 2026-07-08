import { theme } from './theme.js';
import { startRedditFeeds } from './reddit.js';

export const initializeScheduledEvents = (client) => {
  theme(client);
  startRedditFeeds(client);
};
