import { CronJob } from 'cron';
import config from 'config';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const channelId = config.get('channelIds.general');
const schedule = config.get('schedule.theme');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const theme = (client) => {
  new CronJob(schedule, async () => {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content: 'Give me one creative game jam theme. Respond with only the theme text, no explanation or punctuation.'
            }
          ],
          temperature: 0.7,
          max_tokens: 10
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const theme = response.data.choices?.[0]?.message?.content?.trim();

      if (theme) {
        channel.send(`🎮 Weekly Theme: **${theme}**`);
      } else {
        channel.send("⚠️ Failed to generate a theme this week.");
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
      channel.send("⚠️ Error fetching theme from OpenAI.");
    }
  }).start();
};
