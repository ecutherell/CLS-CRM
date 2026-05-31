// ── YouTube Videos ────────────────────────────────────────

const YT_STEPS = [
  { key: 'script_done',    label: 'Script',     icon: '📝' },
  { key: 'thumbnail_done', label: 'Thumbnail',  icon: '🖼️' },
  { key: 'recorded',       label: 'Recorded',   icon: '🎥' },
  { key: 'edited',         label: 'Edited',     icon: '✂️' },
  { key: 'published',      label: 'Scheduled',  icon: '🚀' },
];

let _ytAddOpen    = false;
let _ytEditId     = null; // currently expanded edit row
let _ytDriveEdit  = false; // editing drive link inline

function getYtVideos() { return sGet('youtube_videos', []); }
function saveYtVideos(list) { sSet('youtube_videos', list); }

function saveYtDriveLink() {
  const el = document.getElementById('yt-drive-input');
  if (!el) return;
  const val = el.value.trim();
  if (val) localStorage.setItem('yt_drive_link', val);
  else localStorage.removeItem('yt_drive_link');
  _ytDriveEdit = false;
  renderYoutubePage();
}

function ytNextEpisode() {
  const vids = getYtVideos();
  return vids.length ? Math.max(...vids.map(v => v.episode || 0)) + 1 : 1;
}

function addYtVideo() {
  const title = (document.getElementById('yt-new-title').value || '').trim();
  if (!title) { document.getElementById('yt-new-title').focus(); return; }
  const list = getYtVideos();
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    episode: ytNextEpisode(),
    title,
    thumbnail_idea: '',
    script_url: '',
    script_done: false,
    thumbnail_done: false,
    recorded: false,
    edited: false,
    clipped: false,
    published: false,
    publish_date: '',
    notes: '',
  });
  saveYtVideos(list);
  document.getElementById('yt-new-title').value = '';
  _ytAddOpen = false;
  renderYoutubePage();
}

function deleteYtVideo(id) {
  if (!confirm('Delete this video?')) return;
  saveYtVideos(getYtVideos().filter(v => v.id !== id));
  if (_ytEditId === id) _ytEditId = null;
  renderYoutubePage();
}

function toggleYtStep(id, key) {
  const list = getYtVideos();
  const v = list.find(v => v.id === id);
  if (!v) return;
  v[key] = !v[key];
  saveYtVideos(list);

  // Surgical update — only touch the button, progress bar, and status banner
  const done = v[key];
  const btn = document.querySelector('[data-ytbtn="' + id + '-' + key + '"]');
  if (btn) {
    btn.style.borderColor = done ? 'var(--green-text)' : 'var(--border2)';
    btn.style.background  = done ? 'rgba(76,175,80,0.18)' : 'transparent';
    btn.textContent       = done ? '✓' : '';
  }
  const doneCount = YT_STEPS.filter(s => v[s.key]).length;
  const pct = Math.round(doneCount / YT_STEPS.length * 100);
  const barColor = pct === 100 ? 'var(--green-text)' : pct >= 50 ? '#ffc107' : pct > 0 ? '#ff7043' : 'var(--border2)';
  const bar = document.querySelector('[data-ytbar="' + id + '"]');
  if (bar) { bar.style.width = pct + '%'; bar.style.background = barColor; }

  // Re-render only the status banner + pills (top section, no table)
  _renderYtStatus(getYtVideos());
}

function saveYtField(id, key, val) {
  const list = getYtVideos();
  const v = list.find(v => v.id === id);
  if (!v) return;
  v[key] = key === 'episode' ? (parseInt(val) || 0) : val;
  saveYtVideos(list);
  renderYoutubePage();
}

function toggleYtEdit(id) {
  _ytEditId = _ytEditId === id ? null : id;
  renderYoutubePage();
}

function renderYoutubePage() {
  const wrap = document.getElementById('yt-content');
  if (!wrap) return;

  const videos = getYtVideos().slice().sort((a, b) => (a.episode || 0) - (b.episode || 0));

  // ── Buffer logic ───────────────────────────────────────
  // "Ready" = clipped (fully produced) but not published yet
  // "In production" = at least recorded but not clipped yet
  // "Not started" = no steps done, not published
  const published    = videos.filter(v => v.published);
  const ready        = videos.filter(v => !v.published && v.edited);
  const inProduction = videos.filter(v => !v.published && !v.edited && (v.recorded));
  const scripting    = videos.filter(v => !v.published && !v.edited && !v.recorded && (v.script_done || v.thumbnail_done));
  const notStarted   = videos.filter(v => !v.published && !YT_STEPS.some(s => v[s.key]));

  const readyCount = ready.length;
  const inProdCount = inProduction.length + scripting.length;

  // Status banner
  let bannerBg, bannerIcon, bannerTitle, bannerSub;
  if (readyCount >= 3) {
    bannerBg = 'rgba(76,175,80,0.12)'; bannerIcon = '✅';
    bannerTitle = 'You\'re ahead — great buffer!';
    bannerSub = readyCount + ' videos ready to publish · ' + (inProdCount ? inProdCount + ' in production' : 'keep the pipeline moving');
  } else if (readyCount === 2) {
    bannerBg = 'rgba(76,175,80,0.10)'; bannerIcon = '✅';
    bannerTitle = 'Good — 2 weeks of content ready';
    bannerSub = inProdCount ? inProdCount + ' more in production — no rush, but keep it moving' : 'Get something into production to stay ahead';
  } else if (readyCount === 1) {
    bannerBg = 'rgba(255,193,7,0.12)'; bannerIcon = '⚠️';
    bannerTitle = 'Low buffer — 1 video ready';
    bannerSub = inProdCount
      ? 'Finish what\'s in production (' + inProdCount + ' videos) to build your buffer back up'
      : 'Make content this week to stay on schedule';
  } else if (inProdCount > 0) {
    bannerBg = 'rgba(255,112,67,0.12)'; bannerIcon = '🎬';
    bannerTitle = 'Nothing ready — finish what\'s in production';
    bannerSub = inProdCount + ' video' + (inProdCount > 1 ? 's' : '') + ' in progress · get at least one to clipped this week';
  } else {
    bannerBg = 'rgba(229,57,53,0.12)'; bannerIcon = '🚨';
    bannerTitle = 'Make content this week';
    bannerSub = 'Nothing ready, nothing in production — start recording or scripting now';
  }

  // Next publish date
  const nextScheduled = videos
    .filter(v => !v.published && v.publish_date)
    .sort((a, b) => a.publish_date.localeCompare(b.publish_date))[0];
  const nextDateStr = nextScheduled
    ? ' · Next: <strong>' + new Date(nextScheduled.publish_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' — ' + _esc(nextScheduled.title) + '</strong>'
    : '';

  // ── Google Drive button (rendered into page header slot) ──
  const driveLink = localStorage.getItem('yt_drive_link') || '';
  const driveBtnEl = document.getElementById('yt-drive-btn');
  if (driveBtnEl) {
    if (_ytDriveEdit) {
      driveBtnEl.innerHTML =
        '<div style="display:flex;gap:6px;align-items:center">' +
        '<input id="yt-drive-input" value="' + _esc(driveLink) + '" placeholder="Paste Google Drive link…" ' +
        'onkeydown="if(event.key===\'Enter\')saveYtDriveLink()" ' +
        'style="padding:5px 10px;border-radius:7px;border:1px solid #5c9cf5;background:var(--surface2);color:var(--text);font-size:13px;flex:1;min-width:0"/>' +
        '<button onclick="saveYtDriveLink()" style="padding:5px 12px;border-radius:7px;border:none;background:#5c9cf5;color:#fff;font-size:12px;font-weight:600;cursor:pointer">Save</button>' +
        '<button onclick="_ytDriveEdit=false;renderYoutubePage()" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border2);background:none;color:var(--text2);font-size:12px;cursor:pointer">Cancel</button>' +
        '</div>';
      setTimeout(() => { const i = document.getElementById('yt-drive-input'); if (i) i.focus(); }, 0);
    } else if (driveLink) {
      driveBtnEl.innerHTML =
        '<div style="display:flex;gap:6px;align-items:center">' +
        '<a href="' + _esc(driveLink) + '" target="_blank" ' +
        'style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:7px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);color:#4ade80;font-size:12px;font-weight:600;text-decoration:none;white-space:nowrap">📁 Drive ↗</a>' +
        '<button onclick="_ytDriveEdit=true;renderYoutubePage()" title="Change link" ' +
        'style="padding:3px 8px;border-radius:7px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:11px;cursor:pointer">✎</button>' +
        '</div>';
    } else {
      driveBtnEl.innerHTML =
        '<button onclick="_ytDriveEdit=true;renderYoutubePage()" ' +
        'style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:7px;border:1px dashed var(--border2);background:none;color:var(--text3);font-size:12px;cursor:pointer">📁 Add Drive</button>';
    }
  }

  const statusHtml =
    '<div id="yt-status-section"><div style="background:' + bannerBg + ';border-radius:12px;padding:16px 20px;margin-bottom:1.5rem;display:flex;align-items:flex-start;gap:14px">' +
      '<div style="font-size:26px;line-height:1">' + bannerIcon + '</div>' +
      '<div style="flex:1">' +
        '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">' + bannerTitle + '</div>' +
        '<div style="font-size:13px;color:var(--text2)">' + bannerSub + nextDateStr + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap;text-align:center;flex-shrink:0">' +
        _ytMiniStat(readyCount, 'Ready', readyCount >= 2 ? 'var(--green-text)' : readyCount === 1 ? '#ffc107' : 'var(--red-text)') +
        _ytMiniStat(inProdCount, 'In prod', inProdCount ? '#ffc107' : 'var(--text3)') +
        _ytMiniStat(published.length, 'Published', 'var(--text2)') +
      '</div>' +
    '</div>';

  // ── Pipeline summary row ──────────────────────────────
  const pipelineHtml = (videos.length
    ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1.2rem;font-size:12px">' +
      _ytPill(notStarted.length, 'Not started', '#ef5350', 'rgba(239,83,80,0.12)') +
      _ytPill(scripting.length, 'Scripting', '#64b5f6', 'rgba(100,181,246,0.2)') +
      _ytPill(inProduction.length, 'In production', '#ffc107', 'rgba(255,193,7,0.15)') +
      _ytPill(readyCount, 'Ready to publish', '#4caf50', 'rgba(76,175,80,0.15)') +
      _ytPill(published.length, 'Scheduled', 'var(--text3)', 'var(--surface2)') +
      '</div>'
    : '') + '</div>'; // close #yt-status-section

  // ── Add form ───────────────────────────────────────────
  const addHtml = _ytAddOpen
    ? '<div style="display:flex;gap:8px;align-items:center;margin-bottom:1rem;flex-wrap:wrap">' +
      '<input id="yt-new-title" class="yt-title-input" placeholder="Video title…" onkeydown="if(event.key===\'Enter\')addYtVideo()" autofocus ' +
      'style="flex:1;min-width:200px;padding:8px 12px;border-radius:8px;border:1px solid #5c9cf5;background:var(--surface2);color:var(--text);font-size:14px;caret-color:#5c9cf5"/>' +
      '<button onclick="addYtVideo()" style="padding:8px 18px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:13px;cursor:pointer;font-weight:600">Add</button>' +
      '<button onclick="_ytAddOpen=false;renderYoutubePage()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border2);background:none;color:var(--text2);font-size:13px;cursor:pointer">Cancel</button>' +
      '</div>'
    : '<button onclick="_ytAddOpen=true;renderYoutubePage()" ' +
      'style="margin-bottom:1rem;padding:8px 18px;border-radius:8px;border:1px dashed var(--border2);background:none;color:var(--text2);font-size:13px;cursor:pointer">+ Add video</button>';

  // ── Table ──────────────────────────────────────────────
  const stepHeaders = YT_STEPS.map(s =>
    '<th style="text-align:center;padding:8px 6px;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;overflow:hidden">' + s.label + '</th>'
  ).join('');

  const rows = videos.map(v => {
    const doneCount = YT_STEPS.filter(s => v[s.key]).length;
    const pct = Math.round(doneCount / YT_STEPS.length * 100);
    const barColor = pct === 100 ? 'var(--green-text)' : pct >= 50 ? '#ffc107' : pct > 0 ? '#ff7043' : 'var(--border2)';

    const stepCells = YT_STEPS.map(s => {
      const done = !!v[s.key];
      return '<td style="text-align:center;padding:8px 4px">' +
        '<button data-ytbtn="' + v.id + '-' + s.key + '" onclick="event.stopPropagation();toggleYtStep(\'' + v.id + '\',\'' + s.key + '\')" title="' + s.label + '" ' +
        'style="width:26px;height:26px;border-radius:50%;border:2px solid ' + (done ? 'var(--green-text)' : 'var(--border2)') + ';' +
        'background:' + (done ? 'rgba(76,175,80,0.18)' : 'transparent') + ';cursor:pointer;font-size:13px;' +
        'display:inline-flex;align-items:center;justify-content:center;color:var(--green-text);transition:all 0.15s">' +
        (done ? '✓' : '') + '</button></td>';
    }).join('');

    const mainRow = '<tr style="border-bottom:1px solid var(--border2);cursor:pointer" onclick="toggleYtEdit(\'' + v.id + '\')">' +
      '<td style="padding:10px 8px;font-size:13px;color:var(--text3);text-align:center;width:40px">' + (v.episode || '—') + '</td>' +
      '<td style="padding:10px 12px;min-width:180px">' +
        '<div style="font-size:14px;font-weight:500;color:var(--text);margin-bottom:5px">' + _esc(v.title) + '</div>' +
        '<div style="height:3px;background:var(--border2);border-radius:2px;width:80px">' +
          '<div data-ytbar="' + v.id + '" style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:2px"></div>' +
        '</div>' +
      '</td>' +
      stepCells +
      '<td style="padding:8px;text-align:center;width:32px">' +
        '<button onclick="event.stopPropagation();deleteYtVideo(\'' + v.id + '\')" title="Delete" ' +
        'style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;padding:2px 6px">✕</button>' +
      '</td></tr>';

    let editRow = '';
    if (_ytEditId === v.id) {
      const inputStyle = 'padding:6px 10px;border-radius:6px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px;width:100%;box-sizing:border-box;opacity:1';
      const labelStyle = 'font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px';

      const inp = (label, key, val, type, flex) =>
        '<div style="display:flex;flex-direction:column;gap:0;flex:' + (flex || '1') + ';min-width:130px">' +
        '<div style="' + labelStyle + '">' + label + '</div>' +
        '<input type="' + (type || 'text') + '" value="' + _esc(val || '') + '" ' +
        'onchange="saveYtField(\'' + v.id + '\',\'' + key + '\',this.value)" ' +
        'style="' + inputStyle + '"/>' +
        '</div>';

      // Script URL: show "Open script" link if URL is set, input if not
      const scriptField = v.script_url
        ? '<div style="display:flex;flex-direction:column;gap:0;flex:1;min-width:130px">' +
          '<div style="' + labelStyle + '">Script</div>' +
          '<div style="display:flex;gap:6px;align-items:center">' +
          '<a href="' + _esc(v.script_url) + '" target="_blank" ' +
          'style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:6px;background:#5c9cf5;color:#fff;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap">📄 Open script ↗</a>' +
          '<button onclick="event.stopPropagation();saveYtField(\'' + v.id + '\',\'script_url\',\'\')" title="Remove link" ' +
          'style="padding:5px 8px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:12px;cursor:pointer">✕</button>' +
          '</div></div>'
        : inp('Script URL', 'script_url', '', 'url', '1');

      editRow = '<tr style="background:var(--surface2)">' +
        '<td colspan="' + (YT_STEPS.length + 3) + '" style="padding:12px 16px">' +
        '<div class="edit-panel-grid-3" style="margin-bottom:10px">' +
        inp('Episode #', 'episode', v.episode, 'number', 'none') +
        inp('Title', 'title', v.title, 'text', 'none') +
        inp('Thumbnail Idea', 'thumbnail_idea', v.thumbnail_idea, 'text', 'none') +
        '</div>' +
        '<div class="edit-panel-grid-3">' +
        scriptField +
        inp('Publish Date', 'publish_date', v.publish_date, 'date', 'none') +
        inp('Notes', 'notes', v.notes, 'text', 'none') +
        '</div>' +
        '</td></tr>';
    }

    return mainRow + editRow;
  }).join('');

  const total = videos.length;
  const TH = 'font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:8px 6px;';
  const stepColWidth = 72;
  const tableHtml = total
    ? '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="width:100%;min-width:420px;border-collapse:collapse;font-size:13px;table-layout:fixed">' +
      '<colgroup>' +
      '<col style="width:44px"/>' +
      '<col/>' +
      YT_STEPS.map(() => '<col style="width:' + stepColWidth + 'px"/>').join('') +
      '<col style="width:36px"/>' +
      '</colgroup>' +
      '<thead><tr style="border-bottom:2px solid var(--border2)">' +
      '<th style="' + TH + 'text-align:center">Ep</th>' +
      '<th style="' + TH + 'text-align:left;padding-left:12px">Title</th>' +
      stepHeaders +
      '<th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>'
    : '<div style="text-align:center;color:var(--text3);font-size:13px;padding:40px 0">No videos yet — add your first one above.</div>';

  wrap.innerHTML = statusHtml + pipelineHtml + addHtml + tableHtml;

  if (_ytAddOpen) {
    const inp = document.getElementById('yt-new-title');
    if (inp) inp.focus();
  }
}

function _renderYtStatus(videos) {
  const el = document.getElementById('yt-status-section');
  if (!el) return;
  const published    = videos.filter(v => v.published);
  const ready        = videos.filter(v => !v.published && v.edited);
  const inProduction = videos.filter(v => !v.published && !v.edited && v.recorded);
  const scripting    = videos.filter(v => !v.published && !v.edited && !v.recorded && (v.script_done || v.thumbnail_done));
  const notStarted   = videos.filter(v => !v.published && !YT_STEPS.some(s => v[s.key]));
  const readyCount   = ready.length;
  const inProdCount  = inProduction.length + scripting.length;

  let bannerBg, bannerIcon, bannerTitle, bannerSub;
  if (readyCount >= 3) {
    bannerBg = 'rgba(76,175,80,0.12)'; bannerIcon = '✅';
    bannerTitle = 'You\'re ahead — great buffer!';
    bannerSub = readyCount + ' videos ready to publish · ' + (inProdCount ? inProdCount + ' in production' : 'keep the pipeline moving');
  } else if (readyCount === 2) {
    bannerBg = 'rgba(76,175,80,0.10)'; bannerIcon = '✅';
    bannerTitle = 'Good — 2 weeks of content ready';
    bannerSub = inProdCount ? inProdCount + ' more in production — no rush, but keep it moving' : 'Get something into production to stay ahead';
  } else if (readyCount === 1) {
    bannerBg = 'rgba(255,193,7,0.12)'; bannerIcon = '⚠️';
    bannerTitle = 'Low buffer — 1 video ready';
    bannerSub = inProdCount ? 'Finish what\'s in production (' + inProdCount + ' videos) to build your buffer back up' : 'Make content this week to stay on schedule';
  } else if (inProdCount > 0) {
    bannerBg = 'rgba(255,112,67,0.12)'; bannerIcon = '🎬';
    bannerTitle = 'Nothing ready — finish what\'s in production';
    bannerSub = inProdCount + ' video' + (inProdCount > 1 ? 's' : '') + ' in progress · get at least one edited this week';
  } else {
    bannerBg = 'rgba(229,57,53,0.12)'; bannerIcon = '🚨';
    bannerTitle = 'Make content this week';
    bannerSub = 'Nothing ready, nothing in production — start recording or scripting now';
  }

  const nextScheduled = videos.filter(v => !v.published && v.publish_date).sort((a, b) => a.publish_date.localeCompare(b.publish_date))[0];
  const nextDateStr = nextScheduled
    ? ' · Next: <strong>' + new Date(nextScheduled.publish_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' — ' + _esc(nextScheduled.title) + '</strong>'
    : '';

  const pillsHtml = videos.length
    ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1.2rem;font-size:12px">' +
      _ytPill(notStarted.length, 'Not started', '#ef5350', 'rgba(239,83,80,0.12)') +
      _ytPill(scripting.length, 'Scripting', '#64b5f6', 'rgba(100,181,246,0.2)') +
      _ytPill(inProduction.length, 'In production', '#ffc107', 'rgba(255,193,7,0.15)') +
      _ytPill(readyCount, 'Ready to publish', '#4caf50', 'rgba(76,175,80,0.15)') +
      _ytPill(published.length, 'Scheduled', 'var(--text3)', 'var(--surface2)') +
      '</div>'
    : '';

  el.innerHTML =
    '<div style="background:' + bannerBg + ';border-radius:12px;padding:16px 20px;margin-bottom:1.5rem;display:flex;align-items:flex-start;gap:14px">' +
      '<div style="font-size:26px;line-height:1">' + bannerIcon + '</div>' +
      '<div style="flex:1">' +
        '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">' + bannerTitle + '</div>' +
        '<div style="font-size:13px;color:var(--text2)">' + bannerSub + nextDateStr + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap;text-align:center;flex-shrink:0">' +
        _ytMiniStat(readyCount, 'Ready', readyCount >= 2 ? 'var(--green-text)' : readyCount === 1 ? '#ffc107' : 'var(--red-text)') +
        _ytMiniStat(inProdCount, 'In prod', inProdCount ? '#ffc107' : 'var(--text3)') +
        _ytMiniStat(published.length, 'Published', 'var(--text2)') +
      '</div>' +
    '</div>' + pillsHtml;
}

function _ytMiniStat(val, label, color) {
  return '<div style="text-align:center;min-width:48px">' +
    '<div style="font-size:22px;font-weight:700;color:' + color + '">' + val + '</div>' +
    '<div style="font-size:10px;color:var(--text3);margin-top:1px;white-space:nowrap">' + label + '</div>' +
    '</div>';
}

function _ytPill(val, label, color, bg) {
  if (!val) return '';
  return '<span style="padding:3px 10px;border-radius:20px;background:' + bg + ';color:' + color + ';font-weight:600;border:1px solid ' + color + '">' +
    val + ' ' + label + '</span>';
}

function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderContentPage() {
  renderYoutubePage();
  renderPodcastPage();
  renderShortFormPage();
}

// ── Podcast ────────────────────────────────────────────────

const POD_STEPS = [
  { key: 'outline_done',   label: 'Outline',    icon: '📝' },
  { key: 'recorded',       label: 'Recorded',   icon: '🎙️' },
  { key: 'edited',         label: 'Edited',     icon: '✂️' },
  { key: 'thumbnail_done', label: 'Thumbnail',  icon: '🖼️' },
  { key: 'published',      label: 'Scheduled',  icon: '🚀' },
];

let _podAddOpen  = false;
let _podEditId   = null;
let _podDriveEdit = false;

function getPodEpisodes() { return sGet('podcast_episodes', []); }
function savePodEpisodes(list) { sSet('podcast_episodes', list); }

function savePodDriveLink() {
  const el = document.getElementById('pod-drive-input');
  if (!el) return;
  const val = el.value.trim();
  if (val) localStorage.setItem('pod_drive_link', val);
  else localStorage.removeItem('pod_drive_link');
  _podDriveEdit = false;
  renderPodcastPage();
}

function podNextEpisode() {
  const eps = getPodEpisodes();
  return eps.length ? Math.max(...eps.map(e => e.episode || 0)) + 1 : 1;
}

function addPodEpisode() {
  const title = (document.getElementById('pod-new-title').value || '').trim();
  if (!title) { document.getElementById('pod-new-title').focus(); return; }
  const list = getPodEpisodes();
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    episode: podNextEpisode(),
    title,
    guest: '',
    outline_done: false,
    recorded: false,
    edited: false,
    thumbnail_done: false,
    published: false,
    ig_post_done: false,
    publish_date: '',
    notes: '',
  });
  savePodEpisodes(list);
  document.getElementById('pod-new-title').value = '';
  _podAddOpen = false;
  renderPodcastPage();
}

function deletePodEpisode(id) {
  if (!confirm('Delete this episode?')) return;
  savePodEpisodes(getPodEpisodes().filter(e => e.id !== id));
  if (_podEditId === id) _podEditId = null;
  renderPodcastPage();
}

function togglePodStep(id, key) {
  const list = getPodEpisodes();
  const ep = list.find(e => e.id === id);
  if (!ep) return;
  ep[key] = !ep[key];
  savePodEpisodes(list);

  const done = ep[key];
  const btn = document.querySelector('[data-podbtn="' + id + '-' + key + '"]');
  if (btn) {
    btn.style.borderColor = done ? 'var(--green-text)' : 'var(--border2)';
    btn.style.background  = done ? 'rgba(76,175,80,0.18)' : 'transparent';
    btn.textContent       = done ? '✓' : '';
  }
  const doneCount = POD_STEPS.filter(s => ep[s.key]).length;
  const pct = Math.round(doneCount / POD_STEPS.length * 100);
  const barColor = pct === 100 ? 'var(--green-text)' : pct >= 50 ? '#ffc107' : pct > 0 ? '#ff7043' : 'var(--border2)';
  const bar = document.querySelector('[data-podbar="' + id + '"]');
  if (bar) { bar.style.width = pct + '%'; bar.style.background = barColor; }

  _renderPodStatus(getPodEpisodes());
}

function savePodField(id, key, val) {
  const list = getPodEpisodes();
  const ep = list.find(e => e.id === id);
  if (!ep) return;
  ep[key] = key === 'episode' ? (parseInt(val) || 0) : val;
  savePodEpisodes(list);
  renderPodcastPage();
}

function togglePodEdit(id) {
  _podEditId = _podEditId === id ? null : id;
  renderPodcastPage();
}

function renderPodcastPage() {
  const wrap = document.getElementById('pod-content');
  if (!wrap) return;

  const episodes = getPodEpisodes().slice().sort((a, b) => (a.episode || 0) - (b.episode || 0));

  const published    = episodes.filter(e => e.published);
  const ready        = episodes.filter(e => !e.published && e.edited);
  const inProduction = episodes.filter(e => !e.published && !e.edited && e.recorded);
  const outlining    = episodes.filter(e => !e.published && !e.edited && !e.recorded && e.outline_done);
  const notStarted   = episodes.filter(e => !e.published && !POD_STEPS.some(s => e[s.key]));

  const readyCount  = ready.length;
  const inProdCount = inProduction.length + outlining.length;

  let bannerBg, bannerIcon, bannerTitle, bannerSub;
  if (readyCount >= 3) {
    bannerBg = 'rgba(76,175,80,0.12)'; bannerIcon = '✅';
    bannerTitle = 'You\'re ahead — great buffer!';
    bannerSub = readyCount + ' episodes ready · ' + (inProdCount ? inProdCount + ' in production' : 'keep the pipeline moving');
  } else if (readyCount === 2) {
    bannerBg = 'rgba(76,175,80,0.10)'; bannerIcon = '✅';
    bannerTitle = 'Good — 2 episodes ready';
    bannerSub = inProdCount ? inProdCount + ' more in production — keep it moving' : 'Get something into production to stay ahead';
  } else if (readyCount === 1) {
    bannerBg = 'rgba(255,193,7,0.12)'; bannerIcon = '⚠️';
    bannerTitle = 'Low buffer — 1 episode ready';
    bannerSub = inProdCount ? 'Finish what\'s in production (' + inProdCount + ' eps) to build your buffer' : 'Record an episode this week to stay on schedule';
  } else if (inProdCount > 0) {
    bannerBg = 'rgba(255,112,67,0.12)'; bannerIcon = '🎙️';
    bannerTitle = 'Nothing ready — finish what\'s in production';
    bannerSub = inProdCount + ' episode' + (inProdCount > 1 ? 's' : '') + ' in progress · get at least one edited this week';
  } else {
    bannerBg = 'rgba(229,57,53,0.12)'; bannerIcon = '🚨';
    bannerTitle = 'Record an episode this week';
    bannerSub = 'Nothing ready, nothing in production — start outlining or recording now';
  }

  const nextScheduled = episodes
    .filter(e => !e.published && e.publish_date)
    .sort((a, b) => a.publish_date.localeCompare(b.publish_date))[0];
  const nextDateStr = nextScheduled
    ? ' · Next: <strong>' + new Date(nextScheduled.publish_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' — ' + _esc(nextScheduled.title) + '</strong>'
    : '';

  // Drive button
  const driveLink = localStorage.getItem('pod_drive_link') || '';
  const driveBtnEl = document.getElementById('pod-drive-btn');
  if (driveBtnEl) {
    if (_podDriveEdit) {
      driveBtnEl.innerHTML =
        '<div style="display:flex;gap:6px;align-items:center">' +
        '<input id="pod-drive-input" value="' + _esc(driveLink) + '" placeholder="Paste Google Drive link…" ' +
        'onkeydown="if(event.key===\'Enter\')savePodDriveLink()" ' +
        'style="padding:5px 10px;border-radius:7px;border:1px solid #5c9cf5;background:var(--surface2);color:var(--text);font-size:13px;flex:1;min-width:0"/>' +
        '<button onclick="savePodDriveLink()" style="padding:5px 12px;border-radius:7px;border:none;background:#5c9cf5;color:#fff;font-size:12px;font-weight:600;cursor:pointer">Save</button>' +
        '<button onclick="_podDriveEdit=false;renderPodcastPage()" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border2);background:none;color:var(--text2);font-size:12px;cursor:pointer">Cancel</button>' +
        '</div>';
      setTimeout(() => { const i = document.getElementById('pod-drive-input'); if (i) i.focus(); }, 0);
    } else if (driveLink) {
      driveBtnEl.innerHTML =
        '<div style="display:flex;gap:6px;align-items:center">' +
        '<a href="' + _esc(driveLink) + '" target="_blank" ' +
        'style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:7px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);color:#4ade80;font-size:12px;font-weight:600;text-decoration:none;white-space:nowrap">📁 Drive ↗</a>' +
        '<button onclick="_podDriveEdit=true;renderPodcastPage()" title="Change link" ' +
        'style="padding:3px 8px;border-radius:7px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:11px;cursor:pointer">✎</button>' +
        '</div>';
    } else {
      driveBtnEl.innerHTML =
        '<button onclick="_podDriveEdit=true;renderPodcastPage()" ' +
        'style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:7px;border:1px dashed var(--border2);background:none;color:var(--text3);font-size:12px;cursor:pointer">📁 Add Drive</button>';
    }
  }

  const statusHtml =
    '<div id="pod-status-section"><div style="background:' + bannerBg + ';border-radius:12px;padding:16px 20px;margin-bottom:1.5rem;display:flex;align-items:flex-start;gap:14px">' +
      '<div style="font-size:26px;line-height:1">' + bannerIcon + '</div>' +
      '<div style="flex:1">' +
        '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">' + bannerTitle + '</div>' +
        '<div style="font-size:13px;color:var(--text2)">' + bannerSub + nextDateStr + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap;text-align:center;flex-shrink:0">' +
        _ytMiniStat(readyCount, 'Ready', readyCount >= 2 ? 'var(--green-text)' : readyCount === 1 ? '#ffc107' : 'var(--red-text)') +
        _ytMiniStat(inProdCount, 'In prod', inProdCount ? '#ffc107' : 'var(--text3)') +
        _ytMiniStat(published.length, 'Published', 'var(--text2)') +
      '</div>' +
    '</div>';

  const pipelineHtml = (episodes.length
    ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1.2rem;font-size:12px">' +
      _ytPill(notStarted.length, 'Not started', '#ef5350', 'rgba(239,83,80,0.12)') +
      _ytPill(outlining.length, 'Outlining', '#64b5f6', 'rgba(100,181,246,0.2)') +
      _ytPill(inProduction.length, 'In production', '#ffc107', 'rgba(255,193,7,0.15)') +
      _ytPill(readyCount, 'Ready to publish', '#4caf50', 'rgba(76,175,80,0.15)') +
      _ytPill(published.length, 'Scheduled', 'var(--text3)', 'var(--surface2)') +
      '</div>'
    : '') + '</div>'; // close #pod-status-section

  const addHtml = _podAddOpen
    ? '<div style="display:flex;gap:8px;align-items:center;margin-bottom:1rem;flex-wrap:wrap">' +
      '<input id="pod-new-title" class="yt-title-input" placeholder="Episode title…" onkeydown="if(event.key===\'Enter\')addPodEpisode()" autofocus ' +
      'style="flex:1;min-width:200px;padding:8px 12px;border-radius:8px;border:1px solid #5c9cf5;background:var(--surface2);color:var(--text);font-size:14px;caret-color:#5c9cf5"/>' +
      '<button onclick="addPodEpisode()" style="padding:8px 18px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:13px;cursor:pointer;font-weight:600">Add</button>' +
      '<button onclick="_podAddOpen=false;renderPodcastPage()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border2);background:none;color:var(--text2);font-size:13px;cursor:pointer">Cancel</button>' +
      '</div>'
    : '<button onclick="_podAddOpen=true;renderPodcastPage()" ' +
      'style="margin-bottom:1rem;padding:8px 18px;border-radius:8px;border:1px dashed var(--border2);background:none;color:var(--text2);font-size:13px;cursor:pointer">+ Add episode</button>';

  const stepHeaders = POD_STEPS.map(s =>
    '<th style="text-align:center;padding:8px 6px;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap">' + s.label + '</th>'
  ).join('');

  const total = episodes.length;
  const stepColWidth = 84;
  const TH = 'font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:8px 6px;';

  const rows = episodes.map(ep => {
    const doneCount = POD_STEPS.filter(s => ep[s.key]).length;
    const pct = Math.round(doneCount / POD_STEPS.length * 100);
    const barColor = pct === 100 ? 'var(--green-text)' : pct >= 50 ? '#ffc107' : pct > 0 ? '#ff7043' : 'var(--border2)';

    const stepCells = POD_STEPS.map(s => {
      const done = !!ep[s.key];
      return '<td style="text-align:center;padding:8px 4px">' +
        '<button data-podbtn="' + ep.id + '-' + s.key + '" onclick="event.stopPropagation();togglePodStep(\'' + ep.id + '\',\'' + s.key + '\')" title="' + s.label + '" ' +
        'style="width:26px;height:26px;border-radius:50%;border:2px solid ' + (done ? 'var(--green-text)' : 'var(--border2)') + ';' +
        'background:' + (done ? 'rgba(76,175,80,0.18)' : 'transparent') + ';cursor:pointer;font-size:13px;' +
        'display:inline-flex;align-items:center;justify-content:center;color:var(--green-text);transition:all 0.15s">' +
        (done ? '✓' : '') + '</button></td>';
    }).join('');

    const mainRow = '<tr style="border-bottom:1px solid var(--border2);cursor:pointer" onclick="togglePodEdit(\'' + ep.id + '\')">' +
      '<td style="padding:10px 8px;font-size:13px;color:var(--text3);text-align:center;width:40px">' + (ep.episode || '—') + '</td>' +
      '<td style="padding:10px 12px;min-width:180px">' +
        '<div style="font-size:14px;font-weight:500;color:var(--text);margin-bottom:5px">' + _esc(ep.title) +
          (ep.guest ? '<span style="margin-left:8px;font-size:11px;color:var(--text3);font-weight:400">w/ ' + _esc(ep.guest) + '</span>' : '') +
        '</div>' +
        '<div style="height:3px;background:var(--border2);border-radius:2px;width:80px">' +
          '<div data-podbar="' + ep.id + '" style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:2px"></div>' +
        '</div>' +
      '</td>' +
      stepCells +
      '<td style="padding:8px;text-align:center;width:32px">' +
        '<button onclick="event.stopPropagation();deletePodEpisode(\'' + ep.id + '\')" title="Delete" ' +
        'style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;padding:2px 6px">✕</button>' +
      '</td></tr>';

    let editRow = '';
    if (_podEditId === ep.id) {
      const inputStyle = 'padding:6px 10px;border-radius:6px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px;width:100%;box-sizing:border-box';
      const labelStyle = 'font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px';

      const inp = (label, key, val, type) =>
        '<div style="display:flex;flex-direction:column;gap:0;min-width:130px">' +
        '<div style="' + labelStyle + '">' + label + '</div>' +
        '<input type="' + (type || 'text') + '" value="' + _esc(val || '') + '" ' +
        'onchange="savePodField(\'' + ep.id + '\',\'' + key + '\',this.value)" ' +
        'style="' + inputStyle + '"/>' +
        '</div>';

      const igRow = ep.guest
        ? '<div style="margin-top:10px;padding:10px 12px;border-radius:8px;background:var(--surface);border:1px solid var(--border2);display:flex;align-items:center;gap:10px">' +
          '<input type="checkbox" id="pod-ig-' + ep.id + '" ' + (ep.ig_post_done ? 'checked' : '') + ' ' +
          'onchange="savePodField(\'' + ep.id + '\',\'ig_post_done\',this.checked)" ' +
          'style="width:16px;height:16px;cursor:pointer;accent-color:#e1306c;flex-shrink:0"/>' +
          '<label for="pod-ig-' + ep.id + '" style="font-size:13px;color:var(--text2);cursor:pointer;user-select:none">' +
          '📸 Instagram collab post done' +
          '<span style="color:var(--text3);margin-left:6px">— w/ ' + _esc(ep.guest) + '</span>' +
          '</label>' +
          '</div>'
        : '';

      editRow = '<tr style="background:var(--surface2)">' +
        '<td colspan="' + (POD_STEPS.length + 3) + '" style="padding:12px 16px">' +
        '<div class="edit-panel-grid-3" style="margin-bottom:10px">' +
        inp('Episode #', 'episode', ep.episode, 'number') +
        inp('Title', 'title', ep.title, 'text') +
        inp('Guest', 'guest', ep.guest, 'text') +
        '</div>' +
        '<div class="edit-panel-grid-2" style="margin-bottom:0">' +
        inp('Publish Date', 'publish_date', ep.publish_date, 'date') +
        inp('Notes', 'notes', ep.notes, 'text') +
        '</div>' +
        igRow +
        '</td></tr>';
    }

    return mainRow + editRow;
  }).join('');

  const tableHtml = total
    ? '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="width:100%;min-width:420px;border-collapse:collapse;font-size:13px;table-layout:fixed">' +
      '<colgroup>' +
      '<col style="width:44px"/>' +
      '<col/>' +
      POD_STEPS.map(() => '<col style="width:' + stepColWidth + 'px"/>').join('') +
      '<col style="width:36px"/>' +
      '</colgroup>' +
      '<thead><tr style="border-bottom:2px solid var(--border2)">' +
      '<th style="' + TH + 'text-align:center">Ep</th>' +
      '<th style="' + TH + 'text-align:left;padding-left:12px">Title</th>' +
      stepHeaders +
      '<th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>'
    : '<div style="text-align:center;color:var(--text3);font-size:13px;padding:40px 0">No episodes yet — add your first one above.</div>';

  wrap.innerHTML = statusHtml + pipelineHtml + addHtml + tableHtml;

  if (_podAddOpen) {
    const inp = document.getElementById('pod-new-title');
    if (inp) inp.focus();
  }
}

function _renderPodStatus(episodes) {
  const el = document.getElementById('pod-status-section');
  if (!el) return;
  const published    = episodes.filter(e => e.published);
  const ready        = episodes.filter(e => !e.published && e.edited);
  const inProduction = episodes.filter(e => !e.published && !e.edited && e.recorded);
  const outlining    = episodes.filter(e => !e.published && !e.edited && !e.recorded && e.outline_done);
  const notStarted   = episodes.filter(e => !e.published && !POD_STEPS.some(s => e[s.key]));
  const readyCount   = ready.length;
  const inProdCount  = inProduction.length + outlining.length;

  let bannerBg, bannerIcon, bannerTitle, bannerSub;
  if (readyCount >= 3) {
    bannerBg = 'rgba(76,175,80,0.12)'; bannerIcon = '✅';
    bannerTitle = 'You\'re ahead — great buffer!';
    bannerSub = readyCount + ' episodes ready · ' + (inProdCount ? inProdCount + ' in production' : 'keep the pipeline moving');
  } else if (readyCount === 2) {
    bannerBg = 'rgba(76,175,80,0.10)'; bannerIcon = '✅';
    bannerTitle = 'Good — 2 episodes ready';
    bannerSub = inProdCount ? inProdCount + ' more in production — keep it moving' : 'Get something into production to stay ahead';
  } else if (readyCount === 1) {
    bannerBg = 'rgba(255,193,7,0.12)'; bannerIcon = '⚠️';
    bannerTitle = 'Low buffer — 1 episode ready';
    bannerSub = inProdCount ? 'Finish what\'s in production (' + inProdCount + ' eps) to build your buffer' : 'Record an episode this week to stay on schedule';
  } else if (inProdCount > 0) {
    bannerBg = 'rgba(255,112,67,0.12)'; bannerIcon = '🎙️';
    bannerTitle = 'Nothing ready — finish what\'s in production';
    bannerSub = inProdCount + ' episode' + (inProdCount > 1 ? 's' : '') + ' in progress · get at least one edited this week';
  } else {
    bannerBg = 'rgba(229,57,53,0.12)'; bannerIcon = '🚨';
    bannerTitle = 'Record an episode this week';
    bannerSub = 'Nothing ready, nothing in production — start outlining or recording now';
  }

  const nextScheduled = episodes.filter(e => !e.published && e.publish_date).sort((a, b) => a.publish_date.localeCompare(b.publish_date))[0];
  const nextDateStr = nextScheduled
    ? ' · Next: <strong>' + new Date(nextScheduled.publish_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' — ' + _esc(nextScheduled.title) + '</strong>'
    : '';

  const pillsHtml = episodes.length
    ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1.2rem;font-size:12px">' +
      _ytPill(notStarted.length, 'Not started', '#ef5350', 'rgba(239,83,80,0.12)') +
      _ytPill(outlining.length, 'Outlining', '#64b5f6', 'rgba(100,181,246,0.2)') +
      _ytPill(inProduction.length, 'In production', '#ffc107', 'rgba(255,193,7,0.15)') +
      _ytPill(readyCount, 'Ready to publish', '#4caf50', 'rgba(76,175,80,0.15)') +
      _ytPill(published.length, 'Scheduled', 'var(--text3)', 'var(--surface2)') +
      '</div>'
    : '';

  el.innerHTML =
    '<div style="background:' + bannerBg + ';border-radius:12px;padding:16px 20px;margin-bottom:1.5rem;display:flex;align-items:flex-start;gap:14px">' +
      '<div style="font-size:26px;line-height:1">' + bannerIcon + '</div>' +
      '<div style="flex:1">' +
        '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">' + bannerTitle + '</div>' +
        '<div style="font-size:13px;color:var(--text2)">' + bannerSub + nextDateStr + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap;text-align:center;flex-shrink:0">' +
        _ytMiniStat(readyCount, 'Ready', readyCount >= 2 ? 'var(--green-text)' : readyCount === 1 ? '#ffc107' : 'var(--red-text)') +
        _ytMiniStat(inProdCount, 'In prod', inProdCount ? '#ffc107' : 'var(--text3)') +
        _ytMiniStat(published.length, 'Published', 'var(--text2)') +
      '</div>' +
    '</div>' + pillsHtml;
}

// ── Short Form ─────────────────────────────────────────────

let _sfDriveEdit = false;

function saveSfDriveLink() {
  const el = document.getElementById('sf-drive-input');
  if (!el) return;
  const val = el.value.trim();
  if (val) localStorage.setItem('sf_drive_link', val);
  else localStorage.removeItem('sf_drive_link');
  _sfDriveEdit = false;
  renderShortFormPage();
}

function renderShortFormPage() {
  const sfContent = document.getElementById('sf-content');
  const driveBtnEl = document.getElementById('sf-drive-btn');

  const driveLink = localStorage.getItem('sf_drive_link') || '';

  if (driveBtnEl) {
    if (_sfDriveEdit) {
      driveBtnEl.innerHTML =
        '<div style="display:flex;gap:6px;align-items:center">' +
        '<input id="sf-drive-input" value="' + _esc(driveLink) + '" placeholder="Paste Google Drive link…" ' +
        'onkeydown="if(event.key===\'Enter\')saveSfDriveLink()" ' +
        'style="padding:5px 10px;border-radius:7px;border:1px solid #5c9cf5;background:var(--surface2);color:var(--text);font-size:13px;flex:1;min-width:0"/>' +
        '<button onclick="saveSfDriveLink()" style="padding:5px 12px;border-radius:7px;border:none;background:#5c9cf5;color:#fff;font-size:12px;font-weight:600;cursor:pointer">Save</button>' +
        '<button onclick="_sfDriveEdit=false;renderShortFormPage()" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border2);background:none;color:var(--text2);font-size:12px;cursor:pointer">Cancel</button>' +
        '</div>';
      setTimeout(() => { const i = document.getElementById('sf-drive-input'); if (i) i.focus(); }, 0);
    } else if (driveLink) {
      driveBtnEl.innerHTML =
        '<div style="display:flex;gap:6px;align-items:center">' +
        '<a href="' + _esc(driveLink) + '" target="_blank" ' +
        'style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:7px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);color:#4ade80;font-size:12px;font-weight:600;text-decoration:none;white-space:nowrap">📁 Drive ↗</a>' +
        '<button onclick="_sfDriveEdit=true;renderShortFormPage()" title="Change link" ' +
        'style="padding:3px 8px;border-radius:7px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:11px;cursor:pointer">✎</button>' +
        '</div>';
    } else {
      driveBtnEl.innerHTML =
        '<button onclick="_sfDriveEdit=true;renderShortFormPage()" ' +
        'style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:7px;border:1px dashed var(--border2);background:none;color:var(--text3);font-size:12px;cursor:pointer">📁 Add Drive</button>';
    }
  }

  if (sfContent) {
    sfContent.innerHTML =
      '<div style="color:var(--text2);font-size:13px;line-height:1.7;padding:8px 0">' +
      'Full short-form tracking is coming soon. In the meantime, use your Drive folder to organize Reels, TikToks, and Shorts.' +
      '</div>';
  }
}
