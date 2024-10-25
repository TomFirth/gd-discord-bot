import { CronJob } from 'cron';
import { Client, TextChannel } from 'discord.js';
import config from 'config';

const channelId = config.get<string>('channelIds.challenges');
const schedule = config.get<string>('schedule.codeChallenge');

export default function codeChallenge() {
  new CronJob(schedule, () => {
    const client = new Client({ intents: [] });
    const channel = client.channels.cache.get(channelId) as TextChannel;

    if (channel) {
      channel.send("Daily challenge reminder: Don't forget to check for new opportunities!");
    }
  }).start();
}
