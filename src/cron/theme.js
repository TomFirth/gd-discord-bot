import { CronJob } from 'cron';
import { Client } from 'discord.js';
import config from 'config';

const channelId = config.get('channelIds.general');
const schedule = config.get('schedule.theme');

export default function theme() {
  new CronJob(schedule, () => {
    const client = new Client({ intents: [] });
    const channel = client.channels.cache.get(channelId);

    if (channel) {
      channel.send("Weekly Theme: Get inspired and check out this week's theme!");
    }
  }).start();
}
