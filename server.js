import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { exec } from 'child_process';
import 'dotenv/config';
import cron from 'node-cron';
import calendarRouter from './server/routes/calendar.js';
import remindersRouter from './server/routes/reminders.js';
import stripeRouter from './server/routes/stripe.js';
import smsRouter, { sendDailySms } from './server/routes/sms.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = join(__dirname, 'server-data.json');

function readServerData() {
  try { return existsSync(DATA_FILE) ? JSON.parse(readFileSync(DATA_FILE, 'utf8')) : {}; }
  catch { return {}; }
}
function writeServerData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use(express.json({ limit: '10mb' }));
// Never cache static files — always serve fresh (setHeaders overrides express.static's own cache logic)
app.use(express.static(join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  },
}));

// Serve Supabase credentials to the client so it auto-connects
app.get('/api/config', (req, res) => {
  res.json({
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  });
});

// Persistent server-side storage for things that shouldn't live in localStorage
app.get('/api/data/all', (req, res) => res.json(readServerData()));
app.get('/api/data/:key', (req, res) => {
  const data = readServerData();
  res.json(data[req.params.key] ?? null);
});
app.post('/api/data/:key', (req, res) => {
  const data = readServerData();
  data[req.params.key] = req.body;
  writeServerData(data);
  res.json({ ok: true });
});

// Git last commit info
app.get('/api/git-status', (req, res) => {
  exec('git log -1 --format="%h|%s|%ci"', { cwd: __dirname }, (err, stdout) => {
    if (err || !stdout.trim()) return res.json({ ok: false });
    const [hash, message, date] = stdout.trim().replace(/"/g, '').split('|');
    res.json({ ok: true, hash, message, date });
  });
});

// Git push endpoint
app.post('/api/git-push', (req, res) => {
  const msg = (req.body.message || 'Update CRM').replace(/"/g, '\\"').replace(/`/g, '');
  const cmd = `git add . && git commit -m "${msg}" && git push --set-upstream origin main`;
  exec(cmd, { cwd: __dirname }, (err, stdout, stderr) => {
    const nothingNew = (stdout + stderr).includes('nothing to commit');
    if (err && !nothingNew) return res.json({ ok: false, error: stderr || err.message });
    res.json({ ok: true, output: nothingNew ? 'Nothing new to commit.' : stdout.trim() });
  });
});

app.use('/api/stripe', stripeRouter);
app.use('/api/calendar', calendarRouter); // legacy path kept
app.use('/api/gcal', calendarRouter);     // matches Google Console redirect URI
app.use('/api/reminders', remindersRouter);
app.use('/api/sms', smsRouter);

// ── Daily SMS cron ─────────────────────────────────────────
// Runs every minute; checks user's preferred send hour against current time.
cron.schedule('* * * * *', async () => {
  const data = readServerData();
  const settings = data.sms_settings || {};
  if (!settings.enabled) return;

  const now  = new Date();
  const hour = now.getHours();
  const min  = now.getMinutes();
  const sendHour = parseInt(settings.send_hour ?? 8);

  if (hour !== sendHour || min !== 0) return;

  // Prevent double-send on the same day
  const todayKey = now.toISOString().slice(0, 10);
  if (data.sms_last_sent === todayKey) return;

  try {
    await sendDailySms();
    data.sms_last_sent = todayKey;
    writeServerData(data);
    console.log('[SMS] Daily text sent for', todayKey);
  } catch (e) {
    console.error('[SMS] Failed to send daily text:', e.message);
  }
});

app.listen(PORT, () => {
  console.log(`Coach CRM running on http://localhost:${PORT}`);
});
