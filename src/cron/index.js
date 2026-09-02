import { theme } from './theme.js';
import { startRedditFeeds } from './reddit.js';
import { startYoutubeFeeds } from '../stream/youtube.js';
import { initializePromptSchedules } from '../services/prompts.js';

export const initializeScheduledEvents = (client) => {
  theme(client);
  startRedditFeeds(client);
  startYoutubeFeeds(client);
  initializePromptSchedules(client);
};
