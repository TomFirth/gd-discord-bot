import { CronJob } from 'cron';
import dotenv from 'dotenv';

dotenv.config();

if (process.env.NODE_APP_INSTANCE === '0') {
  delete process.env.NODE_APP_INSTANCE;
}

const { default: config } = await import('config');

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
