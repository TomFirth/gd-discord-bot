import { startFreeStream } from './free.js';
import { startRssFeeds } from './rss.js';

export const initializeStreams = (client) => {
  startFreeStream(client);
  startRssFeeds(client);
};