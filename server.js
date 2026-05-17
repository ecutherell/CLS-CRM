import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import 'dotenv/config';
import calendarRouter from './server/routes/calendar.js';
import remindersRouter from './server/routes/reminders.js';
import stripeRouter from './server/routes/stripe.js';

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
app.use(express.static(join(__dirname, 'public')));

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

app.use('/api/stripe', stripeRouter);
app.use('/api/calendar', calendarRouter); // legacy path kept
app.use('/api/gcal', calendarRouter);     // matches Google Console redirect URI
app.use('/api/reminders', remindersRouter);

app.listen(PORT, () => {
  console.log(`Coach CRM running on http://localhost:${PORT}`);
});
