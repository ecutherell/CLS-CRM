import { Router } from 'express';
import twilio from 'twilio';
import supabase from '../lib/supabase.js';

const router = Router();

function getClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export async function sendDailySms() {
  const client = getClient();
  if (!client) throw new Error('Twilio credentials not set in .env');

  const to   = process.env.TWILIO_TO;
  const from = process.env.TWILIO_FROM;
  if (!to || !from) throw new Error('TWILIO_TO or TWILIO_FROM not set in .env');

  // Pull active athletes from Supabase
  const { data: athletes, error } = await supabase
    .from('athletes')
    .select('name, program, due_date')
    .eq('is_active', true);

  if (error) throw new Error('Supabase error: ' + error.message);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue    = [];
  const dueToday   = [];
  const dueTomorrow = [];

  for (const a of (athletes || [])) {
    if (!a.due_date) continue;
    const d = new Date(a.due_date + 'T00:00:00');
    const diff = Math.round((d - today) / 86400000);
    if (diff < 0)      overdue.push({ name: a.name, days: Math.abs(diff) });
    else if (diff === 0) dueToday.push(a.name);
    else if (diff === 1) dueTomorrow.push(a.name);
  }

  const lines = [];
  if (overdue.length)
    lines.push('⚠️ Overdue (' + overdue.length + '): ' + overdue.map(a => a.name + ' (' + a.days + 'd)').join(', '));
  if (dueToday.length)
    lines.push('📅 Due today: ' + dueToday.join(', '));
  if (dueTomorrow.length)
    lines.push('📅 Due tomorrow: ' + dueTomorrow.join(', '));

  const allClear = !lines.length;
  if (allClear) lines.push('✅ All clear — no athletes overdue or due soon.');

  const body = '📋 Coach CRM\n' + lines.join('\n');

  await client.messages.create({ body, from, to });

  return { overdue: overdue.length, dueToday: dueToday.length, dueTomorrow: dueTomorrow.length, allClear };
}

// POST /api/sms/test — manual send from Settings
router.post('/test', async (req, res) => {
  try {
    const result = await sendDailySms();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
