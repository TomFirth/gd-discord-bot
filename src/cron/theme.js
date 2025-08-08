import { CronJob } from 'cron';
import config from 'config';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const channelId = config.get('channelIds.general');
const schedule = config.get('schedule.theme');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const runThemeNow = async (send) => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content:
              'Give me one creative game jam theme. Respond with only the theme text, no explanation or punctuation.',
          },
        ],
        temperature: 0.7,
        max_tokens: 30,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    const theme = response.data.choices?.[0]?.message?.content?.trim();
    send(theme || 'Failed to generate a theme this week.');
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    send('Error fetching theme from OpenAI.');
  }
};

export const theme = (client) => {
  new CronJob(schedule, () => {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;
    runThemeNow((msg) => channel.send(msg));
  }).start();
};
