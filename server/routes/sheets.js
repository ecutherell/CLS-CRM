import { Router } from 'express';

const router = Router();
const SHEET_ID = '1IXJxUiQjjjDZ0az6T9ARzhY4_1Ul2DBwTjmFfARNpN4';

// Tab names to try — known ones first, then year/price combos
function tabsToTry() {
  const known = ['2025', '2026 $165', '2026 $200'];
  const extra = [];
  const yr = new Date().getFullYear();
  for (let y = 2024; y <= yr + 1; y++) {
    for (const p of ['$150', '$165', '$175', '$200', '$225', '$250']) {
      const t = `${y} ${p}`;
      if (!known.includes(t)) extra.push(t);
    }
    if (!known.includes(String(y))) extra.push(String(y));
  }
  return [...known, ...extra];
}

async function fetchGviz(tab) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const text = await res.text();
  const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[1]);
    return j.status === 'error' ? null : j;
  } catch { return null; }
}

function parseTab(gviz, tabName) {
  const rows = gviz?.table?.rows;
  if (!rows) return null;

  let totalCalls = 0, totalWon = 0, totalLost = 0;
  let headerRow = -1;
  const sourceMap = {};

  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r]?.c || [];
    for (let c = 0; c < cells.length; c++) {
      const v = cells[c]?.v != null ? String(cells[c].v).trim() : '';
      if (v === 'Total Calls:')  { const n = cells[c + 1]; if (n?.v != null) totalCalls = parseInt(n.v) || 0; }
      if (v === 'Total Won:')    { const n = cells[c + 1]; if (n?.v != null) totalWon   = parseInt(n.v) || 0; }
      if (v === 'Total Lost:')   { const n = cells[c + 1]; if (n?.v != null) totalLost  = parseInt(n.v) || 0; }
      if (v === 'Source') headerRow = r;
    }
  }

  if (totalCalls === 0) return null;

  if (headerRow >= 0) {
    const hdr = rows[headerRow]?.c || [];
    let srcCol = -1, outCol = -1;
    hdr.forEach((h, i) => {
      const v = h?.v != null ? String(h.v).trim() : '';
      if (v === 'Source') srcCol = i;
      if (v === 'Outcome') outCol = i;
    });
    if (srcCol >= 0 && outCol >= 0) {
      for (let r = headerRow + 1; r < rows.length; r++) {
        const c = rows[r]?.c || [];
        const src = c[srcCol]?.v != null ? String(c[srcCol].v).trim() : '';
        const out = c[outCol]?.v != null ? String(c[outCol].v).trim().toLowerCase() : '';
        if (!src || !out) continue;
        if (!sourceMap[src]) sourceMap[src] = { calls: 0, won: 0 };
        sourceMap[src].calls++;
        if (out === 'won') sourceMap[src].won++;
      }
    }
  }

  return {
    name: tabName,
    calls: totalCalls,
    won: totalWon,
    lost: totalLost,
    pct: Math.round(totalWon / totalCalls * 100),
    sources: sourceMap
  };
}

router.get('/sync', async (req, res) => {
  try {
    const sheets = [];
    for (const tab of tabsToTry()) {
      try {
        const gviz = await fetchGviz(tab);
        if (!gviz) continue;
        const parsed = parseTab(gviz, tab);
        if (parsed) sheets.push(parsed);
      } catch {}
    }
    if (!sheets.length) {
      return res.status(400).json({ error: 'Could not read sheet. Make sure it is shared as "Anyone with the link can view".' });
    }
    res.json({ lastSync: new Date().toISOString().slice(0, 10), url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`, sheets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
