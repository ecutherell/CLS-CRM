import { Router } from 'express';
import nodemailer from 'nodemailer';
import supabase from '../lib/supabase.js';

const router = Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// POST /api/reminders/send — check for overdue/due athletes and email yourself
router.post('/send', async (req, res) => {
  const { data: athletes, error } = await supabase
    .from('athletes')
    .select('name, program, due_date')
    .eq('is_active', true);

  if (error) return res.status(500).json({ error: error.message });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue = [];
  const due = [];

  for (const a of athletes) {
    if (!a.due_date) continue;
    const d = new Date(a.due_date);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    if (diff < 0) overdue.push({ ...a, diff });
    else if (diff <= 7) due.push({ ...a, diff });
  }

  if (!overdue.length && !due.length) {
    return res.json({ message: 'No reminders needed today.' });
  }

  const lines = [
    overdue.length ? `Overdue (${overdue.length}):\n` + overdue.map(a => `  • ${a.name} — ${a.program} — ${Math.abs(a.diff)}d overdue`).join('\n') : null,
    due.length ? `Due this week (${due.length}):\n` + due.map(a => `  • ${a.name} — ${a.program} — due in ${a.diff}d`).join('\n') : null,
  ].filter(Boolean).join('\n\n');

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.SMTP_USER,
    subject: `CRM reminder — ${overdue.length} overdue, ${due.length} due this week`,
    text: lines,
  });

  res.json({ message: 'Reminder sent.', overdue: overdue.length, due: due.length });
});

export default router;
