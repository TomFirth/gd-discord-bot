import { CronJob } from 'cron';
import config from 'config';

const channelId = config.get('channelIds.general');
const schedule = config.get('schedule.gamejam');

export const gameJam = (client) => {
  new CronJob(schedule, () => {
    const channel = client.channels.cache.get(channelId);

    if (channel) {
      channel.send("Game Jam Alert: Time to get ready for this week's game jam!");
    }
  }).start();
}
