'use strict';
/* Tablić web client: lobby, table, animations. Talks only to the server it was loaded from. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const TEAM_COL = ['var(--team0)', 'var(--team1)', 'var(--team2)', 'var(--team3)'];

// ------------------------------------------------------------------ cards
// id = suit * 13 + (rank - 2); suits 0 ♠, 1 ♥, 2 ♦, 3 ♣; ranks 2..14 (J 11, Q 12, K 13, A 14).
const SUIT_FILE = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_SYM = ['♠', '♥', '♦', '♣'];
const RANK_LABEL = {11: 'J', 12: 'Q', 13: 'K', 14: 'A'};
const BIG_TEN = 2 * 13 + 8, LITTLE_TWO = 3 * 13;
const CARD_CR = 1.6;
const rankOf = id => id % 13 + 2;
const cardName = id => (RANK_LABEL[rankOf(id)] || rankOf(id)) + SUIT_SYM[Math.floor(id / 13)];
const isSpecial = id => id === BIG_TEN || id === LITTLE_TWO;

function cardSrc(id) {
  if (id < 0) return 'skins/french/back.svg';
  return `skins/french/${SUIT_FILE[Math.floor(id / 13)]}_${String(rankOf(id)).padStart(2, '0')}.svg`;
}
function cardImg(id) {
  return `<img src="${cardSrc(id)}" decoding="sync" alt="${id < 0 ? '' : cardName(id)}" draggable="false">`;
}

/** Replace el's content with html, re-using the old <img> nodes for identical images. A fresh <img>
 *  starts out blank until the WebView has fetched and decoded it again, which made every card flash
 *  on each re-render on slower tablets. A reused node keeps its decoded picture. */
function setHTML(el, html) {
  const pool = new Map();
  el.querySelectorAll('img').forEach(im => {
    const k = im.outerHTML;
    if (!pool.has(k)) pool.set(k, []);
    pool.get(k).push(im);
  });
  el.innerHTML = html;
  if (!pool.size) return;
  el.querySelectorAll('img').forEach(im => {
    const old = pool.get(im.outerHTML);
    if (old && old.length) im.replaceWith(old.pop());
  });
}
for (let id = -1; id < 52; id++) { const im = new Image(); im.src = cardSrc(id); }

function store(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch (e) { /* storage unavailable */ }
  return null;
}

function newToken() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

const st = {
  token: (() => { let tk = store('tablic_token'); if (!tk || tk.length < 16) { tk = newToken(); store('tablic_token', tk); } return tk; })(),
  state: null, v: 0, gameId: null,
  viewSeat: 0, revealed: null, handVisible: false,
  sel: null, marked: new Set(), moveSeq: null, busy: false, animating: false,
  lobbyPending: false, popup: null, confirmEnd: false,
};

(function initLang() {
  const saved = store('tablic_lang');
  const nav = (navigator.language || 'en').toLowerCase();
  let guess = 'en';
  if (/^sr-(latn|me)/.test(nav) || /^(hr|bs|sh|cnr)\b/.test(nav)) guess = 'sr_lat';
  else if (/^sr\b/.test(nav) || /^mk\b/.test(nav)) guess = 'sr';
  else if (/^(ru|uk|be)\b/.test(nav)) guess = 'ru';
  else if (/^de\b/.test(nav)) guess = 'de';
  LANG = saved && I18N[saved] ? saved : guess;
  document.documentElement.lang = LANG_TAG[LANG];
})();

// ------------------------------------------------------------------ Bluetooth (Android app only)
// The app exposes window.TablicApp. A guest phone shows this page from its own copy of the app;
// only the API calls travel over Bluetooth to the host.

function bt() {
  try { return window.TablicApp && TablicApp.btInfo ? JSON.parse(TablicApp.btInfo()) : null; } catch (e) { return null; }
}
const BT_TEXTS = ['btNoAdapter', 'btTurnOn', 'btNoPerm', 'btAppSettings', 'btHostFailed', 'btPick', 'btNone',
  'btPair', 'btConnecting', 'btFailed', 'btVersion', 'cancel'];
function sendBtTexts() {
  if (!window.TablicApp || !TablicApp.btTexts) return;
  const o = {};
  BT_TEXTS.forEach(k => { o[k] = t(k); });
  try { TablicApp.btTexts(JSON.stringify(o)); } catch (e) { /* ignore */ }
}
window.btChanged = () => {
  if (st.state && st.state.phase === 'lobby') renderLobby();
  if (st.popup) openPopup(st.popup);
};

// ------------------------------------------------------------------ networking

async function api(action, params = {}) {
  const body = new URLSearchParams(Object.assign({token: st.token}, params));
  try {
    const r = await fetch('/api/' + action, {method: 'POST', body});
    if (r.status === 503) throw new Error('offline');
    const j = await r.json();
    if (!j.ok) toast(errText(j.error));
    return !!j.ok;
  } catch (e) {
    toast(t('connLost'));
    return false;
  }
}

function errText(e) {
  const k = 'err_' + e;
  return I18N.en[k] ? t(k) : t('err_default', {e});
}

async function poll() {
  for (;;) {
    let s;
    try {
      const r = await fetch(`/api/state?token=${encodeURIComponent(st.token)}&since=${st.v}`, {cache: 'no-store'});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      s = await r.json();
      setConn(true);
    } catch (e) {
      setConn(false);
      await sleep(2000);
      continue;
    }
    try { await apply(s); } catch (e) { console.error(e); st.animating = false; }
  }
}

function setConn(ok) {
  const c = $('#conn');
  c.textContent = t('connLost');
  c.hidden = ok;
}

// ------------------------------------------------------------------ state

async function apply(s) {
  const prev = st.state;
  st.state = s;
  st.v = s.v;
  if (s.gameId !== st.gameId) { st.gameId = s.gameId; st.revealed = null; st.sel = null; st.marked.clear(); }
  if (s.phase === 'lobby') {
    st.sel = null;
    closeResult();
    renderLobby();
    return;
  }
  // A new move or a new deal invalidates the current selection.
  const mvKey = s.game ? `${s.game.round}/${s.game.lastMove ? s.game.lastMove.seq : 0}/${s.game.turn}` : null;
  if (mvKey !== st.moveSeq) { st.moveSeq = mvKey; st.sel = null; st.marked.clear(); }
  const comparable = prev && prev.phase !== 'lobby' && prev.gameId === s.gameId && $('#app').dataset.view === 'game';
  await renderGame(comparable ? prev : null, s);
}

function rerender() {
  const s = st.state;
  if (!s) return;
  if (s.phase === 'lobby') { renderLobby(true); return; }
  computeView(s);
  buildGame(s);
  if (s.phase !== 'playing') showResult(s); else closeResult();
  if (st.popup) openPopup(st.popup);
}

function seatName(i) {
  const se = st.state.seats[i];
  if (se.name) return se.name;
  return (se.type === 'bot' ? t('botName') : t('player')) + ' ' + (i + 1);
}
function teamsOn() { return !!st.state.config.teams; }
function teamOf(i) { return teamsOn() ? i % 2 : i; }
function nTeams() { const n = st.state.config.players; return teamsOn() ? 2 : n; }
function teamName(tm) {
  return teamsOn() ? seatName(tm) + ' & ' + seatName(tm + 2) : seatName(tm);
}

// ------------------------------------------------------------------ lobby

function seg(name, opts, cur, disabled) {
  return `<div class="seg" data-cfg="${name}" aria-disabled="${!!disabled}">` +
    opts.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}" ${disabled ? 'disabled' : ''}>${esc(l)}</button>`).join('') +
    '</div>';
}

function langSelect() {
  return `<select class="lang" aria-label="${t('language')}">` +
    Object.keys(LANG_NAMES).map(k => `<option value="${k}" ${k === LANG ? 'selected' : ''}>${LANG_NAMES[k]}</option>`).join('') + '</select>';
}

function lobbyHeader() {
  return `<header>
    <div class="logo"><div class="card special"><img src="${cardSrc(BIG_TEN)}" alt=""></div><div class="card"><img src="${cardSrc(51)}" alt=""></div></div>
    <div class="grow"><h1>${t('title')}</h1><div class="sub">${t('subtitle')}</div></div>
    ${langSelect()}
  </header>`;
}

function playersKey(c) { return c.players === 4 ? (c.teams ? '4t' : '4') : String(c.players); }
function playersLabel(c) { return c.players === 4 ? (c.teams ? t('fourTeams') : t('fourSolo')) : String(c.players); }
function lengthLabel(c) { return c.length === 'long' ? t('longGame') : t('shortGame'); }

function renderLobby(force) {
  const app = $('#app');
  const ae = document.activeElement;
  if (!force && ae && ae.tagName === 'INPUT' && ae.type === 'text' && app.contains(ae)) { st.lobbyPending = true; return; }
  st.lobbyPending = false;
  app.dataset.view = 'lobby';
  setHTML(app, `<div class="lobby">${lobbyHeader()}${st.state.isHost ? hostLobby(st.state) : guestLobby(st.state)}</div>`);
  bindLobby();
}

function hostLobby(s) {
  const c = s.config;
  let seats = '';
  let open = false;
  for (let i = 0; i < c.players; i++) {
    const se = s.seats[i];
    const typeSel = `<select data-seat-type="${i}">` +
      ['local', 'remote', 'bot'].map(k => `<option value="${k}" ${se.type === k ? 'selected' : ''}>${t(k)}</option>`).join('') + '</select>';
    let extra = '';
    if (se.type === 'remote') {
      if (se.taken) extra = `<span class="status ${se.online ? 'ok' : ''}">${esc(seatName(i))} · ${se.online ? t('online') : t('offline')}</span>`;
      else { extra = `<span class="status">${t('waitingRemote')}</span>`; open = true; }
    } else {
      const def = (se.type === 'bot' ? t('botName') : t('player')) + ' ' + (i + 1);
      extra = `<input type="text" maxlength="16" data-seat-name="${i}" value="${esc(se.name)}" placeholder="${esc(def)}">`;
      if (se.type === 'bot') {
        extra += `<select data-seat-bot="${i}">` + ['easy', 'normal', 'hard'].map((k, l) =>
          `<option value="${l}" ${se.bot === l ? 'selected' : ''}>${t(k)}</option>`).join('') + '</select>';
      }
    }
    seats += `<div class="seat"><span class="num" style="background:${TEAM_COL[teamOf(i)]}">${i + 1}</span>${typeSel}${extra}</div>`;
  }
  const anyRemote = s.seats.slice(0, c.players).some(x => x.type === 'remote');
  const b = bt();
  const btBox = !b || !b.avail ? '' : b.hosting
    ? `<div class="bt"><div class="hint">${t('btOnHint', {name: esc(b.name || '?')})}</div><button class="btn small ghost" id="btOff">${t('btOff')}</button></div>`
    : `<div class="bt"><div class="hint">${t('btOffHint')}</div><button class="btn small" id="btOn">${t('btAllow')}</button></div>`;
  const addrs = (s.addresses || []).map(a => {
    const url = `http://${esc(a)}:${s.port}`;
    return `<div class="addr"><span class="url">${url}</span><button class="copy" data-copy="${url}" aria-label="${t('copy')}">` +
      `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>` +
      `<path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2"/></svg>` +
      `<span>${t('copy')}</span></button></div>`;
  }).join('');
  return `
  <div class="box">
    <div class="row"><label>${t('players')}</label>${seg('players', [['2', '2'], ['3', '3'], ['4t', t('fourTeams')], ['4', t('fourSolo')]], playersKey(c))}</div>
    <div class="row"><label>${t('length')}</label>${seg('length', [['short', t('shortGame')], ['long', t('longGame')]], c.length)}</div>
    <div class="hint">${c.length === 'long' ? t('longHint') : t('shortHint')}</div>
  </div>
  <div class="box"><h2>${t('seats')}</h2>${seats}</div>
  ${anyRemote ? `<div class="box">
    <div class="hint">${addrs ? t('joinHint') : t('noNetwork')}</div>
    ${addrs}
    ${btBox}
  </div>` : ''}
  <button class="btn big" id="startBtn" ${open ? 'disabled' : ''}>${open ? t('startNeedsSeats') : t('start')}</button>
  ${b && b.avail ? `<button class="btn ghost big" id="btJoinBtn">${t('btJoin')}</button>` : ''}
  <button class="btn ghost big" id="rulesBtn">${t('rules')}</button>`;
}

function guestLobby(s) {
  const c = s.config;
  const myName = store('tablic_name') || '';
  let seats = '';
  let anyOpen = false;
  let seated = false;
  for (let i = 0; i < c.players; i++) {
    const se = s.seats[i];
    let right;
    if (se.type === 'remote') {
      if (se.you) { right = `<b>${t('you')}</b> <button class="btn small ghost" id="leaveBtn">${t('leave')}</button>`; seated = true; }
      else if (se.taken) right = `<span class="status ok">${esc(seatName(i))}</span>`;
      else { right = `<button class="btn small" data-sit="${i}">${t('sitHere')}</button>`; anyOpen = true; }
    } else {
      right = `<span class="status">${esc(seatName(i))} · ${se.type === 'bot' ? t('bot') : t('hostDevice')}</span>`;
    }
    seats += `<div class="seat"><span class="num" style="background:${TEAM_COL[teamOf(i)]}">${i + 1}</span>${right}</div>`;
  }
  const b = bt();
  const btGuest = b && b.mode === 'guest'
    ? `<div class="box bt"><div class="hint">${t('btGuest', {name: esc(b.peer || '?')})}</div><button class="btn small ghost" id="btLeave">${t('btLeave')}</button></div>`
    : '';
  return `${btGuest}
  <div class="box">
    <div class="row"><label>${t('yourName')}</label><input type="text" id="myName" maxlength="16" value="${esc(myName)}" placeholder="${t('player')}"></div>
  </div>
  <div class="box">
    <div class="row"><label>${t('players')}</label><b>${esc(playersLabel(c))}</b></div>
    <div class="row"><label>${t('length')}</label><b>${esc(lengthLabel(c))}</b></div>
  </div>
  <div class="box"><h2>${t('seats')}</h2>${seats}
    <div class="hint" style="margin-top:8px">${seated ? t('waitingHost') : (anyOpen ? '' : t('noSeats'))}</div>
  </div>
  <button class="btn ghost big" id="rulesBtn">${t('rules')}</button>`;
}

function bindLobby() {
  const app = $('#app');
  $$('.lang', app).forEach(el => el.onchange = () => setLang(el.value));
  $$('.seg[data-cfg] button', app).forEach(b => b.onclick = () => {
    const name = b.parentElement.dataset.cfg, v = b.dataset.v;
    if (name === 'players') api('config', {players: v === '4t' ? '4' : v, teams: v === '4' ? '0' : '1'});
    else api('config', {[name]: v});
  });
  $$('[data-seat-type]', app).forEach(el => el.onchange = () => api('config', {[`seat${el.dataset.seatType}_type`]: el.value}));
  $$('[data-seat-bot]', app).forEach(el => el.onchange = () => api('config', {[`seat${el.dataset.seatBot}_bot`]: el.value}));
  $$('[data-seat-name]', app).forEach(el => {
    el.onchange = () => api('config', {[`seat${el.dataset.seatName}_name`]: el.value});
    el.onkeydown = e => { if (e.key === 'Enter') el.blur(); };
  });
  const my = $('#myName');
  if (my) {
    my.onchange = () => store('tablic_name', my.value.trim());
    my.onkeydown = e => { if (e.key === 'Enter') my.blur(); };
  }
  $$('[data-sit]', app).forEach(b => b.onclick = () => {
    const i = +b.dataset.sit;
    const nm = ($('#myName') && $('#myName').value.trim()) || '';
    store('tablic_name', nm);
    api('join', {seat: i, name: nm || t('player') + ' ' + (i + 1)});
  });
  const lv = $('#leaveBtn');
  if (lv) lv.onclick = () => api('leave');
  const sb = $('#startBtn');
  if (sb) sb.onclick = () => api('start');
  $('#rulesBtn').onclick = () => openPopup('rules');
  const bOn = $('#btOn', app), bOff = $('#btOff', app), bJoin = $('#btJoinBtn', app), bLeave = $('#btLeave', app);
  if (bOn) bOn.onclick = () => { sendBtTexts(); TablicApp.btHost(true); };
  if (bOff) bOff.onclick = () => TablicApp.btHost(false);
  if (bJoin) bJoin.onclick = () => { sendBtTexts(); TablicApp.btJoin(); };
  if (bLeave) bLeave.onclick = () => TablicApp.btLeave();
  $$('[data-copy]', app).forEach(b => b.onclick = () => copyText(b.dataset.copy));
}

document.addEventListener('focusout', () => setTimeout(() => {
  if (st.lobbyPending && st.state && st.state.phase === 'lobby') renderLobby();
}, 60));

// ------------------------------------------------------------------ captures (client side check of the marked cards)

/** True if `ids` is exactly a union of disjoint groups from `groups` (arrays of card ids). */
function exactCover(ids, groups) {
  if (!ids.length) return true;
  const first = ids[0];
  for (const g of groups) {
    if (!g.includes(first) || !g.every(c => ids.includes(c))) continue;
    if (exactCover(ids.filter(c => !g.includes(c)), groups)) return true;
  }
  return false;
}

function cardOpts(c) { return ((st.state.game.options || {})[c]) || {groups: [], best: []}; }
function validCapture(c, ids) {
  if (!ids.length) return true;
  return cardOpts(c).groups.some(gs => exactCover(ids, gs));
}
function candidates(c) {
  const out = new Set();
  cardOpts(c).groups.forEach(gs => gs.forEach(g => g.forEach(x => out.add(x))));
  return out;
}
function markedList() { return st.state.game.table.filter(c => st.marked.has(c)); }

// ------------------------------------------------------------------ game view

function computeView(s) {
  const g = s.game, mine = s.mySeats;
  const hot = mine.length > 1;
  if (s.phase === 'playing' && mine.includes(g.turn)) st.viewSeat = g.turn;
  else if (!mine.includes(st.viewSeat)) st.viewSeat = mine.length ? mine[0] : 0;
  st.handVisible = mine.includes(st.viewSeat) &&
    (!hot || (s.phase === 'playing' && st.revealed === st.viewSeat && g.turn === st.viewSeat));
}

function cardEl(id, cls) {
  return `<div class="card ${cls || ''}${isSpecial(id) ? ' special' : ''}" data-id="${id}">${cardImg(id)}</div>`;
}

/** Copy text: Android app bridge first, then the Clipboard API, then the legacy fallback. */
async function copyText(text) {
  let ok = false;
  try {
    if (window.TablicApp && window.TablicApp.copy) ok = window.TablicApp.copy(text);
    else if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; }
  } catch (e) { ok = false; }
  if (!ok) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;left:0;top:0';
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
  }
  toast(ok ? t('copied') : text);
}
function backEl() { return `<div class="card back">${cardImg(-1)}</div>`; }
function mini(id) { return `<span class="card mini">${cardImg(id)}</span>`; }

function pileHTML(g, tm, own) {
  const tb = g.tablas[tm];
  const eye = own ? `<svg class="eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>` : '';
  return `<div class="pile${own ? ' own' : ''}"${own ? ` id="myPile" title="${esc(t('holdPile'))}"` : ''}><div class="stack"></div>${g.piles[tm]}${tb ? `<span class="tablas" title="${esc(t('tablas'))}">★${tb > 1 ? tb : ''}</span>` : ''}${eye}</div>`;
}

const DEALER_ICON = `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9.5" fill="#e3b23c"/>` +
  `<rect x="4.2" y="4.6" width="7" height="10" rx="1.2" fill="#fff" stroke="#5a3a06" stroke-width="1" transform="rotate(-14 7.7 9.6)"/>` +
  `<rect x="8.6" y="5.2" width="7" height="10" rx="1.2" fill="#fff" stroke="#5a3a06" stroke-width="1" transform="rotate(12 12.1 10.2)"/>` +
  `<path d="M12.1 8.3 l1.5 1.9 -1.5 1.9 -1.5 -1.9z" fill="#cc1f2f"/></svg>`;
function dealerBadge(g, i) {
  return g.dealer === i ? `<span class="dealer" title="${esc(t('dealer'))}" aria-label="${esc(t('dealer'))}">${DEALER_ICON}</span>` : '';
}

/** Hold the own pile to see the captured cards (only ever the viewer's own team pile). */
let pileTimer = 0;
function bindPileHold() {
  const el = $('#myPile');
  if (!el) return;
  el.oncontextmenu = e => e.preventDefault();
  el.onpointerdown = e => {
    e.preventDefault();
    clearTimeout(pileTimer);
    pileTimer = setTimeout(showPileView, 280);
  };
}
const pileOrder = c => Math.floor(c / 13) * 13 + (12 - c % 13); // by suit, Ace first
function showPileView() {
  const s = st.state;
  if (!s || !s.game) return;
  const tm = teamOf(st.viewSeat);
  const cards = ((s.game.myPiles || {})[tm] || []).slice().sort((a, b) => pileOrder(a) - pileOrder(b));
  let pts = 0;
  cards.forEach(c => { pts += c === BIG_TEN ? 2 : c === LITTLE_TWO ? 1 : rankOf(c) >= 10 ? 1 : 0; });
  hidePileView();
  const v = document.createElement('div');
  v.id = 'pileView';
  const tb = s.game.tablas[tm];
  v.innerHTML = `<div class="pv-head">${esc(t('myPile'))} · ${cards.length} ${esc(t('cards'))} · ${pts} ${esc(t('pointsShort'))}${tb ? ` · ★${tb}` : ''}</div>
    <div class="pv-cards">${cards.length ? cards.map(c => `<div class="card${isSpecial(c) ? ' special' : ''}">${cardImg(c)}</div>`).join('') : `<div class="hint">${esc(t('pileEmpty'))}</div>`}</div>
    <div class="hint">${esc(t('releaseToClose'))}</div>`;
  document.body.appendChild(v);
}
function hidePileView() {
  const v = $('#pileView');
  if (v) v.remove();
}
['pointerup', 'pointercancel', 'blur'].forEach(ev => window.addEventListener(ev, () => {
  clearTimeout(pileTimer);
  hidePileView();
}));

function seatBox(s, i) {
  const g = s.game, se = s.seats[i];
  const turn = s.phase === 'playing' && g.turn === i;
  const backs = Array.from({length: g.handCounts[i]}, backEl).join('');
  let badge = '';
  if (se.type === 'bot') badge = `<span class="badge">${t('bot')}</span>`;
  else if (se.type === 'remote' && !se.online) badge = `<span class="badge off">${t('offline')}</span>`;
  return `<div class="opp ${turn ? 'turn' : ''}" data-seat="${i}">
    <div class="name"><span class="dot" style="background:${TEAM_COL[teamOf(i)]}"></span>${esc(seatName(i))}${dealerBadge(g, i)} ${badge}</div>
    <div class="line"><div class="backs">${backs}</div>${pileHTML(g, teamOf(i), false)}</div>
  </div>`;
}

function buildGame(s) {
  const g = s.game, n = s.config.players, me = st.viewSeat, mine = s.mySeats;
  const app = $('#app');
  app.dataset.view = 'game';
  const hot = mine.length > 1;
  const myTurn = s.phase === 'playing' && g.turn === me && st.handVisible;
  const opts = g.options || {};
  if (st.sel && !(myTurn && opts[st.sel.card])) st.sel = null;
  if (!myTurn) st.marked.clear();
  for (const c of Array.from(st.marked)) if (!g.table.includes(c)) st.marked.delete(c);

  let scores = '';
  for (let tm = 0; tm < nTeams(); tm++) {
    scores += `<div class="score"><span class="dot" style="background:${TEAM_COL[tm]}"></span><span>${esc(teamName(tm))}</span><b>${g.totals[tm]}</b></div>`;
  }
  const meta = s.config.length === 'long' ? `${t('round')} ${g.round} · ⚑${s.config.target}` : t('shortGame');
  const top = `<div class="topbar"><div class="scores">${scores}</div>
    <span class="meta">${esc(meta)}</span>
    <button class="iconbtn" id="menuBtn" aria-label="${t('menu')}">☰</button></div>`;

  const opps = [];
  for (let rel = n - 1; rel >= 1; rel--) opps.push((me + rel) % n);

  const marked = markedList();
  const cand = st.sel ? candidates(st.sel.card) : null;
  const tcards = g.table.map(c => {
    let cls = '';
    if (st.marked.has(c)) cls = 'target';
    else if (cand) cls = cand.has(c) ? 'cand' : 'dim';
    return cardEl(c, cls);
  }).join('');

  let status = '';
  if (s.phase === 'playing') {
    if (myTurn) {
      if (st.sel) {
        const c = st.sel.card;
        if (!marked.length) status = `${mini(c)} ${t('toTable')} — ${t('tapAgain')}`;
        else if (validCapture(c, marked)) {
          const tabla = marked.length === g.table.length && !(g.deck === 0 && g.handCounts.every((k, i) => k === (i === me ? 1 : 0)));
          status = `${mini(c)} ${t('takes')} ${marked.map(mini).join('')}${tabla ? ` <b class="gold">${t('tabla')}</b>` : ''} — ${t('tapAgain')}`;
        } else status = `<span class="warn">${esc(t('notASum', {card: cardName(c), v: rankOf(c) === 14 ? '1/11' : valueOf(c)}))}</span>`;
      } else if (marked.length) status = `${marked.map(mini).join('')} — ${t('pickHandCard')}`;
      else status = t('yourTurn');
    } else if (!(hot && mine.includes(g.turn))) {
      status = esc(t('turnOf', {name: seatName(g.turn)}));
    }
  }

  let hand, cover = '';
  const handCount = st.handVisible ? (g.hands[me] || []).length : (g.handCounts[me] || 0);
  if (st.handVisible) {
    hand = (g.hands[me] || []).map(c => cardEl(c, (st.sel && st.sel.card === c ? 'sel ' : '') +
      (myTurn && opts[c] && opts[c].best.length ? 'cap' : ''))).join('');
  } else {
    hand = Array.from({length: handCount}, backEl).join('');
    if (hot && s.phase === 'playing') {
      if (mine.includes(g.turn)) cover = `<div class="cover" id="reveal">${backEl()}<b>${esc(t('tapToShow', {name: seatName(g.turn)}))}</b></div>`;
      else cover = `<div class="cover"><span>${t('hidden')}</span><span class="hint">${esc(t('turnOf', {name: seatName(g.turn)}))}</span></div>`;
    }
  }
  const meTurn = s.phase === 'playing' && g.turn === me;
  const spectator = mine.length === 0 ? ` <span class="badge">${t('spectator')}</span>` : '';
  const canPeek = mine.includes(me) && (!hot || st.handVisible || s.phase !== 'playing');
  const meBox = `<div class="me ${meTurn && st.handVisible ? 'turn' : ''}" data-seat="${me}">
      <div class="line"><div class="name"><span class="dot" style="background:${TEAM_COL[teamOf(me)]}"></span>${esc(seatName(me))}${dealerBadge(g, me)}${spectator}</div>${pileHTML(g, teamOf(me), canPeek)}</div>
      <div id="hand" class="${myTurn ? 'active' : ''}" style="--n:${Math.max(2, handCount)}">${hand}</div>
      ${cover}
    </div>`;

  setHTML(app, `${top}
    <div class="opps">${opps.map(i => seatBox(s, i)).join('')}</div>
    <div class="center${myTurn ? ' active-table' : ''}">
      <div class="deck ${g.deck ? '' : 'empty'}">${backEl()}<div>${g.deck}</div></div>
      <div id="table">${tcards}</div>
    </div>
    <div class="status">${status}</div>
    ${meBox}`);
  fitTable();

  $('#menuBtn').onclick = () => openPopup('menu');
  bindPileHold();
  if (myTurn) {
    $$('#hand .card').forEach(el => el.onclick = () => onCardTap(+el.dataset.id));
    $$('#table .card').forEach(el => el.onclick = () => onTableTap(+el.dataset.id));
  }
  const rv = $('#reveal');
  if (rv) rv.onclick = () => {
    st.revealed = g.turn;
    rerender();
    $$('#hand .card').forEach((el, i) => el.animate(
      [{transform: 'rotateY(90deg)', opacity: .3}, {transform: 'none', opacity: 1}],
      {duration: 260, delay: i * 50, easing: 'ease-out', fill: 'backwards'}));
  };
}

function valueOf(c) { const r = rankOf(c); return r <= 10 ? r : r === 14 ? 1 : r + 1; }

/** Size the table cards so that all of them fit the free area, choosing the best number of rows. */
function fitTable() {
  const tb = $('#table'), center = $('.center'), deck = $('.deck .card');
  if (!tb || !center || !deck) return;
  const n = tb.children.length;
  const cr = center.getBoundingClientRect();
  const dw = deck.getBoundingClientRect().width;
  const base = dw / 0.8, gap = 7;
  const availW = cr.width - 2 * (dw + 18), availH = cr.height - 12;
  let best = {w: 0, k: 1};
  for (let rows = 1; rows <= 6; rows++) {
    const k = Math.max(1, Math.ceil(n / rows));
    const w = Math.min(base, (availW - (k - 1) * gap) / k, (availH - (rows - 1) * gap) / rows / CARD_CR);
    if (w > best.w + 0.5) best = {w, k};
    if (k === 1) break;
  }
  const w = Math.max(18, Math.floor(best.w));
  tb.style.setProperty('--tw', w + 'px');
  tb.style.width = (best.k * w + (best.k - 1) * gap + 1) + 'px';
}
window.addEventListener('resize', () => { if ($('#app').dataset.view === 'game') fitTable(); });

function onCardTap(c) {
  if (st.busy || st.animating) return;
  if (st.sel && st.sel.card === c) {
    const marked = markedList();
    if (validCapture(c, marked)) playCard(c, marked);
    else toast(t('notASum', {card: cardName(c), v: rankOf(c) === 14 ? '1/11' : valueOf(c)}));
    return;
  }
  // Keep cards marked beforehand if this card can take them; otherwise suggest the best capture.
  const marked = markedList();
  if (!(marked.length && validCapture(c, marked))) st.marked = new Set(cardOpts(c).best);
  st.sel = {card: c};
  rerender();
}

function onTableTap(c) {
  if (st.busy || st.animating) return;
  if (st.sel && !candidates(st.sel.card).has(c) && !st.marked.has(c)) {
    toast(t('cannotTake', {card: cardName(st.sel.card)}));
    return;
  }
  if (st.marked.has(c)) st.marked.delete(c); else st.marked.add(c);
  rerender();
}

async function playCard(c, cap) {
  if (st.busy) return;
  st.busy = true;
  st.sel = null;
  st.marked.clear();
  const ok = await api('play', {seat: st.viewSeat, card: c, capture: (cap || []).join(',')});
  st.busy = false;
  if (ok) st.revealed = null;
  else rerender();
}

async function renderGame(prev, s) {
  const g = s.game, pg = prev && prev.game;
  const before = snapshot();
  const mv = g.lastMove;
  const newMove = !!(pg && mv && (!pg.lastMove || pg.lastMove.seq !== mv.seq));
  const newRound = !pg ? !mv : pg.round !== g.round;
  const newDeal = !pg ? !mv : g.dealSeq !== pg.dealSeq;
  computeView(s);
  buildGame(s);
  if (st.popup) openPopup(st.popup);
  const dealing = newDeal && s.phase === 'playing';
  // New hands are already in the DOM; keep them invisible until the deal animation flies them in.
  if (dealing && newMove) dealEls(newRound).forEach(el => { el.style.opacity = '0'; });
  st.animating = true;
  try {
    if (newMove) {
      slideTable(before, mv);
      await animateMove(mv, before, s);
    }
    if (dealing) await animateDeal(newRound);
  } finally {
    st.animating = false;
  }
  if (s.phase !== 'playing') showResult(s); else closeResult();
}

// ------------------------------------------------------------------ animations

function snapshot() {
  const m = sel => {
    const o = {};
    $$(sel).forEach(el => { o[el.dataset.id] = el.getBoundingClientRect(); });
    return o;
  };
  return {hand: m('#hand .card[data-id]'), table: m('#table .card[data-id]')};
}

function rectOf(sel) {
  const el = $(sel);
  return el ? el.getBoundingClientRect() : null;
}

function tableCardWidth() {
  const el = $('#table .card') || $('.deck .card');
  if (!el) return 60;
  const w = el.getBoundingClientRect().width;
  return el.closest('.deck') ? w / 0.8 : w;
}

function cardRectAround(r, w) {
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  w = w || tableCardWidth();
  return {left: cx - w / 2, top: cy - w * CARD_CR / 2, width: w, height: w * CARD_CR};
}

function centerCardRect() {
  return cardRectAround(rectOf('#table') || {left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0});
}

function seatSourceRect(seat) {
  const r = rectOf(`[data-seat="${seat}"] .backs`) || rectOf(`[data-seat="${seat}"] #hand`) || rectOf(`[data-seat="${seat}"]`);
  return r ? cardRectAround(r) : centerCardRect();
}

function pileRect(seat) {
  return rectOf(`[data-seat="${seat}"] .pile .stack`) || rectOf(`[data-seat="${seat}"]`) || centerCardRect();
}

function ghost(id, r) {
  const d = document.createElement('div');
  d.className = 'card flycard' + (isSpecial(id) ? ' special' : '');
  d.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;transform-origin:0 0;`;
  d.innerHTML = cardImg(id);
  d._rect = r;
  d._tf = 'none';
  $('#fx').appendChild(d);
  return d;
}

function flyTo(el, to, dur, delay, fade) {
  const from = el._rect;
  const dx = to.left - from.left, dy = to.top - from.top, sc = to.width / from.width;
  const end = `translate(${dx}px,${dy}px) scale(${sc})`;
  const a = el.animate(
    [{transform: el._tf, opacity: 1}, {transform: end, opacity: fade ? 0.15 : 1}],
    {duration: dur, delay: delay || 0, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards'});
  el._tf = end;
  return new Promise(res => {
    let done = false;
    const fin = () => { if (!done) { done = true; res(); } };
    a.onfinish = fin;
    a.oncancel = fin;
    setTimeout(fin, dur + (delay || 0) + 150);
  });
}

/** Smoothly move table cards that shifted because others were removed/added. */
function slideTable(before, mv) {
  $$('#table .card[data-id]').forEach(el => {
    const id = +el.dataset.id;
    if (id === mv.card) return;
    const old = before.table[id];
    if (!old) return;
    const now = el.getBoundingClientRect();
    const dx = old.left - now.left, dy = old.top - now.top, sc = old.width / now.width;
    if (Math.abs(dx) + Math.abs(dy) < 1 && Math.abs(sc - 1) < 0.01) return;
    el.style.transformOrigin = '0 0';
    el.animate([{transform: `translate(${dx}px,${dy}px) scale(${sc})`}, {transform: 'none'}], {duration: 320, easing: 'ease-out'});
  });
}

/** Where a card thrown on the table would go when the table is no longer rendered: next to the last card. */
function freeTableRect(before) {
  const rs = Object.values(before.table);
  const tb = rectOf('#table');
  if (!rs.length || !tb) return centerCardRect();
  const last = rs.reduce((a, b) => (b.top > a.top + a.height / 2 || (Math.abs(b.top - a.top) < a.height / 2 && b.left > a.left)) ? b : a);
  const r = {left: last.left + last.width * 1.12, top: last.top, width: last.width, height: last.height};
  return r.left + r.width <= tb.right + 1 ? r : centerCardRect();
}

async function animateMove(mv, before, s) {
  const g = s.game;
  const src = before.hand[mv.card] || seatSourceRect(mv.seat);
  let landed = null;
  // On the last play the server already cleared the table, so the leftover cards are no longer
  // in the DOM. Show them as ghosts in their old spots until they are swept to the pile.
  const rest = (mv.sweep || []).filter(c => c !== mv.card)
    .map(c => ghost(c, before.table[c] || centerCardRect()));
  if (!mv.capture.length) {
    const el = $(`#table .card[data-id="${mv.card}"]`);
    const gh = ghost(mv.card, src);
    if (el) el.style.visibility = 'hidden';
    await flyTo(gh, el ? el.getBoundingClientRect() : freeTableRect(before), 420);
    if (el) { el.style.visibility = ''; gh.remove(); } else landed = gh;
  } else {
    const caps = mv.capture.map(c => ghost(c, before.table[c] || centerCardRect()));
    const first = before.table[mv.capture[0]] || centerCardRect();
    const gh = ghost(mv.card, src);
    await flyTo(gh, {left: first.left + first.width * 0.18, top: first.top + first.width * 0.18, width: first.width, height: first.height}, 420);
    caps.forEach(c => c.animate([{filter: 'brightness(1)'}, {filter: 'brightness(1.35)'}, {filter: 'brightness(1)'}], {duration: 300}));
    await sleep(320);
    if (mv.tabla) banner(t('tabla'));
    const pile = pileRect(mv.seat);
    const all = [gh].concat(caps);
    await Promise.all(all.map((x, i) => flyTo(x, pile, 480, i * 40, true)));
    all.forEach(x => x.remove());
  }
  if (mv.sweep && mv.sweep.length) {
    await sleep(250);
    const ghosts = landed ? rest.concat([landed]) : rest;
    const pile = pileRect(g.lastCapturer >= 0 ? g.lastCapturer : mv.seat);
    await Promise.all(ghosts.map((x, i) => flyTo(x, pile, 520, i * 60, true)));
    ghosts.forEach(x => x.remove());
  } else if (landed) {
    landed.remove();
  }
}

/** Cards that the current deal brings in, in dealing order. */
function dealEls(newRound) {
  const groups = [];
  if (newRound) groups.push($$('#table .card'));
  const hands = [$$('#hand .card')].concat($$('.opp .backs').map(b => $$('.card', b)));
  for (let k = 0; k < 6; k++) for (const h of hands) if (h[k]) groups.push([h[k]]);
  return [].concat(...groups);
}

async function animateDeal(newRound) {
  const els = dealEls(newRound);
  const deck = rectOf('.deck .card');
  if (!deck) { els.forEach(el => { el.style.opacity = ''; }); return; }
  const step = els.length > 16 ? 32 : 50;
  const anims = els.map((el, i) => {
    const r = el.getBoundingClientRect();
    const dx = deck.left - r.left, dy = deck.top - r.top, sc = deck.width / r.width;
    el.style.transformOrigin = '0 0';
    el.style.opacity = '';
    const a = el.animate(
      [{transform: `translate(${dx}px,${dy}px) scale(${sc})`, opacity: .4}, {transform: 'none', opacity: 1}],
      {duration: 320, delay: i * step, easing: 'cubic-bezier(.25,.8,.35,1)', fill: 'backwards'});
    return new Promise(res => {
      const fin = () => { el.style.transformOrigin = ''; res(); };
      a.onfinish = fin; a.oncancel = fin;
    });
  });
  await Promise.race([Promise.all(anims), sleep(els.length * step + 800)]);
}

function banner(text) {
  const b = $('#banner');
  b.textContent = text;
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
}

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ------------------------------------------------------------------ result / popups

function showResult(s) {
  const g = s.game, r = g.result;
  if (!r) return;
  let m = $('#resultModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'resultModal';
    m.className = 'modal';
    document.body.appendChild(m);
  }
  const nT = nTeams();
  const cols = Array.from({length: nT}, (_, i) => i);
  const pt = v => v ? ` <span class="pt">+${v}</span>` : '';
  const ptOnly = v => v ? `<span class="pt">+${v}</span>` : '–';
  const rows = [
    [t('cards'), x => x.cards + pt(x.ptMostCards)],
    [t('honours'), x => ptOnly(x.honours)],
    [t('tens'), x => ptOnly(x.tens) + (x.bigTen ? ` <span class="hint">(${cardName(BIG_TEN)})</span>` : '')],
    [cardName(LITTLE_TWO), x => (x.littleTwo ? '✓' : '–') + pt(x.littleTwo ? 1 : 0)],
    [t('tablas'), x => (x.tablas ? '★' + x.tablas : '–') + pt(x.tablas)],
  ];
  const head = `<tr><th></th>${cols.map(i => `<th><span class="dot" style="background:${TEAM_COL[i]}"></span> ${esc(teamName(i))}</th>`).join('')}</tr>`;
  const body = rows.map(([lab, f]) => `<tr><td>${lab}</td>${cols.map(i => `<td>${f(r[i])}</td>`).join('')}</tr>`).join('');
  const long = s.config.length === 'long';
  const sum = `<tr><td>${t('roundPts')}</td>${cols.map(i => `<td class="pt">${r[i].total}</td>`).join('')}</tr>` +
    (long ? `<tr class="tot"><td>${t('total')}</td>${cols.map(i => `<td>${g.totals[i]}</td>`).join('')}</tr>` : '');
  const over = s.phase === 'gameOver';
  let actions;
  if (over) actions = s.isHost ? `<button class="btn big" id="endBtn">${t('backToLobby')}</button>` : `<div class="hint">${t('waitingNext')}</div>`;
  else actions = s.isHost ? `<button class="btn big" id="nextBtn">${t('nextRound')}</button>` : `<div class="hint" style="text-align:center">${t('waitingNext')}</div>`;
  const key = JSON.stringify([s.v, LANG]);
  if (m.dataset.key === key) return;
  m.dataset.key = key;
  const winLine = over ? (g.winner >= 0 ? `🏆 ${esc(t('wins', {name: teamName(g.winner)}))}` : `🤝 ${esc(t('draw'))}`) : '';
  const tieNote = !over && long && Math.max(...g.totals) >= s.config.target ? `<p class="hint">${t('tieAtTarget')}</p>` : '';
  m.innerHTML = `<div class="sheet">
    <h2>${over ? t('gameOver') : t('roundOver', {n: g.round})}</h2>
    ${over ? `<div class="winner">${winLine}</div>` : ''}
    <table class="res">${head}${body}${sum}</table>
    ${tieNote}
    ${actions}
  </div>`;
  const nb = $('#nextBtn', m);
  if (nb) nb.onclick = () => { nb.disabled = true; api('next'); };
  const eb = $('#endBtn', m);
  if (eb) eb.onclick = () => { eb.disabled = true; api('end'); };
}

function closeResult() {
  const m = $('#resultModal');
  if (m) m.remove();
}

function openPopup(kind) {
  st.popup = kind;
  let p = $('#popup');
  if (!p) {
    p = document.createElement('div');
    p.id = 'popup';
    p.className = 'modal';
    p.style.zIndex = 55;
    p.onclick = e => { if (e.target === p) closePopup(); };
    document.body.appendChild(p);
  }
  const s = st.state;
  let html = '';
  if (kind === 'rules') {
    html = `<h2>${t('rules')}</h2>${t('rulesHtml')}`;
  } else {
    html = `<h2>${t('menu')}</h2>
      <div class="row"><label>${t('language')}</label>${langSelect()}</div>
      <button class="btn ghost menu-item" id="mRules">${t('rules')}</button>`;
    const b = bt();
    if (b && b.mode === 'guest') html += `<button class="btn ghost menu-item" id="mBtLeave">${t('btLeave')}</button>`;
    if (s && s.isHost && s.phase !== 'lobby') {
      html += `<h3>${t('seats')}</h3>`;
      for (let i = 0; i < s.config.players; i++) {
        const se = s.seats[i];
        const btn = se.type === 'bot'
          ? `<button class="btn small ghost" data-seatset="${i}" data-type="local">${t('playHere')}</button>`
          : `<button class="btn small ghost" data-seatset="${i}" data-type="bot">${t('takeOver')}</button>`;
        const stx = se.type === 'remote' ? (se.online ? t('online') : t('offline')) : t(se.type);
        html += `<div class="seat"><span class="num" style="background:${TEAM_COL[teamOf(i)]}">${i + 1}</span><span style="flex:1">${esc(seatName(i))} <span class="status">· ${stx}</span></span>${btn}</div>`;
      }
      html += `<button class="btn ghost menu-item" id="mEnd" style="${st.confirmEnd ? 'background:var(--red)' : ''}">${st.confirmEnd ? t('confirmEnd') : t('endGame')}</button>`;
    }
  }
  html += `<button class="btn big" id="mClose">${t('close')}</button>`;
  p.innerHTML = `<div class="sheet">${html}</div>`;
  $('#mClose', p).onclick = closePopup;
  const lg = $('.lang', p);
  if (lg) lg.onchange = () => setLang(lg.value);
  const mr = $('#mRules', p);
  if (mr) mr.onclick = () => openPopup('rules');
  const ml = $('#mBtLeave', p);
  if (ml) ml.onclick = () => { closePopup(); TablicApp.btLeave(); };
  $$('[data-seatset]', p).forEach(b => b.onclick = () => api('seat', {seat: b.dataset.seatset, type: b.dataset.type}));
  const me = $('#mEnd', p);
  if (me) me.onclick = () => {
    if (!st.confirmEnd) { st.confirmEnd = true; openPopup('menu'); return; }
    st.confirmEnd = false;
    closePopup();
    api('end');
  };
}

function closePopup() {
  st.popup = null;
  st.confirmEnd = false;
  const p = $('#popup');
  if (p) p.remove();
}

function setLang(l) {
  LANG = I18N[l] ? l : 'en';
  $('#rotate').textContent = t('rotate');
  store('tablic_lang', LANG);
  sendBtTexts();
  document.documentElement.lang = LANG_TAG[LANG];
  document.title = t('title');
  const m = $('#resultModal');
  if (m) m.dataset.key = '';
  rerender();
  if (st.popup) openPopup(st.popup);
}

// ------------------------------------------------------------------ boot

sendBtTexts();
$('#rotate').textContent = t('rotate');
document.title = t('title');
$('#app').innerHTML = `<div class="lobby"><header><h1>${t('title')}</h1></header></div>`;
poll();
