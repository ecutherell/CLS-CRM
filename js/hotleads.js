async function loadHotLeads() {
  if (!sb) { hotLeads = []; return; }
  const { data, error } = await sb.from('hot_leads').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  hotLeads = data || [];
}

function toggleHotLeadForm(show) {
  document.getElementById('hot-lead-form').style.display = show ? 'flex' : 'none';
  document.getElementById('hl-add-btn').style.display = show ? 'none' : '';
  if (show) setTimeout(function () { document.getElementById('hl-name').focus(); }, 50);
}

async function addHotLead() {
  const name = document.getElementById('hl-name').value.trim();
  const contact = document.getElementById('hl-contact').value.trim();
  const notes = document.getElementById('hl-notes').value.trim();
  if (!name) { document.getElementById('hl-name').focus(); return; }

  if (sb) {
    const { data, error } = await sb.from('hot_leads').insert({ name, contact: contact || null, notes: notes || null }).select().single();
    if (error) { alert('Error: ' + error.message); return; }
    hotLeads.unshift(data);
  } else {
    hotLeads.unshift({ id: Date.now(), name, contact: contact || null, notes: notes || null });
  }

  document.getElementById('hl-name').value = '';
  document.getElementById('hl-contact').value = '';
  document.getElementById('hl-notes').value = '';
  toggleHotLeadForm(false);
  renderSalesPage();
}

async function deleteHotLead(id) {
  hotLeads = hotLeads.filter(l => l.id !== id);
  renderSalesPage();
  if (sb) await sb.from('hot_leads').delete().eq('id', id);
}

async function convertLead(id) {
  if (!confirm('Mark this lead as signed and remove from hot leads?')) return;
  hotLeads = hotLeads.filter(l => l.id !== id);
  renderSalesPage();
  if (sb) await sb.from('hot_leads').delete().eq('id', id);
}
