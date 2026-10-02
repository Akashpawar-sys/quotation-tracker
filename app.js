'use strict';

/* ==========================================================
   Inspire Computers – Quote Tracker
   1. Config  2. State & storage  3. Helpers  4. Home screen
   5. Enquiry form  6. Actions  7. Backup / export  8. Start
   ========================================================== */

/* 1. Config ------------------------------------------------ */
const STORAGE_KEY = 'shop_quotes_v1';          // same key as before, so old data still loads
const DEFAULT_SHOP = 'Inspire Computers';
const STATUSES = ['New', 'Quoted', 'Follow-up', 'Negotiation', 'Won', 'Lost'];
const STATUS_COLOR = {
  'New': '#6b7280', 'Quoted': '#2563eb', 'Follow-up': '#d97706',
  'Negotiation': '#7c3aed', 'Won': '#16a34a', 'Lost': '#dc2626'
};
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'EMI / Finance', 'Cheque'];
const PRODUCT_TYPES = ['Laptop', 'Desktop', 'AIO', 'Other'];
const FILTERS = ['All', 'Due'].concat(STATUSES);
const FORM_FIELDS = ['name', 'phone', 'type', 'budget', 'req', 'next', 'pay', 'valid'];

/* 2. State & storage --------------------------------------- */
let state = { shop: DEFAULT_SHOP, leads: [] };
let work = null;          // enquiry currently open in the form
let filter = 'All';
let query = '';

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { alert('Could not save in this browser'); }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) { /* ignore corrupt data */ }
  if (!state.shop || state.shop === 'My Computer Shop') { state.shop = DEFAULT_SHOP; save(); }
  if (!Array.isArray(state.leads)) state.leads = [];
}

/* 3. Helpers ----------------------------------------------- */
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const total = l => (l.items || []).reduce((t, i) => t + (+i.q || 0) * (+i.p || 0), 0);
const isDue = l => l.next && l.next <= today() && l.status !== 'Won' && l.status !== 'Lost';
const blankItem = () => ({ d: '', q: 1, p: '' });

function esc(s) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => map[c]);
}

// Indian mobile numbers: add 91 when only 10 digits are given
function waNumber(p) {
  p = String(p || '').replace(/\D/g, '');
  return p.length === 10 ? '91' + p : p;
}

function options(list, selected, blank) {
  return (blank ? '<option value="">' + blank + '</option>' : '') +
    list.map(t => '<option' + (t === selected ? ' selected' : '') + '>' + t + '</option>').join('');
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
}

/* 4. Home screen ------------------------------------------- */
function countFor(f) {
  if (f === 'All') return state.leads.length;
  if (f === 'Due') return state.leads.filter(isDue).length;
  return state.leads.filter(l => l.status === f).length;
}

function leadCard(l) {
  const c = STATUS_COLOR[l.status];
  return '<div class="card lead" style="--c:' + c + '" onclick="edit(\'' + l.id + '\')">' +
    '<div class="lead-head"><span class="lead-name">' + esc(l.name || '(no name)') + '</span>' +
    '<select class="quick-status" style="background:' + c + '" onclick="event.stopPropagation()" ' +
    'onchange="setStatusQuick(\'' + l.id + '\',this.value)" aria-label="Change status">' +
    options(STATUSES, l.status) + '</select></div>' +
    '<div class="muted">' + esc(l.type) + ' • ' + esc(l.phone) + (l.pay ? ' • ' + esc(l.pay) : '') + '</div>' +
    '<div class="lead-price">' + inr(total(l)) + '</div>' +
    (l.next ? '<div class="muted">Next follow-up: <span class="tag' + (isDue(l) ? ' due' : '') + '">' + l.next + '</span></div>' : '') +
    '</div>';
}

function list() {
  const q = query.toLowerCase();
  const leads = state.leads
    .filter(l => filter === 'All' || (filter === 'Due' ? isDue(l) : l.status === filter))
    .filter(l => (l.name + l.phone + l.type + l.req).toLowerCase().includes(q))
    .sort((a, b) => (b.created || '').localeCompare(a.created || ''));

  let h = '<div class="topbar"><h1>📋 ' + esc(state.shop) + '</h1>' +
    '<button onclick="edit(\'new\')">+ New enquiry</button></div>';

  h += '<input id="sq" type="search" placeholder="Search name, phone or product" value="' + esc(query) + '" ' +
    'oninput="query=this.value;list()">';

  h += '<div class="tiles">' + FILTERS.map((f, n) => {
    const col = STATUS_COLOR[f] || (f === 'Due' ? '#c2410c' : '#0b6e4f');
    return '<button class="tile' + (filter === f ? ' on' : '') + '" style="--c:' + col + '" ' +
      'onclick="filter=FILTERS[' + n + '];list()"><b>' + countFor(f) + '</b>' +
      '<span>' + (f === 'Due' ? 'Follow-up due' : f) + '</span></button>';
  }).join('') + '</div>';

  h += leads.length
    ? leads.map(leadCard).join('')
    : '<div class="card empty">No enquiries here yet.<br>Tap “+ New enquiry” when a customer comes in.</div>';

  h += '<div class="row footer">' +
    '<button class="btn-ghost" onclick="exportCsv()">⬇ Export CSV</button>' +
    '<button class="btn-ghost" onclick="backup()">⬇ Backup</button>' +
    '<label class="btn btn-ghost" style="margin:0">⬆ Restore' +
    '<input type="file" accept=".json" hidden onchange="restore(this)"></label>' +
    '<button class="btn-ghost" onclick="renameShop()">⚙ Shop name</button></div>' +
    '<p class="muted">Data is saved in this browser on this device. Use Backup regularly.</p>';

  $('app').innerHTML = h;

  // keep typing focus in the search box after re-render
  const box = $('sq');
  if (query && box) { box.focus(); box.setSelectionRange(query.length, query.length); }
}

/* 5. Enquiry form ------------------------------------------ */
function edit(id) {
  if (id === 'new') {
    work = {
      id: 'L' + Date.now(), created: new Date().toISOString(),
      name: '', phone: '', type: 'Laptop', req: '', budget: '',
      items: [blankItem()], pay: '', valid: '', status: 'New', next: '', log: [], isNew: 1
    };
  } else {
    work = JSON.parse(JSON.stringify(state.leads.find(l => l.id === id)));
    work.items = work.items && work.items.length ? work.items : [blankItem()];
    work.log = work.log || [];
  }
  form();
}

function itemRow(i, n) {
  return '<div class="item">' +
    '<input class="idesc" placeholder="Item (e.g. HP 15 i5 16GB 512GB)" value="' + esc(i.d) + '" ' +
    'oninput="work.items[' + n + '].d=this.value">' +
    '<input type="number" inputmode="numeric" placeholder="Qty" value="' + esc(i.q) + '" ' +
    'oninput="work.items[' + n + '].q=this.value;updateTotal()">' +
    '<input type="number" inputmode="numeric" placeholder="Price" value="' + esc(i.p) + '" ' +
    'oninput="work.items[' + n + '].p=this.value;updateTotal()">' +
    '<button class="btn-danger" onclick="delItem(' + n + ')" aria-label="Remove item">✕</button></div>';
}

function form() {
  const w = work;
  let h = '<div class="topbar"><button class="btn-ghost" onclick="back()">🏠 Home</button>' +
    '<h1>' + (w.isNew ? 'New enquiry' : esc(w.name || 'Enquiry')) + '</h1></div>';

  // Customer details
  h += '<div class="card"><h2>Customer</h2><div class="grid2">' +
    '<div><label for="name">Name</label><input id="name" value="' + esc(w.name) + '"></div>' +
    '<div><label for="phone">Mobile / WhatsApp</label><input id="phone" type="tel" value="' + esc(w.phone) + '"></div>' +
    '<div><label for="type">Looking for</label><select id="type">' + options(PRODUCT_TYPES, w.type) + '</select></div>' +
    '<div><label for="budget">Budget (₹)</label><input id="budget" type="number" inputmode="numeric" value="' + esc(w.budget) + '"></div></div>' +
    '<label for="req">Requirement / notes</label><textarea id="req" rows="2">' + esc(w.req) + '</textarea>' +
    '<label>Status</label><div class="chips">' + STATUSES.map((t, n) =>
      '<button id="st' + n + '" class="' + (t === w.status ? 'on' : '') + '" style="--c:' + STATUS_COLOR[t] + '" ' +
      'onclick="setStatus(' + n + ')">' + (t === w.status ? '✔ ' : '') + t + '</button>').join('') + '</div>' +
    '<label for="next">Next follow-up date</label><input id="next" type="date" value="' + esc(w.next) + '"></div>';

  // Quotation
  h += '<div class="card"><h2>Quotation</h2>' + w.items.map(itemRow).join('') +
    '<button class="btn-ghost" onclick="addItem()">+ Add item</button>' +
    '<div class="grid2"><div><label for="pay">Mode of payment</label><select id="pay">' + options(PAYMENT_MODES, w.pay, 'Select') + '</select></div>' +
    '<div><label for="valid">Valid till</label><input id="valid" type="date" value="' + esc(w.valid) + '"></div></div>' +
    '<div class="total" id="tot"></div>' +
    '<div class="row"><button onclick="saveLead()">💾 Save</button>' +
    '<button class="btn-wa" onclick="sendQuote()">💬 Send quote on WhatsApp</button></div></div>';

  // Follow-ups (only for saved enquiries)
  if (!w.isNew) {
    h += '<div class="card"><h2>Follow-ups</h2><div class="grid2">' +
      '<div><label for="fk">Type</label><select id="fk"><option>📞 Call</option><option>💬 WhatsApp</option><option>🏪 Visit</option></select></div>' +
      '<div><label for="fn">Next follow-up</label><input id="fn" type="date"></div></div>' +
      '<label for="fnote">What did the customer say?</label><textarea id="fnote" rows="2"></textarea>' +
      '<div class="row"><button onclick="addLog()">Add follow-up</button>' +
      (w.phone ? '<a class="btn btn-ghost" href="tel:' + esc(w.phone) + '">📞 Call</a>' +
        '<a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/' + waNumber(w.phone) + '">💬 Chat</a>' : '') +
      '</div>' +
      w.log.slice().reverse().map(x =>
        '<div class="log"><div class="muted">' + new Date(x.t).toLocaleString('en-IN') + ' • ' + x.k + '</div>' + esc(x.n) + '</div>').join('') +
      '</div><button class="btn-danger" onclick="del()">Delete enquiry</button>';
  }

  h += '<button class="fab" onclick="back()">🏠 Home</button>';
  $('app').innerHTML = h;
  updateTotal();
}

/* 6. Actions ----------------------------------------------- */
function syncForm() {
  FORM_FIELDS.forEach(k => { const e = $(k); if (e) work[k] = e.value; });
}

function updateTotal() {
  const e = $('tot');
  if (e) { syncForm(); e.textContent = 'Total: ' + inr(total(work)); }
}

// re-render the form without jumping the scroll position
function rerender() {
  const y = window.pageYOffset || 0;
  form();
  window.scrollTo(0, y);
}

function addItem() {
  syncForm(); work.items.push(blankItem()); rerender();
  const rows = document.querySelectorAll('.idesc');
  if (rows.length) rows[rows.length - 1].focus();
}

function delItem(n) {
  syncForm(); work.items.splice(n, 1);
  if (!work.items.length) work.items.push(blankItem());
  rerender();
}

function persistWork() {
  if (work.isNew) { delete work.isNew; state.leads.push(work); }
  else state.leads = state.leads.map(l => l.id === work.id ? work : l);
  save();
}

function saveLead() {
  syncForm();
  if (!work.name && !work.phone) { alert('Enter a name or phone number'); return; }
  persistWork();
  form();
}

function setStatus(n) {
  syncForm(); work.status = STATUSES[n];
  STATUSES.forEach((t, k) => {
    const b = $('st' + k);
    if (b) { b.className = k === n ? 'on' : ''; b.textContent = (k === n ? '✔ ' : '') + t; }
  });
  if (!work.isNew) { state.leads = state.leads.map(l => l.id === work.id ? work : l); save(); }
}

function setStatusQuick(id, value) {
  state.leads.forEach(l => { if (l.id === id) l.status = value; });
  save(); list();
}

function sendQuote() {
  syncForm();
  if (!work.phone) { alert('Enter the customer mobile number'); return; }
  if (work.status === 'New') work.status = 'Quoted';
  work.log.push({ t: new Date().toISOString(), k: '📤 Quotation sent', n: 'Total ' + inr(total(work)) });
  if (!work.next) {                       // default follow-up: 2 days later
    const d = new Date(); d.setDate(d.getDate() + 2);
    work.next = d.toISOString().slice(0, 10);
  }
  persistWork();

  let m = 'Hello ' + (work.name || '') + ',\nThank you for visiting *' + state.shop + '*.\nHere is your quotation:\n\n';
  work.items.forEach((i, n) => {
    if (i.d) m += (n + 1) + '. ' + i.d + ' x' + (i.q || 1) + ' = ' + inr((+i.q || 0) * (+i.p || 0)) + '\n';
  });
  m += '\n*Total: ' + inr(total(work)) + '*';
  if (work.pay) m += '\nPayment: ' + work.pay;
  if (work.valid) m += '\nValid till: ' + work.valid;
  m += '\n\nFeel free to call us for any questions.';

  window.open('https://wa.me/' + waNumber(work.phone) + '?text=' + encodeURIComponent(m), '_blank');
  form();
}

function addLog() {
  const note = $('fnote').value.trim();
  if (!note) { alert('Write a short note'); return; }
  syncForm();
  work.log.push({ t: new Date().toISOString(), k: $('fk').value, n: note });
  if ($('fn').value) work.next = $('fn').value;
  if (work.status === 'Quoted' || work.status === 'New') work.status = 'Follow-up';
  state.leads = state.leads.map(l => l.id === work.id ? work : l);
  save(); form();
}

function del() {
  if (confirm('Delete this enquiry permanently?')) {
    state.leads = state.leads.filter(l => l.id !== work.id);
    save(); back();
  }
}

function back() { work = null; list(); }

function renameShop() {
  const n = prompt('Shop name (shown in WhatsApp message)', state.shop);
  if (n) { state.shop = n; save(); list(); }
}

/* 7. Backup / export --------------------------------------- */
function backup() {
  download('quotes-backup-' + today() + '.json', JSON.stringify(state), 'application/json');
}

function restore(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.leads) { state = data; save(); list(); }
    } catch (e) { alert('Invalid backup file'); }
  };
  reader.readAsText(file);
}

function exportCsv() {
  const rows = [['Date', 'Name', 'Phone', 'Type', 'Requirement', 'Status', 'Payment mode', 'Total', 'Next follow-up', 'Follow-up notes']];
  state.leads.forEach(l => rows.push([
    (l.created || '').slice(0, 10), l.name, l.phone, l.type, l.req, l.status, l.pay, total(l), l.next,
    (l.log || []).map(x => x.k + ': ' + x.n).join(' | ')
  ]));
  const csv = rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\n');
  download('enquiries-' + today() + '.csv', csv, 'text/csv');
}

/* 8. Start ------------------------------------------------- */
load();
list();
