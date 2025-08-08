import { runThemeNow } from '../cron/theme.js';

(async () => {
  await runThemeNow(console.log);
})();
