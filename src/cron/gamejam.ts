import { CronJob } from 'cron';
import { Client, TextChannel } from 'discord.js';
import config from 'config';

const channelId = config.get<string>('channelIds.general');
const schedule = config.get<string>('schedule.gamejam');

export default function gameJam() {
  new CronJob(schedule, () => {
    const client = new Client({ intents: [] });
    const channel = client.channels.cache.get(channelId) as TextChannel;

    if (channel) {
      channel.send("Game Jam Alert: Time to get ready for this week's game jam!");
    }
  }).start();
}
