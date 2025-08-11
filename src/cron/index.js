import { theme } from './theme.js';
import { topPost } from './topPost.js';
import { topUnity } from './topUnity.js';
import { news } from './news.js';

export const initializeScheduledEvents = (client) => {
  theme(client);
  topPost(client);
  topUnity(client);
  news(client);
};
