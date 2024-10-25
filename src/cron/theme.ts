import { CronJob } from 'cron';
import { Client, TextChannel } from 'discord.js';
import config from 'config';

const channelId = config.get<string>('channelIds.gemeral');
const schedule = config.get<string>('schedule.theme');

export default function theme() {
  new CronJob(schedule, () => {
    const client = new Client({ intents: [] });
    const channel = client.channels.cache.get(channelId) as TextChannel;

    if (channel) {
      channel.send("Weekly Theme: Get inspired and check out this week's theme!");
    }
  }).start();
}
