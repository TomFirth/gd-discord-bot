import { free } from './free.js';

export const initializeStreams = (client) => {
  free(client);
}