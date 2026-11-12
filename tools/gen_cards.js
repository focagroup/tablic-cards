'use strict';
/*
 * Writes the French 52-card deck used by Tablić, plus the app icon sources.
 *
 *   skins/french/<suit>_<rank>.svg   suit = spades | hearts | diamonds | clubs
 *                                    rank = 02..10, 11 (J), 12 (Q), 13 (K), 14 (A)
 *   skins/french/back.svg
 *   tools/icon/icon.svg, icon_fg.svg, icon_bg.svg   (rasterized by tools/make_icon.sh)
 *
 * Usage: node tools/gen_cards.js   (run from the project root)
 */
const fs = require('fs');
const path = require('path');

const SUIT_FILE = ['spades', 'hearts', 'diamonds', 'clubs'];
const W = 100, H = 160;
const RED = '#cc1f2f', BLACK = '#151515', BLUE = '#1f4fa3', YEL = '#f2c230', SKIN = '#f6d7b5';
const COL = [BLACK, RED, RED, BLACK];
const IDX = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']; // index 0..12 = rank 2..14

function write(file, svg) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, svg.replace(/\n\s+/g, '\n').trim() + '\n');
}
const svgOpen = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}">`;
const use = (id, x, y, s, rot) =>
  `<use href="#${id}" xlink:href="#${id}" transform="translate(${x},${y}) scale(${s})${rot ? ' rotate(' + rot + ')' : ''}"/>`;

/* Suit symbols in a box of roughly -11..11: 0 spade, 1 heart, 2 diamond, 3 club. */
const SYM = `
  <path id="s0" d="M0,-10.5 C-6,-5.5 -10.5,-1.5 -10.5,2.8 C-10.5,6.3 -8,8 -5.3,8 C-3.3,8 -1.6,7 -0.7,5.6 C-0.9,8 -2,9.8 -3.6,11 L3.6,11 C2,9.8 0.9,8 0.7,5.6 C1.6,7 3.3,8 5.3,8 C8,8 10.5,6.3 10.5,2.8 C10.5,-1.5 6,-5.5 0,-10.5Z" fill="${BLACK}"/>
  <path id="s1" d="M0,9.5 C-6,4.5 -10.5,0.5 -10.5,-4.5 C-10.5,-8.2 -7.8,-10.5 -5,-10.5 C-2.6,-10.5 -0.9,-9 0,-6.8 C0.9,-9 2.6,-10.5 5,-10.5 C7.8,-10.5 10.5,-8.2 10.5,-4.5 C10.5,0.5 6,4.5 0,9.5Z" fill="${RED}"/>
  <path id="s2" d="M0,-11 Q3.2,-4.5 8,0 Q3.2,4.5 0,11 Q-3.2,4.5 -8,0 Q-3.2,-4.5 0,-11Z" fill="${RED}"/>
  <g id="s3" fill="${BLACK}"><circle cx="0" cy="-5.6" r="4.7"/><circle cx="-5.3" cy="1.6" r="4.7"/><circle cx="5.3" cy="1.6" r="4.7"/>
    <path d="M-1.6,-1 L1.6,-1 L1.6,1 C1.2,6 2.2,9 3.8,11 L-3.8,11 C-2.2,9 -1.2,6 -1.6,1Z"/><circle cx="0" cy="0" r="2.6"/></g>`;

/* Pip positions [x, y] for ranks 2..10; pips below the middle are drawn upside down. */
const L = 30, C = 50, R = 70, T = 33, B = 127, M = 80;
const PIPS = {
  2: [[C, T], [C, B]],
  3: [[C, T], [C, M], [C, B]],
  4: [[L, T], [R, T], [L, B], [R, B]],
  5: [[L, T], [R, T], [C, M], [L, B], [R, B]],
  6: [[L, T], [R, T], [L, M], [R, M], [L, B], [R, B]],
  7: [[L, T], [R, T], [C, 56.5], [L, M], [R, M], [L, B], [R, B]],
  8: [[L, T], [R, T], [C, 56.5], [L, M], [R, M], [C, 103.5], [L, B], [R, B]],
  9: [[L, T], [R, T], [L, 64.3], [R, 64.3], [C, M], [L, 95.7], [R, 95.7], [L, B], [R, B]],
  10: [[L, T], [R, T], [C, 48.7], [L, 64.3], [R, 64.3], [L, 95.7], [R, 95.7], [C, 111.3], [L, B], [R, B]],
};

function index(s, r) {
  const txt = IDX[r - 2];
  const one = `<text x="10" y="17" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="bold" ` +
    `font-size="${txt.length > 1 ? 11.5 : 13.5}" letter-spacing="${txt.length > 1 ? -1 : 0}" fill="${COL[s]}">${txt}</text>${use('s' + s, 10, 25.5, 0.44)}`;
  return one + `<g transform="rotate(180 50 80)">${one}</g>`;
}

/** Upper half of a double-ended court card (bust), drawn in the box 18..82 x 26..80. kind: J, Q, K. */
function bust(s, kind) {
  const red = COL[s] === RED;
  const robeA = red ? RED : BLUE, robeB = red ? BLUE : RED;
  let g = '';
  g += `<path d="M22,80 L24,66 Q28,58 40,56 L60,56 Q72,58 76,66 L78,80Z" fill="${robeA}" stroke="${BLACK}" stroke-width=".9"/>`;
  g += `<path d="M40,56 L50,80 L60,56Z" fill="${YEL}" stroke="${BLACK}" stroke-width=".8"/>`;
  g += `<path d="M44,56 L50,72 L56,56" fill="none" stroke="${robeB}" stroke-width="1.6"/>`;
  g += `<path d="M24,66 Q30,70 36,66 M64,66 Q70,70 76,66" fill="none" stroke="${YEL}" stroke-width="1.4"/>`;
  for (let x = 27; x < 76; x += 7) if (x < 40 || x > 60) g += `<circle cx="${x}" cy="74" r="1.1" fill="${YEL}"/>`;
  g += `<rect x="46.5" y="49" width="7" height="8" fill="${SKIN}" stroke="${BLACK}" stroke-width=".7"/>`;
  const hair = kind === 'Q' ? YEL : kind === 'K' ? '#8a5a2b' : '#6b3e17';
  if (kind === 'Q') g += `<path d="M39,44 Q37,30 50,29 Q63,30 61,44 L63,56 Q57,52 56,46 L44,46 Q43,52 37,56Z" fill="${hair}" stroke="${BLACK}" stroke-width=".7"/>`;
  g += `<ellipse cx="50" cy="42" rx="7.4" ry="8.6" fill="${SKIN}" stroke="${BLACK}" stroke-width=".9"/>`;
  g += `<circle cx="47.3" cy="41" r=".9" fill="${BLACK}"/><circle cx="52.7" cy="41" r=".9" fill="${BLACK}"/>`;
  g += `<path d="M46,38.6 q1.3,-.9 2.6,0 M51.4,38.6 q1.3,-.9 2.6,0" fill="none" stroke="${BLACK}" stroke-width=".6"/>`;
  g += `<path d="M50,41.5 l-.8,3 h1.5" fill="none" stroke="#b07a52" stroke-width=".7"/>`;
  g += `<path d="M48,47.2 Q50,48.4 52,47.2" fill="none" stroke="${RED}" stroke-width=".9"/>`;
  if (kind === 'K') {
    g += `<path d="M43,45 Q44,55 50,57 Q56,55 57,45 Q53,48.5 50,48 Q47,48.5 43,45Z" fill="${hair}" stroke="${BLACK}" stroke-width=".6"/>`;
    g += `<path d="M41.5,35 L41,24 L45,29 L50,22 L55,29 L59,24 L58.5,35Z" fill="${YEL}" stroke="${BLACK}" stroke-width=".9"/>`;
    g += `<rect x="41.3" y="33" width="17.4" height="3" fill="${robeB}" stroke="${BLACK}" stroke-width=".6"/>`;
    g += `<circle cx="50" cy="29.5" r="1.3" fill="${robeA}"/>`;
    // sword
    g += `<path d="M70,80 L70,46" stroke="#c9ccd1" stroke-width="2.2"/><path d="M65,62 H75" stroke="${YEL}" stroke-width="2"/>`;
  } else if (kind === 'Q') {
    g += `<path d="M42,34 Q50,27 58,34 L56.5,30 L53,32 L50,27 L47,32 L43.5,30Z" fill="${YEL}" stroke="${BLACK}" stroke-width=".8"/>`;
    g += `<circle cx="50" cy="29" r="1" fill="${robeB}"/>`;
    g += `<path d="M64,72 L68,52" stroke="#2f7a3b" stroke-width="1.2"/><circle cx="68" cy="50" r="3" fill="${RED}" stroke="${BLACK}" stroke-width=".6"/><circle cx="68" cy="50" r="1" fill="${YEL}"/>`;
  } else {
    g += `<path d="M42,38 Q40,28 50,28 Q60,28 58,38 L56,35 L44,35Z" fill="${hair}" stroke="${BLACK}" stroke-width=".6"/>`;
    g += `<path d="M38,35 Q50,24 62,35 Q50,32 38,35Z" fill="${robeB}" stroke="${BLACK}" stroke-width=".9"/>`;
    g += `<path d="M58,31 Q68,22 66,14 Q63,22 56,29Z" fill="${YEL}" stroke="${BLACK}" stroke-width=".7"/>`;
    g += `<path d="M30,80 L30,40" stroke="#8a5a2b" stroke-width="1.6"/><path d="M30,40 l-4,6 h8z" fill="#c9ccd1" stroke="${BLACK}" stroke-width=".6"/>`;
  }
  g += use('s' + s, 26.5, 34, 0.62);
  return g;
}

function cardBody(s, r) {
  if (r <= 10) {
    const sc = r <= 3 ? 1.12 : r >= 9 ? 0.92 : 1.0;
    return PIPS[r].map(([x, y]) => use('s' + s, x, y, sc, y > M ? 180 : 0)).join('');
  }
  if (r <= 13) {
    const k = 'JQK'[r - 11];
    const half = `<g clip-path="url(#half)"><g transform="translate(50,80) scale(.84) translate(-50,-80)">${bust(s, k)}</g></g>`;
    return `<rect x="18" y="26" width="64" height="108" rx="2" fill="#fffdf6" stroke="${COL[s]}" stroke-width="1"/>
      <clipPath id="half"><rect x="18" y="26" width="64" height="54"/></clipPath>
      ${half}<g transform="rotate(180 50 80)">${half}</g>
      <path d="M18,80 H82" stroke="${COL[s]}" stroke-width=".8"/>`;
  }
  // ace
  let b = use('s' + s, 50, 80, s === 0 ? 3.3 : 3.0);
  if (s === 0) b += `<circle cx="50" cy="80" r="44" fill="none" stroke="${BLACK}" stroke-width=".8" stroke-dasharray="2 2.4"/>`;
  return b;
}

function card(s, r) {
  return `${svgOpen}<defs>${SYM}</defs>
    <rect x=".8" y=".8" width="98.4" height="158.4" rx="6.5" fill="#fffef9" stroke="#2a2a2a" stroke-width="1.6"/>
    ${cardBody(s, r)}${index(s, r)}</svg>`;
}

function back() {
  return `${svgOpen}<defs><pattern id="pb" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#a3192a"/><path d="M4,0 L8,4 L4,8 L0,4Z" fill="none" stroke="#f0a7ae" stroke-width=".7"/>
      <circle cx="4" cy="4" r=".8" fill="#ffffff"/></pattern></defs>
    <rect x=".8" y=".8" width="98.4" height="158.4" rx="6.5" fill="#ffffff" stroke="#2a2a2a" stroke-width="1.6"/>
    <rect x="6" y="6" width="88" height="148" rx="3" fill="url(#pb)"/>
    <rect x="6" y="6" width="88" height="148" rx="3" fill="none" stroke="#5c0d16" stroke-width="1.2"/>
    <circle cx="50" cy="80" r="15" fill="#fffef9" stroke="#5c0d16" stroke-width="1.2"/>
    <text x="50" y="86.5" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="bold" font-size="18" fill="#a3192a">T</text>
  </svg>`;
}

const out = 'skins/french';
for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++)
  write(path.join(out, `${SUIT_FILE[s]}_${String(r).padStart(2, '0')}.svg`), card(s, r));
write(path.join(out, 'back.svg'), back());

// ------------------------------------------------------------------ app icon sources
// Same layout as the Scopa icon: two cards side by side, slightly fanned (±8°), the right one on top,
// each with a soft drop shadow cast down-right in screen space. Left: 2 of clubs, right: 10 of diamonds.
const inner = svg => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
function fannedCards(cx, cy, w) {
  const h = w * 1.6, gap = w * 20 / 34; // same overlap as the Scopa icon
  const filter = `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%">` +
    `<feDropShadow dx="${(w / 60).toFixed(2)}" dy="${(w / 30).toFixed(2)}" stdDeviation="${(w / 40).toFixed(2)}" flood-opacity=".55"/></filter>`;
  const one = (svg, rot, dx) =>
    `<g filter="url(#sh)"><g transform="translate(${cx + dx},${cy}) rotate(${rot})">` +
    `<svg x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" viewBox="0 0 100 160">${inner(svg)}</svg></g></g>`;
  return `<defs>${filter}</defs>` + one(card(3, 2), -8, -gap / 2) + one(card(2, 10), 8, gap / 2);
}
const felt = `<radialGradient id="felt" cx="50%" cy="42%" r="72%"><stop offset="0" stop-color="#1a5590"/><stop offset=".6" stop-color="#0f3d66"/><stop offset="1" stop-color="#0a2847"/></radialGradient>`;
const iconOpen = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024" viewBox="0 0 1024 1024">`;
write('tools/icon/icon_bg.svg', `${iconOpen}<defs>${felt}</defs><rect width="1024" height="1024" fill="url(#felt)"/></svg>`);
// adaptive foreground: keep the cards inside the 66/108 safe zone (same card size as Scopa's foreground)
write('tools/icon/icon_fg.svg', `${iconOpen}${fannedCards(512, 512, 280)}</svg>`);
write('tools/icon/icon.svg', `${iconOpen}<defs>${felt}<clipPath id="rr"><rect width="1024" height="1024" rx="205"/></clipPath></defs>
  <g clip-path="url(#rr)"><rect width="1024" height="1024" fill="url(#felt)"/>${fannedCards(512, 512, 400)}</g></svg>`);
console.log('wrote', out, 'and tools/icon/');
