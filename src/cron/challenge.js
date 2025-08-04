import { CronJob } from 'cron';
import { Client } from 'discord.js';
import config from 'config';

const channelId = config.get('channelIds.challenges');
const schedule = config.get('schedule.codeChallenge');

export default function codeChallenge() {
  new CronJob(schedule, () => {
    const client = new Client({ intents: [] });
    const channel = client.channels.cache.get(channelId);

    if (channel) {
      channel.send("Daily challenge reminder: Don't forget to check for new opportunities!");
    }
  }).start();
}
