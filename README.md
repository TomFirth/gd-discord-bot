# GD Bot

GD Bot is a Discord bot for game development communities. It combines a small set of slash commands with scheduled prompts and feed posts that help keep a server active with game-dev inspiration, community updates, and occasional fun challenges.

## Features

- `/steamcompare` — compare two Steam users and find shared multiplayer games
- Weekly GameJam theme.
- Scheduled game-dev content:
  - dev tips
  - moodboards with a generated palette-style image
  - developer showcases
  - audio ideas
  - story hooks
- Automated RSS posting for free game announcements and Reddit-based game-dev updates

## Requirements

- Node.js
- A Discord bot token
- A Discord application ID for slash command deployment
- Optional:
  - Steam API key for `/steamcompare`
  - Featherless API key for prompts

## Setup

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:
   ```env
   BOT_TOKEN=your_discord_bot_token
   BOT_ID=your_discord_application_id
   STEAM_API_KEY=your_steam_api_key
   FEATHERLESS_API_KEY=your_featherless_api_key
   FEATHERLESS_MODEL=optional_model_name
   ```

3. Update the bot configuration in [config/default.json](config/default.json) for:
   - channel IDs
   - guild ID
   - cron schedules

4. Deploy slash commands:
   ```bash
   npm run dc
   ```

5. Start the bot:
   ```bash
   npm start
   ```

## Commands

### `/steamcompare`

Compare two Steam users and return a list of shared multiplayer games.

Example:
```text
/steamcompare your_steam_id: steamcommunity.com/id/yourname other_steam_id: steamcommunity.com/id/othername
```

## Scheduled content

The bot’s scheduled jobs are configured in [config/default.json](config/default.json). Current prompt types include:

- `devtip` — Wednesday at 12:00
- `moodboard` — Thursday at 12:00
- `showcase` — Friday at 17:00
- `audio` — Friday at 11:00
- `story` — Friday at 13:00
- `theme` — Friday at 09:00

## Project structure

- [src/commands](src/commands) — Discord slash command handlers
- [src/cron](src/cron) — scheduled jobs and prompt generation
- [src/stream](src/stream) — stream/feed integrations
- [config/default.json](config/default.json) — channel, guild, and scheduling configuration

## Notes

- The free-game stream stores previously posted items in the [data](data) folder so it does not repost the same entries repeatedly.
