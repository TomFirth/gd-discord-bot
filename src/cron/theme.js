import { CronJob } from 'cron';
import config from 'config';

const channelId = config.get('channelIds.general');
const schedule = config.get('schedule.theme');

export const theme = (client) => {
  new CronJob(schedule, () => {
    const channel = client.channels.cache.get(channelId);

    if (channel) {
      channel.send("Weekly Theme: Get inspired and check out this week's theme!");
    }
  }).start();
}
