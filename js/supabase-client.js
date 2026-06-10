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
    startSBHealthCheck();
  } catch (e) {
    setSS('err');
    scheduleReconnect();
  }
}

function setSS(s) {
  document.getElementById('sync-dot').className = 'sync-dot sync-' + s;
  document.getElementById('sync-label').textContent =
    s === 'ok' ? 'Connected' : s === 'err' ? 'Error — retrying…' : 'Not connected';
}

// Health check — ping Supabase every 30s, reconnect if it fails
let _sbHealthTimer = null;
let _sbReconnectTimer = null;

function startSBHealthCheck() {
  clearInterval(_sbHealthTimer);
  _sbHealthTimer = setInterval(async () => {
    if (!sb) return;
    try {
      const { error } = await sb.from('app_settings').select('key').limit(1);
      if (error) throw error;
      // Still connected — make sure status shows ok
      const label = document.getElementById('sync-label');
      if (label && label.textContent !== 'Connected') {
        setSS('ok');
        loadAllData(); // reload data after recovery
      }
    } catch {
      setSS('err');
      scheduleReconnect();
    }
  }, 30000);
}

function scheduleReconnect() {
  clearTimeout(_sbReconnectTimer);
  _sbReconnectTimer = setTimeout(() => {
    const { url, key } = loadKeys();
    if (!url || !key) return;
    try {
      sb = window.supabase.createClient(url, key);
      // Test the connection
      sb.from('app_settings').select('key').limit(1).then(({ error }) => {
        if (error) {
          setSS('err');
          scheduleReconnect(); // try again in another 30s
        } else {
          setSS('ok');
          loadAllData();
          startSBHealthCheck();
        }
      });
    } catch {
      setSS('err');
      scheduleReconnect();
    }
  }, 30000);
}
