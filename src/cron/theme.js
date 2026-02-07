import { CronJob } from 'cron';
import config from 'config';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const channelId = config.get('channelIds.general');
const schedule = config.get('schedule.theme');
const MODEL_NAME = 'gemini-3-flash-preview';

export const runThemeNow = async (send) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: "Give me one creative game jam theme. Respond with only the theme text, no explanation or punctuation.",
      config: {
        temperature: 0.8,
        topP: 0.95,
        topK: 40,
      }
    });

    const theme = response.text?.trim() || "Evolution";
    send(theme);
  } catch (error) {
    console.error('OpenAI API error:', error.message);
  }
};

export const theme = (client) => {
  new CronJob(schedule, () => {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;
    runThemeNow((msg) => channel.send(msg));
  }).start();
};
