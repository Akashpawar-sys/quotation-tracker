'use strict';

/* ==========================================================
   Inspire Computers – Admin Panel
   Reads and writes the same data as the main app (index.html).
   1. Config  2. State  3. Helpers  4. Lock screen  5. Dashboard
   6. Enquiries  7. Settings  8. Shell & start
   ========================================================== */

/* 1. Config ------------------------------------------------ */
const KEY = 'shop_quotes_v1';          // enquiries (shared with the main app)
const ADMIN_KEY = 'shop_admin_v1';     // admin PIN (kept separate so Restore never overwrites it)
const SESSION_KEY = 'shop_admin_ok';
const STATUSES = ['New', 'Quoted', 'Follow-up', 'Negotiation', 'Won', 'Lost'];
const COLOR = {
  'New': '#6b7280', 'Quoted': '#2563eb', 'Follow-up': '#d97706',
  'Negotiation': '#7c3aed', 'Won': '#16a34a', 'Lost': '#dc2626'
};
const TABS = [
  ['dashboard', '📊', 'Dashboard', 'How the shop is doing'],
  ['enquiries', '📋', 'Enquiries', 'Search, sort and update every enquiry'],
  ['settings', '⚙', 'Settings', 'Shop details, PIN and your data']
];

/* 2. State ------------------------------------------------- */
let state = { shop: 'Inspire Computers', leads: [] };
let admin = { pin: '' };
let tab = 'dashboard', query = '', filter = 'All', sortBy = 'new';
const selected = new Set();

function loadAll() {
  try { const r = localStorage.getItem(KEY); if (r) state = JSON.parse(r); } catch (e) {}
  try { const a = localStorage.getItem(ADMIN_KEY); if (a) admin = JSON.parse(a); } catch (e) {}
  if (!Array.isArray(state.leads)) state.leads = [];
}
function saveState() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { alert('Could not save in this browser'); }
}
function saveAdmin() {
  try { localStorage.setItem(ADMIN_KEY, JSON.stringify(admin)); } catch (e) {}
}

/* 3. Helpers ----------------------------------------------- */
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const total = l => (l.items || []).reduce((t, i) => t + (+i.q || 0) * (+i.p || 0), 0);
const isOpen = l => l.status !== 'Won' && l.status !== 'Lost';
const isDue = l => l.next && l.next <= today() && isOpen(l);
const sum = list => list.reduce((t, l) => t + total(l), 0);
const initials = s => (String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase();

function esc(s) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => map[c]);
}
// Light hash so the PIN is not stored as plain text. This is a casual lock, not real security.
function hashPin(p) {
  let x = 5381; const s = 'inspire:' + p;
  for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0;
  return String(x);
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
}
function options(list, sel) {
  return list.map(t => '<option' + (t === sel ? ' selected' : '') + '>' + t + '</option>').join('');
}

/* 4. Lock screen ------------------------------------------- */
function isLocked() { return !!admin.pin && sessionStorage.getItem(SESSION_KEY) !== '1'; }

function lockScreen() {
  $('app').innerHTML =
    '<div class="lock card"><h1>🔒 Admin</h1><div class="muted">' + esc(state.shop) + '</div>' +
    '<input id="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN" ' +
    'onkeydown="if(event.key===\'Enter\')unlock()">' +
    '<div class="err" id="err"></div><button onclick="unlock()">Unlock</button>' +
    '<p><a href="index.html" class="muted">← Back to app</a></p></div>';
  $('pin').focus();
}
function unlock() {
  if (hashPin($('pin').value) === admin.pin) { sessionStorage.setItem(SESSION_KEY, '1'); render(); }
  else { $('err').textContent = 'Wrong PIN. Try again.'; $('pin').value = ''; }
}
function lockNow() { sessionStorage.removeItem(SESSION_KEY); render(); }

/* 5. Dashboard --------------------------------------------- */
function monthlyData() {
  const out = [], now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const inMonth = state.leads.filter(l => (l.created || '').slice(0, 7) === key);
    out.push({ label: d.toLocaleString('en-IN', { month: 'short' }), count: inMonth.length, won: sum(inMonth.filter(l => l.status === 'Won')) });
  }
  return out;
}

function hbars(rows, max) {
  return rows.map(r =>
    '<div class="hbar" style="--c:' + (r.color || 'var(--accent)') + '"><span>' + esc(r.label) + '</span>' +
    '<div class="track"><div class="fill" style="width:' + (max ? (r.n / max * 100) : 0) + '%"></div></div><em>' + r.n + '</em></div>').join('');
}

function donut(rows) {
  const t = rows.reduce((a, r) => a + r.n, 0);
  let acc = 0;
  const stops = rows.filter(r => r.n).map(r => {
    const from = acc / t * 100; acc += r.n;
    return r.color + ' ' + from + '% ' + (acc / t * 100) + '%';
  });
  const bg = t ? 'conic-gradient(' + stops.join(',') + ')' : 'var(--border)';
  return '<div class="donut-wrap"><div class="donut" style="background:' + bg + '"><div><b>' + t + '</b><span>enquiries</span></div></div>' +
    '<ul class="legend">' + rows.map(r => '<li><i style="background:' + r.color + '"></i>' + esc(r.label) + '<b>' + r.n + '</b></li>').join('') + '</ul></div>';
}

function dashboard() {
  const L = state.leads;
  const won = L.filter(l => l.status === 'Won'), lost = L.filter(l => l.status === 'Lost');
  const open = L.filter(isOpen), due = L.filter(isDue);
  const closed = won.length + lost.length;
  const rate = closed ? Math.round(won.length / closed * 100) : 0;

  const stat = (icon, v, label, color, cls) =>
    '<div class="stat ' + (cls || '') + '" style="--c:' + color + '"><div class="chip">' + icon + '</div><div><b>' + v + '</b><span>' + label + '</span></div></div>';
  let h = '<div class="hero"><div><small>Revenue won</small><div class="big">' + inr(sum(won)) + '</div></div>' +
    '<div class="hero-side"><div><b>' + won.length + '</b><span>Deals won</span></div>' +
    '<div><b>' + rate + '%</b><span>Win rate</span></div>' +
    '<div><b>' + inr(sum(open)) + '</b><span>Open quote value</span></div></div></div>';
  h += '<div class="stats">' +
    stat('📋', L.length, 'Total enquiries', '#2563eb') +
    stat('⏳', open.length, 'Open enquiries', '#d97706') +
    stat('✅', won.length, 'Won', '#16a34a') +
    stat('❌', lost.length, 'Lost', '#dc2626') +
    stat('🔔', due.length, 'Follow-ups due', '#c2410c', due.length ? 'warn' : '') + '</div>';

  const statusRows = STATUSES.map(s => ({ label: s, n: L.filter(l => l.status === s).length, color: COLOR[s] }));
  const payMap = {};
  L.forEach(l => { const k = l.pay || 'Not set'; payMap[k] = (payMap[k] || 0) + 1; });
  const payRows = Object.keys(payMap).map(k => ({ label: k, n: payMap[k] }));
  const typeMap = {};
  L.forEach(l => { typeMap[l.type || 'Other'] = (typeMap[l.type || 'Other'] || 0) + 1; });
  const typeRows = Object.keys(typeMap).map(k => ({ label: k, n: typeMap[k] }));
  const months = monthlyData(), maxM = Math.max.apply(null, months.map(m => m.count).concat([1]));

  h += '<div class="cols">' +
    '<div class="card"><h2>Pipeline by status</h2>' + donut(statusRows) + '</div>' +
    '<div class="card"><h2>Enquiries, last 6 months</h2><div class="months">' +
    months.map(m => '<div class="month" title="Won: ' + inr(m.won) + '"><b>' + m.count + '</b><div class="col" style="height:' + (m.count / maxM * 78) + '%"></div><span class="lbl">' + m.label + '</span></div>').join('') +
    '</div></div>' +
    '<div class="card"><h2>Follow-ups due</h2>' +
    (due.length ? due.sort((a, b) => a.next.localeCompare(b.next)).slice(0, 6).map(l =>
      '<div class="due-item"><span><b>' + esc(l.name || l.phone || '(no name)') + '</b><br><span class="muted">' + esc(l.phone) + '</span></span>' +
      '<span class="tag due">' + l.next + '</span></div>').join('') : '<p class="muted">Nothing due. All caught up.</p>') + '</div>' +
    '<div class="card"><h2>By product type</h2>' + hbars(typeRows, Math.max.apply(null, typeRows.map(r => r.n).concat([1]))) +
    '<div class="sub-title">By payment mode</div>' + hbars(payRows, Math.max.apply(null, payRows.map(r => r.n).concat([1]))) + '</div>' +
    '</div>';
  return h;
}

/* 6. Enquiries --------------------------------------------- */
function filteredLeads() {
  const q = query.toLowerCase();
  const list = state.leads
    .filter(l => filter === 'All' || (filter === 'Due' ? isDue(l) : l.status === filter))
    .filter(l => (l.name + l.phone + l.type + l.req).toLowerCase().includes(q));
  const sorters = {
    new: (a, b) => (b.created || '').localeCompare(a.created || ''),
    old: (a, b) => (a.created || '').localeCompare(b.created || ''),
    high: (a, b) => total(b) - total(a),
    name: (a, b) => (a.name || '').localeCompare(b.name || '')
  };
  return list.sort(sorters[sortBy]);
}

function enquiries() {
  const list = filteredLeads();
  const allOn = list.length && list.every(l => selected.has(l.id));
  let h = '<div class="toolbar">' +
    '<input id="aq" type="search" placeholder="Search name, phone or product" value="' + esc(query) + '" oninput="query=this.value;render()">' +
    '<select onchange="filter=this.value;render()" aria-label="Filter">' + options(['All', 'Due'].concat(STATUSES), filter) + '</select>' +
    '<select onchange="sortBy=this.value;render()" aria-label="Sort">' +
    [['new', 'Newest first'], ['old', 'Oldest first'], ['high', 'Highest value'], ['name', 'Name A–Z']].map(o =>
      '<option value="' + o[0] + '"' + (o[0] === sortBy ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>';

  if (selected.size) {
    h += '<div class="bulk"><b>' + selected.size + ' selected</b>' +
      '<select id="bulkSt">' + options(STATUSES, '') + '</select>' +
      '<button onclick="bulkStatus()">Change status</button>' +
      '<button class="btn-danger" onclick="bulkDelete()">Delete</button>' +
      '<button class="btn-ghost" onclick="selected.clear();render()">Clear</button></div>';
  }

  h += '<div class="table-wrap"><table><thead><tr>' +
    '<th><input type="checkbox" ' + (allOn ? 'checked' : '') + ' onchange="toggleAll(this.checked)" aria-label="Select all"></th>' +
    '<th>Customer</th><th>Looking for</th><th>Status</th><th class="num">Quote</th><th>Next follow-up</th><th>Created</th></tr></thead><tbody>' +
    (list.length ? list.map(l =>
      '<tr><td><input type="checkbox" ' + (selected.has(l.id) ? 'checked' : '') + ' onchange="toggleOne(\'' + l.id + '\',this.checked)" aria-label="Select"></td>' +
      '<td><div class="who"><div class="av">' + esc(initials(l.name || l.phone)) + '</div><div><b>' + esc(l.name || '(no name)') + '</b><span class="muted">' + esc(l.phone) + '</span></div></div></td>' +
      '<td>' + esc(l.type) + '<div class="muted">' + esc((l.req || '').slice(0, 40)) + '</div></td>' +
      '<td><select class="quick-status" style="background:' + COLOR[l.status] + '" onchange="setStatus(\'' + l.id + '\',this.value)">' + options(STATUSES, l.status) + '</select></td>' +
      '<td class="num"><b>' + inr(total(l)) + '</b></td>' +
      '<td>' + (l.next ? '<span class="tag' + (isDue(l) ? ' due' : '') + '">' + l.next + '</span>' : '<span class="muted">–</span>') + '</td>' +
      '<td class="muted">' + (l.created || '').slice(0, 10) + '</td></tr>').join('')
      : '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">No enquiries match.</td></tr>') +
    '</tbody></table></div>' +
    '<p class="muted count-note">Showing ' + list.length + ' of ' + state.leads.length + ' enquiries.</p>';
  return h;
}

function setStatus(id, v) { state.leads.forEach(l => { if (l.id === id) l.status = v; }); saveState(); render(); }
function toggleOne(id, on) { on ? selected.add(id) : selected.delete(id); render(); }
function toggleAll(on) { filteredLeads().forEach(l => on ? selected.add(l.id) : selected.delete(l.id)); render(); }
function bulkStatus() {
  const v = $('bulkSt').value;
  state.leads.forEach(l => { if (selected.has(l.id)) l.status = v; });
  saveState(); selected.clear(); render();
}
function bulkDelete() {
  if (!confirm('Delete ' + selected.size + ' enquiries permanently?')) return;
  state.leads = state.leads.filter(l => !selected.has(l.id));
  saveState(); selected.clear(); render();
}

/* 7. Settings ---------------------------------------------- */
function settings() {
  return (admin.pin ? '' : '<div class="notice">No PIN is set. Anyone who opens this page can see and change all data. Set a PIN below.</div>') +
    '<div class="set-grid">' +
    '<div class="card"><h2>Shop name</h2><p class="muted">Shown in the app and in WhatsApp quotes.</p>' +
    '<input id="shopName" value="' + esc(state.shop) + '"><div class="row"><button onclick="saveShop()">Save name</button></div></div>' +

    '<div class="card"><h2>Admin PIN</h2><p class="muted">' + (admin.pin ? 'A PIN is set.' : 'Choose 4 or more digits.') + '</p>' +
    '<input id="newPin" type="password" inputmode="numeric" placeholder="New PIN"><div class="row">' +
    '<button onclick="setPin()">' + (admin.pin ? 'Change PIN' : 'Set PIN') + '</button>' +
    (admin.pin ? '<button class="btn-ghost" onclick="removePin()">Remove PIN</button>' : '') + '</div></div>' +

    '<div class="card"><h2>Data</h2><p class="muted">' + state.leads.length + ' enquiries stored in this browser.</p><div class="row">' +
    '<button class="btn-ghost" onclick="backup()">⬇ Backup</button>' +
    '<label class="btn btn-ghost" style="margin:0">⬆ Restore<input type="file" accept=".json" hidden onchange="restore(this)"></label>' +
    '<button class="btn-ghost" onclick="exportCsv()">⬇ Export CSV</button></div></div>' +

    '<div class="card danger"><h2>Danger zone</h2><p class="muted">Removes every enquiry. Take a backup first.</p>' +
    '<div class="row"><button class="btn-danger" onclick="clearAll()">Delete all enquiries</button></div></div></div>';
}

function saveShop() {
  const n = $('shopName').value.trim();
  if (!n) { alert('Enter a shop name'); return; }
  state.shop = n; saveState(); render();
}
function setPin() {
  const p = $('newPin').value.trim();
  if (!/^\d{4,}$/.test(p)) { alert('PIN must be at least 4 digits'); return; }
  admin.pin = hashPin(p); saveAdmin();
  sessionStorage.setItem(SESSION_KEY, '1'); render(); alert('PIN saved');
}
function removePin() {
  if (!confirm('Remove the PIN? Anyone will be able to open this page.')) return;
  admin.pin = ''; saveAdmin(); render();
}
function backup() { download('quotes-backup-' + today() + '.json', JSON.stringify(state), 'application/json'); }
function restore(input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.leads)) throw 0;
      if (!confirm('Replace current data with ' + d.leads.length + ' enquiries from this file?')) return;
      state = d; saveState(); selected.clear(); render();
    } catch (e) { alert('Invalid backup file'); }
  };
  r.readAsText(f);
}
function exportCsv() {
  const rows = [['Date', 'Name', 'Phone', 'Type', 'Requirement', 'Status', 'Payment mode', 'Total', 'Next follow-up', 'Follow-up notes']];
  state.leads.forEach(l => rows.push([(l.created || '').slice(0, 10), l.name, l.phone, l.type, l.req, l.status, l.pay, total(l), l.next,
    (l.log || []).map(x => x.k + ': ' + x.n).join(' | ')]));
  download('enquiries-' + today() + '.csv',
    rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv');
}
function clearAll() {
  if (prompt('Type DELETE to remove all ' + state.leads.length + ' enquiries') !== 'DELETE') return;
  state.leads = []; saveState(); selected.clear(); render();
}

/* 8. Shell & start ----------------------------------------- */
function render() {
  if (isLocked()) { lockScreen(); return; }
  loadAll();
  const views = { dashboard: dashboard, enquiries: enquiries, settings: settings };
  const cur = TABS.filter(t => t[0] === tab)[0];
  $('app').innerHTML =
    '<div class="shell"><aside class="side"><div class="brand">🛠<div><b>' + esc(state.shop) + '</b><span>Admin panel</span></div></div>' +
    '<nav class="nav">' + TABS.map(t => '<button class="' + (t[0] === tab ? 'on' : '') + '" onclick="tab=\'' + t[0] + '\';render()">' +
      '<span class="ic">' + t[1] + '</span>' + t[2] + '</button>').join('') + '</nav></aside>' +
    '<section class="main"><header class="page-head"><div><h1>' + cur[2] + '</h1><p class="muted">' + cur[3] + '</p></div>' +
    '<div class="row"><a class="btn btn-ghost" href="index.html">← Open app</a>' +
    (admin.pin ? '<button class="btn-ghost" onclick="lockNow()">🔒 Lock</button>' : '') + '</div></header>' +
    views[tab]() + '</section></div>';

  const box = $('aq');                       // keep typing focus in search
  if (tab === 'enquiries' && query && box) { box.focus(); box.setSelectionRange(query.length, query.length); }
}

loadAll();
render();
