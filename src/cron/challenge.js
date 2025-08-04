import { CronJob } from 'cron';
import config from 'config';

const channelId = config.get('channelIds.challenges');
const schedule = config.get('schedule.challenge');

export const challenge = (client) => {
  new CronJob(schedule, () => {
    const channel = client.channels.cache.get(channelId);

    if (channel) {
      channel.send("Daily challenge reminder: Don't forget to check for new opportunities!");
    }
  }).start();
}
