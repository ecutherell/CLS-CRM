function loadKeys() {
  return {
    url: localStorage.getItem('sb_url') || '',
    key: localStorage.getItem('sb_key') || '',
  };
}

function saveKeys() {
  const url = document.getElementById('input-url').value.trim();
  const key = document.getElementById('input-key').value.trim();
  if (!url || !key) { alert('Please enter both keys.'); return; }
  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);
  initSB(url, key);
  closeSetup();
}

function initSB(url, key) {
  try {
    sb = window.supabase.createClient(url, key);
    setSS('ok');
    loadAllData();
  } catch (e) {
    setSS('err');
    console.error(e);
  }
}

function setSS(s) {
  document.getElementById('sync-dot').className = 'sync-dot sync-' + s;
  document.getElementById('sync-label').textContent =
    s === 'ok' ? 'Connected' : s === 'err' ? 'Error' : 'Not connected';
}
