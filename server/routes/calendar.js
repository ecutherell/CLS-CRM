import { Router } from 'express';
import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../../server-data.json');

const router = Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ── Token persistence ──────────────────────────────────────
function readData() {
  try { return existsSync(DATA_FILE) ? JSON.parse(readFileSync(DATA_FILE, 'utf8')) : {}; }
  catch { return {}; }
}
function writeData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function saveTokens(tokens) {
  const data = readData();
  data.gcal_tokens = { ...data.gcal_tokens, ...tokens };
  writeData(data);
}

function loadTokens() {
  const data = readData();
  if (data.gcal_tokens && data.gcal_tokens.access_token) {
    oauth2Client.setCredentials(data.gcal_tokens);
    return true;
  }
  return false;
}

// Load tokens on startup so calendar works without re-auth after server restart
loadTokens();

// Auto-save refreshed tokens
oauth2Client.on('tokens', (tokens) => {
  saveTokens(tokens);
  oauth2Client.setCredentials({ ...oauth2Client.credentials, ...tokens });
});

// ── Auth routes ────────────────────────────────────────────
router.get('/status', (req, res) => {
  const creds = oauth2Client.credentials;
  res.json({ connected: !!(creds && creds.access_token) });
});

router.get('/auth', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force refresh_token every time
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
  res.redirect(url);
});

router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing code');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    saveTokens(tokens);
    res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:80px;background:#0f1117;color:#fff">
      <div style="font-size:48px;margin-bottom:16px">✅</div>
      <h2 style="margin:0 0 12px;font-size:22px">Google Calendar connected!</h2>
      <p style="color:#aaa;font-size:14px">You can close this tab — go back to the CRM and refresh the Calendar page.</p>
      <script>setTimeout(()=>window.close(),3000)</script>
    </body></html>`);
  } catch (err) {
    res.status(500).send('Error connecting: ' + err.message);
  }
});

router.post('/disconnect', (req, res) => {
  try {
    oauth2Client.setCredentials({});
    const data = readData();
    delete data.gcal_tokens;
    writeData(data);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Events ─────────────────────────────────────────────────
function requireAuth(req, res) {
  const creds = oauth2Client.credentials;
  if (!creds || !creds.access_token) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  return true;
}

router.get('/events', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const timeMin = req.query.timeMin || new Date().toISOString();
    const timeMax = req.query.timeMax || (() => {
      const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString();
    })();
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });
    res.json({ events: response.data.items || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/events', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const { summary, description, date, startTime, endTime, allDay } = req.body;
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    let start, end;
    if (allDay) {
      start = { date };
      end = { date };
    } else {
      start = { dateTime: date + 'T' + (startTime || '09:00') + ':00', timeZone: 'America/Chicago' };
      end   = { dateTime: date + 'T' + (endTime   || '10:00') + ':00', timeZone: 'America/Chicago' };
    }
    const event = { summary, description, start, end };
    const response = await calendar.events.insert({ calendarId: 'primary', resource: event });
    res.json({ event: response.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/events/:id', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.events.delete({ calendarId: 'primary', eventId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
