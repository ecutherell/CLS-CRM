const OFFICE_KEY = 'office_purchase_data';
const OFFICE_MONTHS = ['May','June','July','August','September','October','November','December'];

function loadOfficeData() {
  return sGet(OFFICE_KEY, {});
}

function saveOfficeData(data) {
  sSet(OFFICE_KEY, data);
}

function toggleOfficeDone(month) {
  const data = loadOfficeData();
  if (!data[month]) data[month] = {};
  data[month].done = !data[month].done;
  saveOfficeData(data);
  renderOfficePage();
}

let _officeTimers = {};
function saveOfficeItem(month) {
  clearTimeout(_officeTimers[month]);
  _officeTimers[month] = setTimeout(() => {
    const itemEl = document.getElementById('office-item-' + month);
    const costEl = document.getElementById('office-cost-' + month);
    if (!itemEl) return;
    const data = loadOfficeData();
    if (!data[month]) data[month] = {};
    data[month].item = itemEl.value;
    if (costEl) data[month].cost = costEl.value;
    saveOfficeData(data);
  }, 600);
}

function renderOfficePage() {
  const wrap = document.getElementById('office-months-list');
  if (!wrap) return;
  const data = loadOfficeData();

  wrap.innerHTML = OFFICE_MONTHS.map(month => {
    const entry = data[month] || {};
    const done = !!entry.done;
    const item = entry.item || '';
    const cost = entry.cost || '';
    return `
      <div style="background:var(--surface);border:1px solid ${done ? 'var(--accent)' : 'var(--border)'};border-radius:var(--radius);padding:16px 18px;display:flex;align-items:flex-start;gap:14px;opacity:${done ? '0.7' : '1'}">
        <div style="min-width:90px;padding-top:6px">
          <div style="font-size:13px;font-weight:700;color:var(--text1)">${month}</div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px">
          <textarea
            id="office-item-${month}"
            oninput="saveOfficeItem('${month}')"
            placeholder="What do you want to get this month?"
            rows="2"
            style="width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:8px 10px;font-size:13px;color:var(--text1);resize:vertical;font-family:inherit;line-height:1.5;${done ? 'text-decoration:line-through;color:var(--text3)' : ''}"
          >${escOffice(item)}</textarea>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:var(--text3);white-space:nowrap">Cost $</span>
            <input
              id="office-cost-${month}"
              type="number"
              min="0"
              step="0.01"
              oninput="saveOfficeItem('${month}')"
              placeholder="0.00"
              value="${escOffice(cost)}"
              style="width:110px;background:var(--bg);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text1);font-family:inherit"
            />
          </div>
        </div>
        <div style="padding-top:4px">
          <button
            onclick="toggleOfficeDone('${month}')"
            style="padding:6px 12px;border-radius:var(--radius-sm);border:1px solid ${done ? 'var(--accent)' : 'var(--border2)'};background:${done ? 'var(--accent)' : 'none'};color:${done ? '#fff' : 'var(--text3)'};font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap"
          >${done ? '✓ Got it' : 'Got it?'}</button>
        </div>
      </div>
    `;
  }).join('');
}

function escOffice(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
