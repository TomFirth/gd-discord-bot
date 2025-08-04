import { CronJob } from 'cron';
import { Client } from 'discord.js';
import config from 'config';

const channelId = config.get('channelIds.general');
const schedule = config.get('schedule.gamejam');

export default function gameJam() {
  new CronJob(schedule, () => {
    const client = new Client({ intents: [] });
    const channel = client.channels.cache.get(channelId);

    if (channel) {
      channel.send("Game Jam Alert: Time to get ready for this week's game jam!");
    }
  }).start();
}
