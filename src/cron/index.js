import { theme } from './theme.js';
import { startRedditFeeds } from './reddit.js';
import { initializePromptSchedules } from '../services/prompts.js';

export const initializeScheduledEvents = (client) => {
  theme(client);
  startRedditFeeds(client);
  initializePromptSchedules(client);
};
