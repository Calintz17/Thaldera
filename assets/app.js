/* Thaldera Codex v2
   Carte persistante, zoom en entonnoir (monde > continent > region > ville > lieu > personnage),
   fiches liees automatiquement, recherche. Aucune dependance, aucune etape de build. */
(() => {
'use strict';

const VER = '16';
const EDIT = new URLSearchParams(location.search).has('edit');
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ');
const wait = ms => new Promise(r => setTimeout(r, ms));

const TYPES = {
  continent: 'Continent', region: 'Région', faction: 'Faction', ville: 'Ville', lieu: 'Lieu',
  pnj: 'Personnage', pj: 'Joueur', clan: 'Clan', organisation: 'Organisation', evenement: 'Événement', sujet: 'Savoir'
};
const KID_GROUPS = [
  ['region', 'Régions'], ['faction', 'Factions'], ['ville', 'Villes'], ['lieu', 'Lieux'],
  ['clan', 'Clans'], ['organisation', 'Organisations'], ['pnj', 'Personnages'], ['evenement', 'Événements'], ['sujet', 'Savoirs']
];
const ACCENTS = { dominion: '#c44510', altera: '#4a8fd9', consortium: '#c9a84c', istra: '#d96a28', agran: '#1e4f9c' };

let DB = [], BY = {}, KIDS = {};
let RX = null, LOOK = {};

/* ---------- donnees ---------- */
async function load() {
  const idx = await (await fetch('data/index.json?v=' + VER)).json();
  const parts = await Promise.all(idx.fichiers.map(f => fetch('data/' + f + '?v=' + VER).then(r => r.json())));
  DB = parts.flat();
  DB.forEach(e => { BY[e.id] = e; });
  DB.forEach(e => { if (e.parent && BY[e.parent]) (KIDS[e.parent] ||= []).push(e); });
  Object.values(KIDS).forEach(a => a.sort((x, y) => (x.ordre ?? 99) - (y.ordre ?? 99)));
  buildLinker();
}

const kids = (id, type) => (KIDS[id] || []).filter(k => !type || k.type === type);
const chain = e => { const a = []; let c = e; let g = 0; while (c && g++ < 12) { a.unshift(c); c = c.parent ? BY[c.parent] : null; } return a; };
const isAnc = (a, e) => { let c = e; let g = 0; while (c && g++ < 12) { if (c === a) return true; c = c.parent ? BY[c.parent] : null; } return false; };
const continentOf = e => chain(e).find(x => x.type === 'continent');

/* ---------- liens automatiques ---------- */
const ACC = { a: 'aàâä', e: 'eéèêë', i: 'iîï', o: 'oôö', u: 'uùûü', c: 'cç', y: 'yÿ' };
function pat(s) {
  let o = '';
  [...s].forEach((ch, i) => {
    if (ch === ' ') { o += '\\s+'; return; }
    if (ch === "'" || ch === '’') { o += "['’]"; return; }
    const low = ch.toLowerCase();
    const base = low.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const isUp = ch !== low;
    const set = ACC[base];
    if (set) {
      let chars = isUp ? set.toUpperCase() : set;
      if (i === 0 && !isUp) chars = set + set.toUpperCase();
      o += '[' + chars + ']';
    } else if (i === 0 && !isUp && /[a-z]/.test(base)) {
      o += '[' + ch + ch.toUpperCase() + ']';
    } else o += ch.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  });
  return o;
}
function buildLinker() {
  const names = [];
  const seen = {};
  const add = (n, id) => {
    if (!n || n.length < 3) return;
    const k = norm(n);
    if (seen[k]) return;
    seen[k] = id; LOOK[k] = id; names.push(n);
  };
  DB.forEach(e => add(e.nom, e.id));
  DB.forEach(e => (e.alias || []).forEach(a => add(a, e.id)));
  names.sort((a, b) => b.length - a.length);
  RX = new RegExp('(?<![\\p{L}\\p{N}])(?:' + names.map(pat).join('|') + ')(?![\\p{L}\\p{N}])', 'gu');
}
function L(text, selfId) {
  if (!text) return '';
  if (!RX) return esc(text);
  let out = '', last = 0, m;
  RX.lastIndex = 0;
  while ((m = RX.exec(text))) {
    const id = LOOK[norm(m[0])];
    if (!id || id === selfId) continue;
    const e = BY[id];
    out += esc(text.slice(last, m.index));
    out += `<a class="ln t-${e.type}" href="#/${id}" title="${esc(e.resume || e.titre || e.nom)}">${esc(m[0])}</a>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

/* ---------- images ---------- */
const IMG = {};
function imgInfo(src) {
  return IMG[src] ||= new Promise(res => {
    const i = new Image();
    i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = () => res({ w: 1600, h: 1200 });
    i.src = mapSrc(src);
  });
}

/* ---------- scene (carte persistante) ---------- */
const sceneEl = $('#scene'), stageEl = $('#stage'), panelEl = $('#panel'), worldEl = $('#world');
const PH_LAND = { img: 'img/placeholder/paysage.svg', legende: '', ph: true };
const PH_SIL = 'img/placeholder/silhouette.svg';
const S = { map: null, gal: null, entry: null, key: '', cut: null, W: 0, H: 0 };

const SMALLMAP = matchMedia('(max-width: 860px), (pointer: coarse)').matches;
const mapSrc = u => SMALLMAP && /^img\/cartes\/(istra|thaldera|thaldera-factions)\.webp$/.test(u) ? u.replace('.webp', '-m.webp') : u;
function syncTop() { const t = document.querySelector('.top'); if (t) document.documentElement.style.setProperty('--top-h', t.offsetHeight + 'px'); }
window.addEventListener('resize', syncTop); window.addEventListener('orientationchange', syncTop); window.addEventListener('load', syncTop);
function measure() { syncTop(); S.W = stageEl.clientWidth; S.H = stageEl.clientHeight; }
function camFor(rect, info, pad = 0.94) {
  const s = Math.min(S.W / (rect.w * info.w), S.H / (rect.h * info.h)) * pad;
  return {
    s,
    tx: S.W / 2 - (rect.x + rect.w / 2) * info.w * s,
    ty: S.H / 2 - (rect.y + rect.h / 2) * info.h * s
  };
}
function setCam(layer, rect, animate, pad) {
  measure();
  const c = camFor(rect, layer.info, pad);
  layer.rect = rect; layer.pad = pad;
  const el = layer.cam;
  if (!animate) el.classList.add('notrans');
  el.style.setProperty('--s', c.s);
  el.style.transform = `translate(${c.tx}px, ${c.ty}px) scale(${c.s})`;
  if (!animate) { void el.offsetWidth; el.classList.remove('notrans'); }
}
const FULL = { x: 0, y: 0, w: 1, h: 1 };
const around = (p, w = 0.14) => ({ x: p.x - w / 2, y: p.y - w / 2, w, h: w });

function ensureChrome() {
  if ($('.fog', stageEl)) return;
  stageEl.insertAdjacentHTML('beforeend', '<div class="fog"></div><div class="mapcap" id="mapcap"></div><button class="upbtn" id="upbtn" hidden>‹ Vue précédente</button>');
  $('#upbtn').addEventListener('click', () => { if (S.entry) goUp(S.entry); });
  if (EDIT) initEdit();
}

function ownerMap(e) {
  // carte sur laquelle l'entree est positionnee
  if (!e) return null;
  const p = e.parent ? BY[e.parent] : null;
  if (!p) return null;
  if (e.type === 'lieu' || e.type === 'pnj') {
    // lieu : sur la carte de la ville parente
    let v = p;
    while (v && !(v.cartes && v.cartes.length) && v.parent) v = BY[v.parent];
    return v && v.cartes ? { host: v, carte: (v.cartes.find(c => c.id === e.carte) || v.cartes[0]) } : null;
  }
  let c = p;
  while (c && !(c.cartes && c.cartes.length)) c = c.parent ? BY[c.parent] : null;
  return c ? { host: c, carte: (c.cartes.find(k => k.id === e.carte) || c.cartes[0]) } : null;
}

/* description de la scene voulue pour une entree */
function sceneOf(e, q, depth = 0) {
  if (!e || depth > 6) return null;
  const tab = Math.max(0, parseInt(q?.get('c') || '0', 10) || 0);
  switch (e.type) {
    case 'continent': {
      const c = e.cartes[Math.min(tab, e.cartes.length - 1)];
      return {
        kind: 'map', src: c.img, cam: FULL, owner: e, tabs: e.cartes, tab: Math.min(tab, e.cartes.length - 1),
        frames: kids(e.id).filter(k => k.poly).map(k => frameOf(k)),
        pins: kids(e.id).filter(k => k.pos && k.type === 'ville').map(k => ({ id: k.id, ...k.pos, label: k.nom, kind: 'ville' }))
      };
    }
    case 'region':
    case 'faction': {
      const om = ownerMap(e);
      if (!om) return depth === 0 ? sceneOf(BY[e.parent], null, depth + 1) : null;
      const z = e.zone;
      const cam = z ? { x: z.x - z.w * 0.06, y: z.y - z.h * 0.06, w: z.w * 1.12, h: z.h * 1.12 } : FULL;
      const villes = collectVilles(e);
      return {
        kind: 'map', src: om.carte.img, cam, owner: om.host, tabs: om.host.cartes, tab: om.host.cartes.indexOf(om.carte),
        frames: e.poly ? [frameOf(e, true)] : [], pins: villes.map(v => ({ id: v.id, ...v.pos, label: v.nom, kind: 'ville' })),
        focus: z ? { x: z.x + z.w / 2, y: z.y + z.h / 2 } : null
      };
    }
    case 'ville': {
      const cs = e.cartes || [];
      if (!cs.length) {
        const ps = sceneOf(BY[e.parent], null, depth + 1);
        if (ps && depth === 0 && ps.kind === 'map' && e.galerie && e.galerie.length) return { ...ps, gallery: e.galerie };
        return ps;
      }
      const t = Math.min(tab, cs.length - 1);
      if (cs.length > 1) return stackScene(e, null);
      const lieux = collectLieux(e);
      return {
        kind: 'map', src: cs[t].img, cam: FULL, owner: e, tabs: cs, tab: t,
        frames: [], pins: lieux.filter(l => (l.carte || cs[0].id) === cs[t].id && l.pos).map(l => ({ id: l.id, ...l.pos, label: l.nom, kind: 'lieu' }))
      };
    }
    case 'lieu': {
      const om = ownerMap(e);
      if (!om) {
        const ps = sceneOf(BY[e.parent], null, depth + 1);
        if (ps && depth === 0 && ps.kind === 'map') return { ...ps, gallery: (e.galerie && e.galerie.length) ? e.galerie : (ps.gallery || [PH_LAND]) };
        return ps;
      }
      const host = om.host, cs = host.cartes;
      if (cs.length > 1) {
        const st = stackScene(host, e);
        if (e.galerie && e.galerie.length) st.gallery = e.galerie;
        return st;
      }
      const base = {
        kind: 'map', src: om.carte.img, cam: e.pos ? around(e.pos, Math.max(e.zoom || 0.2, 0.18)) : FULL, owner: host, tabs: cs, tab: cs.indexOf(om.carte),
        frames: [],
        pins: collectLieux(host).filter(l => (l.carte || cs[0].id) === om.carte.id && l.pos).map(l => ({ id: l.id, ...l.pos, label: l.nom, kind: 'lieu', dim: l.id !== e.id, here: l.id === e.id }))
      };
      if (e.galerie && e.galerie.length) base.gallery = e.galerie;
      return base;
    }
    default: {
      const lieu = e.lieu ? BY[e.lieu] : null;
      let s = lieu ? sceneOf(lieu, null, depth + 1) : (e.parent ? sceneOf(BY[e.parent], null, depth + 1) : null);
      if (!s && depth === 0) s = sceneOf(BY.istra, null, 1);
      if (s && (e.type === 'pnj' || e.type === 'pj') && depth === 0) {
        let gal = (e.galerie && e.galerie.length) ? e.galerie : (s.gallery || fallbackLand(e) || [PH_LAND]);
        if (e.formes && e.formes.length > 1) {
          const bg = (f, d) => f.fond ? { img: f.fond, legende: '' } : d;
          gal = gal.map(g => ({ ...bg(e.formes[0], g), cut: e.formes[0] })).concat(e.formes.slice(1).map(f => ({ ...bg(f, gal[0]), cut: f })));
        }
        s = { ...s, gallery: gal, cutout: e };
      }
      return s;
    }
  }
}
function stackScene(host, focus) {
  const cs = host.cartes, lieux = collectLieux(host);
  const idx = focus ? Math.max(0, cs.findIndex(c => c.id === (focus.carte || cs[0].id))) : 0;
  const sheets = cs.map(c => ({
    carte: c,
    pins: lieux.filter(l => (l.carte || cs[0].id) === c.id && l.pos).map(l => ({ id: l.id, ...l.pos, label: l.nom, kind: 'lieu', dim: !!focus && l.id !== focus.id, here: !!focus && l.id === focus.id }))
  }));
  return { kind: 'stack', src: 'stack:' + host.id, owner: host, tabs: cs, tab: idx, sheets, pins: sheets.flatMap((sh, i) => sh.pins.map(p => ({ ...p, sheet: i }))), frames: [], focus: focus ? focus.id : null, focusSheet: idx, focusPos: focus && focus.pos ? focus.pos : null };
}
function fallbackLand(e) {
  // paysage de repli : lieu, puis rue de la ville
  const chainUp = [];
  if (e.lieu && BY[e.lieu]) chainUp.push(...chain(BY[e.lieu]).reverse());
  chainUp.push(...chain(e).reverse().slice(1));
  for (const x of chainUp) if (x.galerie && x.galerie.length) return x.type === 'ville' ? [x.galerie[0]] : x.galerie;
  return null;
}
function frameOf(k, solo) {
  return { id: k.id, poly: k.poly, color: k.couleur || k.accent || '#d9402f', lab: k.lab, label: k.nom, sub: k.titre, solo: !!solo };
}
function collectVilles(e) {
  const out = [];
  const walk = x => kids(x.id).forEach(k => { if (k.type === 'ville' && k.pos) out.push(k); else if (k.type === 'region') walk(k); });
  walk(e);
  return out;
}
function collectLieux(v) {
  const out = [];
  const walk = x => kids(x.id).forEach(k => { if (k.type === 'lieu') { out.push(k); walk(k); } });
  walk(v);
  return out;
}

function sceneKey(sc) {
  if (!sc) return 'none';
  return JSON.stringify([sc.src, sc.cam, sc.frames.map(f => f.id + (f.solo ? 's' : '')), sc.pins.map(p => p.id + (p.dim ? 'd' : '') + (p.here ? 'h' : '')), sc.gallery?.map(g => g.img + (g.cut ? g.cut.img : '')), sc.cutout?.id, sc.tab, sc.focus]);
}

function makeLayer(src, info) {
  const layer = document.createElement('div');
  layer.className = 'layer';
  layer.innerHTML = `<div class="drift"><div class="cam" style="width:${info.w}px;height:${info.h}px"><img src="${mapSrc(src)}" alt="" draggable="false"><div class="ovl"></div></div></div>`;
  const o = { el: layer, cam: $('.cam', layer), ovl: $('.ovl', layer), info, src };
  return o;
}
function smoothPath(pts) {
  // courbe fermee (Catmull-Rom vers Bezier), coins arrondis sans trop deborder
  const n = pts.length; if (n < 3) return 'M' + pts.map(p => p.join(' ')).join('L');
  const k = 0.17, f = v => +v.toFixed(5);
  let d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += 'C' + f(p1[0] + (p2[0] - p0[0]) * k) + ' ' + f(p1[1] + (p2[1] - p0[1]) * k) + ' ' + f(p2[0] - (p3[0] - p1[0]) * k) + ' ' + f(p2[1] - (p3[1] - p1[1]) * k) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
  }
  return d + 'Z';
}
function centroid(poly) {
  let x = 0, y = 0; poly.forEach(p => { x += p[0]; y += p[1]; }); return [x / poly.length, y / poly.length];
}
function renderOverlay(layer, sc) {
  const ov = layer.ovl;
  ov.classList.remove('fresh');
  ov.innerHTML = '';
  if (sc.frames.length) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'regs'); svg.setAttribute('viewBox', '0 0 1 1'); svg.setAttribute('preserveAspectRatio', 'none');
    sc.frames.forEach(f => {
      const d = smoothPath(f.poly);
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'reg' + (f.solo ? ' solo' : '')); g.dataset.id = f.id; g.style.setProperty('--c', f.color);
      ['fill', 'glow', 'glow2', 'line', 'run'].forEach(c => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', c); if (c === 'run') p.setAttribute('pathLength', '1'); g.appendChild(p); });
      svg.appendChild(g);
    });
    ov.appendChild(svg);
    sc.frames.forEach(f => {
      if (f.solo) return;
      const a = document.createElement('a');
      a.className = 'rlab'; a.href = '#/' + f.id; a.dataset.id = f.id; a.style.setProperty('--c', f.color);
      const c = f.lab || centroid(f.poly);
      a.style.cssText += `;left:${c[0] * 100}%;top:${c[1] * 100}%`;
      a.innerHTML = `<span class="fl">${esc(f.label)}${f.sub ? `<span class="fs">${esc(f.sub)}</span>` : ''}</span>`;
      ov.appendChild(a);
    });
    const hot = (id, on) => ov.querySelectorAll(`[data-id="${id}"]`).forEach(n => n.classList.toggle('hot', on));
    svg.addEventListener('mouseover', ev => { const g = ev.target.closest('.reg'); if (g) hot(g.dataset.id, true); });
    svg.addEventListener('mouseout', ev => { const g = ev.target.closest('.reg'); if (g) hot(g.dataset.id, false); });
    svg.addEventListener('click', ev => { const g = ev.target.closest('.reg'); if (g && !g.classList.contains('solo')) location.hash = '#/' + g.dataset.id; });
    ov.querySelectorAll('.rlab').forEach(a => { a.addEventListener('mouseenter', () => hot(a.dataset.id, true)); a.addEventListener('mouseleave', () => hot(a.dataset.id, false)); });
  }
  if (sc.pins.length > 8) ov.classList.add('many'); else ov.classList.remove('many');
  sc.pins.forEach(p => {
    const a = document.createElement('a');
    a.className = `pin k-${p.kind}${p.dim ? ' dim' : ''}${p.here ? ' here' : ''}${p.x < 0.1 ? ' edge-l' : ''}${p.x > 0.9 ? ' edge-r' : ''}`;
    a.href = '#/' + p.id; a.dataset.id = p.id;
    a.style.cssText = `left:${p.x * 100}%;top:${p.y * 100}%`;
    a.innerHTML = `<span class="in"><span class="pd"></span><span class="pl">${esc(p.label)}</span></span>`;
    ov.appendChild(a);
  });
  void ov.offsetWidth;
  ov.classList.add('fresh');
}

function sheetEls() { return S.map && S.map.stack ? [...S.map.el.querySelectorAll('.sheet')] : []; }
function scrollSheet(i, pos, smooth = true) {
  const stk = S.map && S.map.stack ? $('.stk', S.map.el) : null; if (!stk) return;
  const sh = sheetEls()[i]; if (!sh) return;
  const w = $('.shw', sh);
  let y = sh.offsetTop - 6;
  if (pos) y = sh.offsetTop + w.offsetTop + pos.y * w.offsetHeight - stk.clientHeight / 2;
  stk.scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' });
}
function fillStack(layer, sc) {
  layer.el.querySelectorAll('.sheet').forEach((sh, i) => renderOverlay({ ovl: $('.ovl', sh) }, { frames: [], pins: sc.sheets[i].pins }));
}
function makeStack(sc) {
  const el = document.createElement('div');
  el.className = 'layer stackl';
  el.innerHTML = '<div class="stk">' + sc.sheets.map((sh, i) =>
    `<section class="sheet" data-i="${i}" style="--s:1"><div class="shcap">${esc(sh.carte.legende || '')}</div><div class="shw"><img src="${mapSrc(sh.carte.img)}" alt="" draggable="false"><div class="ovl"></div></div></section>`).join('') + '</div>';
  const layer = { el, stack: true, src: sc.src };
  const stk = $('.stk', el);
  stk.addEventListener('scroll', () => {
    const mid = stk.scrollTop + stk.clientHeight * 0.4;
    let cur = 0; stk.querySelectorAll('.sheet').forEach((sh, i) => { if (sh.offsetTop <= mid) cur = i; });
    document.querySelectorAll('#mapcap .tab[data-sheet]').forEach(t => t.classList.toggle('on', parseInt(t.dataset.sheet, 10) === cur));
  }, { passive: true });
  return layer;
}
async function applyStack(sc, old) {
  if (old && old.stack && old.src === sc.src) { fillStack(old, sc); scrollSheet(sc.focusSheet, sc.focusPos, true); return; }
  const layer = makeStack(sc);
  stageEl.insertBefore(layer.el, $('.fog', stageEl));
  fillStack(layer, sc);
  S.map = layer;
  void layer.el.offsetWidth;
  layer.el.classList.add('on');
  const imgs = [...layer.el.querySelectorAll('.shw img')];
  await Promise.all(imgs.map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  scrollSheet(sc.focusSheet, sc.focusPos, false);
  if (old) { setTimeout(() => old.el.classList.remove('on'), 120); setTimeout(() => old.el.remove(), 1200); }
}

async function applyMap(sc, dir, focus) {
  ensureChrome();
  if (sc.kind === 'stack') return applyStack(sc, S.map);
  if (S.map && S.map.stack) {
    const o = S.map; S.map = null;
    setTimeout(() => o.el.classList.remove('on'), 60); setTimeout(() => o.el.remove(), 1100);
  }
  const info = await imgInfo(sc.src);
  const old = S.map;
  if (old && old.src === sc.src) {
    old.info = info;
    setCam(old, sc.cam, true);
    renderOverlay(old, sc);
    return;
  }
  const layer = makeLayer(sc.src, info);
  stageEl.insertBefore(layer.el, $('.fog', stageEl));
  renderOverlay(layer, sc);
  // camera de depart
  let start = sc.cam;
  if (old) {
    if (dir === 'in') start = { x: sc.cam.x + sc.cam.w * 0.22, y: sc.cam.y + sc.cam.h * 0.22, w: sc.cam.w * 0.56, h: sc.cam.h * 0.56 };
    else if (dir === 'out' && focus) start = around(focus, 0.1);
    else start = { x: sc.cam.x - sc.cam.w * 0.08, y: sc.cam.y - sc.cam.h * 0.08, w: sc.cam.w * 1.16, h: sc.cam.h * 1.16 };
  } else {
    start = { x: sc.cam.x + sc.cam.w * 0.03, y: sc.cam.y + sc.cam.h * 0.03, w: sc.cam.w * 0.94, h: sc.cam.h * 0.94 };
  }
  setCam(layer, start, false);
  void layer.el.offsetWidth;
  layer.el.classList.add('on');
  setCam(layer, sc.cam, true);
  S.map = layer;
  if (old) {
    if (dir === 'in' && focus) setCam(old, around(focus, 0.08), true);
    else if (dir === 'out') setCam(old, { x: old.rect.x - old.rect.w * 0.2, y: old.rect.y - old.rect.h * 0.2, w: old.rect.w * 1.4, h: old.rect.h * 1.4 }, true);
    setTimeout(() => old.el.classList.remove('on'), 120);
    setTimeout(() => old.el.remove(), 1200);
  }
}

/* galerie */
let galTimer = null;
function clearGal(hard) {
  clearInterval(galTimer); galTimer = null;
  if (S.gal) { const g = S.gal; g.classList.remove('on'); setTimeout(() => g.remove(), hard ? 0 : 950); S.gal = null; }
}
function showGallery(imgs, title, ent) {
  clearGal(true);
  const g = document.createElement('div');
  g.className = 'gal';
  g.innerHTML = imgs.map((im, i) => `<div class="sl${i === 0 ? ' act' : ''}" style="--bg:url('${new URL(im.img, location.href).href}')"><img src="${im.img}" alt="${esc(im.legende || title || '')}"></div>`).join('') +
    `<div class="gcap"><span class="gt"></span>${imgs.length > 1 ? '<div class="gdots">' + imgs.map((_, i) => `<i data-i="${i}"${i === 0 ? ' class="on"' : ''}></i>`).join('') + '</div><div class="gnav"><button data-d="-1" aria-label="Précédente">‹</button><button data-d="1" aria-label="Suivante">›</button></div>' : ''}</div>`;
  stageEl.insertBefore(g, $('.fog', stageEl));
  g.querySelectorAll('.sl img').forEach(im => {
    const fit = () => { if (im.naturalWidth) im.style.maxWidth = Math.min(stageEl.clientWidth, im.naturalWidth * 1.4) + 'px'; };
    if (im.complete) fit(); else im.addEventListener('load', fit);
  });
  let cur = 0;
  const go = n => {
    cur = (n + imgs.length) % imgs.length;
    g.querySelectorAll('.sl').forEach((s, i) => { s.classList.toggle('act', i === cur); });
    g.querySelectorAll('.gdots i').forEach((d, i) => d.classList.toggle('on', i === cur));
    const c = imgs[cur].cut;
    $('.gt', g).textContent = [imgs[cur].legende, c && ent && ent.formes && ent.formes.length > 1 && c !== ent.formes[0] ? c.label : ''].filter(Boolean).join(' · ');
    if (ent && c) { S.curForm = c; S.curFormOf = ent.id; setCutout(ent, c); }
  };
  go(0);
  g.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-d]'); const d = ev.target.closest('i[data-i]');
    if (b) go(cur + parseInt(b.dataset.d, 10));
    if (d) go(parseInt(d.dataset.i, 10));
  });
  const forms = imgs.some(i => i.cut);
  if (imgs.length > 1 && !forms) galTimer = setInterval(() => go(cur + 1), 8000);
  if (forms) {
    let lock = 0, ty = null;
    g.addEventListener('wheel', ev => {
      const now = Date.now();
      if (Math.abs(ev.deltaY) < 8 || now - lock < 700) return;
      const n = cur + (ev.deltaY > 0 ? 1 : -1);
      if (n < 0 || n >= imgs.length) return;
      lock = now; go(n);
    }, { passive: true });
    g.addEventListener('touchstart', ev => { ty = ev.touches[0].clientY; }, { passive: true });
    g.addEventListener('touchend', ev => {
      if (ty == null) return;
      const d = ty - ev.changedTouches[0].clientY; ty = null;
      if (Math.abs(d) > 50) { const n = cur + (d > 0 ? 1 : -1); if (n >= 0 && n < imgs.length) go(n); }
    }, { passive: true });
  }
  requestAnimationFrame(() => g.classList.add('on'));
  S.gal = g;
}
function formeFor(e, ctx) {
  if (!e || !e.formes) return null;
  return e.formes.slice(1).find(f => ctx && f.lieux && f.lieux.includes(ctx)) || e.formes[0];
}
function setCutout(e, form) {
  let c = $('.cutout', stageEl);
  if (!e || !S.gal) { if (c) c.remove(); S.cut = null; return; }
  if (!form && e.formes && S.curFormOf === e.id) form = S.curForm;
  const src = (form && form.img) || e.img;
  const ck = e.id + '|' + (src || '');
  if (S.cut === ck && c) return;
  if (c) c.remove();
  c = document.createElement('div');
  c.className = 'cutout';
  c.className = 'cutout' + (src ? '' : ' ph');
  const tn = (form && form.teinte) || e.teinte || '#3a2a14';
  c.style.setProperty('--tn', tn);
  c.innerHTML = `<i class="glow"></i><img src="${src || PH_SIL}" alt="${esc(e.nom)}">`;
  stageEl.insertBefore(c, $('.fog', stageEl));
  const ci = $('img', c);
  const cfit = () => { if (ci.naturalHeight && src) ci.style.maxHeight = Math.min(stageEl.clientHeight * 0.88, ci.naturalHeight * 1.3) + 'px'; };
  if (ci.complete) cfit(); else ci.addEventListener('load', cfit);
  S.cut = ck;
}
function renderCap(sc, entry) {
  const cap = $('#mapcap');
  if (!cap) return;
  let h = '';
  if (sc && sc.kind === 'stack') {
    h += sc.tabs.map((t, i) => `<a class="tab${i === sc.tab ? ' on' : ''}" data-sheet="${i}" href="#/${sc.owner.id}">${esc(t.legende || 'Carte ' + (i + 1))}</a>`).join('');
  } else if (sc && sc.tabs && sc.tabs.length > 1) {
    h += sc.tabs.map((t, i) => `<a class="tab${i === sc.tab ? ' on' : ''}" href="#/${sc.owner.id}${i ? '?c=' + i : ''}">${esc(t.legende || 'Carte ' + (i + 1))}</a>`).join('');
  } else if (sc && !sc.gallery && sc.tabs && sc.tabs[0] && sc.tabs[0].legende) {
    h += `<span class="cap">${esc(sc.tabs[0].legende)}</span>`;
  }
  cap.innerHTML = h;
  cap.querySelectorAll('a[data-sheet]').forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); scrollSheet(parseInt(a.dataset.sheet, 10)); }));
  const up = $('#upbtn');
  if (up) { up.hidden = !(entry && entry.parent); const p = entry && BY[entry.parent]; up.textContent = p ? '‹ ' + p.nom : '‹ Retour'; }
}

async function applyScene(e, q, token) {
  const sc = sceneOf(e, q);
  ensureChrome();
  const prevEntry = S.entry;
  S.entry = e;
  if (!sc) { stageEl.classList.add('empty'); return; }
  const key = sceneKey(sc);
  renderCap(sc, e);
  if (key === S.key) { setCutout(sc.cutout); return; }
  // sens du zoom
  let dir = null, focus = null;
  if (prevEntry && S.map && S.map.src !== sc.src) {
    if (isAnc(prevEntry, e)) { dir = 'in'; focus = focusIn(e, S.map.src); }
    else if (isAnc(e, prevEntry)) { dir = 'out'; focus = focusIn(prevEntry, sc.src); }
  }
  S.key = key;
  await applyMap(sc, dir, focus);
  if (token !== TOKEN) return;
  if (sc.gallery) {
    const sameGal = S.gal && S.galKey === JSON.stringify(sc.gallery.map(g => g.img + (g.cut ? g.cut.img : '')));
    if (!sameGal) { showGallery(sc.gallery, e.nom, sc.cutout); S.galKey = JSON.stringify(sc.gallery.map(g => g.img + (g.cut ? g.cut.img : ''))); }
  } else { clearGal(); S.galKey = null; }
  setCutout(sc.cutout);
}
function focusIn(e, mapSrc) {
  for (const c of chain(e).reverse()) {
    if (!c.pos) continue;
    const om = ownerMap(c);
    if (om && om.carte.img === mapSrc) return c.pos;
  }
  return null;
}

window.addEventListener('resize', () => {
  measure();
  if (S.map && !S.map.stack) setCam(S.map, S.map.rect, false, S.map.pad);
});

/* ---------- vue monde ---------- */
function buildWorld() {
  const cont = DB.filter(e => e.type === 'continent').sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  worldEl.innerHTML = `<div class="whead"><h1>Thaldera <span>Codex</span></h1><div class="wrule"><i></i></div></div><div class="wgrid">` + cont.map(c => {
    const inner = `<span class="wcr"><img src="${c.blason || 'img/blasons/vide.svg'}" alt=""></span><span class="wn">${esc(c.nom)}</span><span class="ws">${esc(c.sousTitre || '')}</span>`;
    return c.locked
      ? `<div class="wcrest locked" id="world-${c.id}" aria-disabled="true">${inner}</div>`
      : `<a class="wcrest" id="world-${c.id}" href="#/${c.id}" data-id="${c.id}"${c.accent ? ` style="--accent:${c.accent}"` : ''}>${inner}</a>`;
  }).join('') + `</div><div class="wbar">${worldBar()}</div>`;
  worldEl.querySelectorAll('a.wcrest').forEach(a => a.addEventListener('click', ev => {
    ev.preventDefault();
    worldEl.classList.add('leaving'); a.classList.add('chosen');
    setTimeout(() => { location.hash = '#/' + a.dataset.id; }, 480);
  }));
}
function worldBar() {
  const pj = DB.filter(e => e.type === 'pj');
  const suj = DB.filter(e => e.type === 'sujet' && e.accueil);
  let h = '';
  if (pj.length) h += `<div class="wgroup"><b>Le groupe</b>${pj.map(p => `<a href="#/${p.id}">${p.img ? `<span class="bub" style="width:auto"><span class="av" style="width:34px;height:34px;font-size:13px"><img src="${p.img}" alt=""></span></span>` : ''}${esc(p.nom.split(' ')[0])}</a>`).join('')}</div>`;
  if (suj.length) h += `<div class="wgroup"><b>Savoirs</b>${suj.map(s => `<a href="#/${s.id}">${esc(s.nom)}</a>`).join('')}</div>`;
  return h;
}
function showWorld() {
  document.title = 'Thaldera Codex';
  sceneEl.classList.add('is-world');
  worldEl.classList.remove('leaving');
  worldEl.querySelectorAll('.chosen').forEach(c => c.classList.remove('chosen'));
  S.entry = null;
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === 'monde'));
}

/* ---------- panneau ---------- */
function statusPill(e) {
  const s = e.statut;
  if (!s) return '';
  return `<span class="pill ${esc(s)}">${esc(s === 'pj' ? 'joueur' : s)}</span>`;
}
function sec(title, body, cls = '') { return body ? `<section class="sec ${cls}"><h3>${esc(title)}</h3>${body}</section>` : ''; }
const ul = (arr, id) => arr && arr.length ? '<ul>' + arr.map(t => `<li>${L(t, id)}</li>`).join('') + '</ul>' : '';
function connuHtml(e) {
  let items = (e.connu || []).map(t => `<li>${L(t, e.id)}</li>`).join('');
  return items ? `<ul>${items}</ul>` : '';
}
function crumbs(e) {
  const ch = chain(e);
  const parts = ['<a href="#/">Monde</a>'];
  ch.forEach((c, i) => parts.push(i === ch.length - 1 ? `<span>${esc(c.nom)}</span>` : `<a href="#/${c.id}">${esc(c.nom)}</a>`));
  const up = e.parent ? '#/' + e.parent : '#/';
  const upName = e.parent ? BY[e.parent]?.nom : 'Monde';
  return `<nav class="crumbs"><a class="back" href="${up}" title="Retour : ${esc(upName)}">‹ Retour</a>${parts.join('<span class="sep">›</span>')}</nav>`;
}
function bubble(p, attrs = '') {
  const st = p.statut ? ` st-${p.statut}` : '';
  const initials = p.nom.split(/[\s'’-]+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('');
  return `<a class="bub${st}" href="#/${p.id}" data-id="${p.id}" ${attrs}><span class="av">${p.img ? `<img src="${p.img}" alt="" loading="lazy">` : esc(initials)}</span>${p.statut ? '<i class="sd"></i>' : ''}<span class="nm">${esc(p.nom)}</span></a>`;
}
function kidCard(k) {
  const img = k.type === 'lieu' && k.galerie && k.galerie[0] ? k.galerie[0].img : (k.type !== 'pnj' && k.img ? k.img : '');
  return `<a class="kcard${img ? ' has-img' : ''}" href="#/${k.id}"${k.accent ? ` style="--accent:${k.accent}"` : ''}>${img ? `<span class="kimg" style="background-image:url('${img}')"></span>` : ''}${k.blason ? `<img class="kc" src="${k.blason}" alt="">` : ''}<span class="kn">${esc(k.nom)}</span><span class="kt">${esc(k.titre || '')}</span></a>`;
}
function descPNJ(e) {
  const out = [];
  const walk = x => kids(x.id).forEach(k => {
    if (k.type === 'pnj') out.push(k);
    if (['lieu', 'clan', 'organisation', 'pnj'].includes(k.type)) walk(k);
  });
  walk(e);
  return out;
}
function relations(e) {
  const rows = [];
  (e.relations || []).forEach(r => { if (BY[r.cible]) rows.push({ id: r.cible, type: r.type, ton: r.ton, note: r.note }); });
  DB.forEach(o => (o.relations || []).forEach(r => { if (r.cible === e.id && o.id !== e.id && !rows.some(x => x.id === o.id)) rows.push({ id: o.id, type: r.inverse || r.type, ton: r.ton, note: r.note, rev: true }); }));
  if (!rows.length) return '';
  const cls = t => t === 'positif' ? ' pos' : t === 'negatif' ? ' neg' : '';
  return '<div class="rels">' + rows.map(r => `<a class="chip${cls(r.ton)}" href="#/${r.id}" title="${esc(r.note || '')}"><b>${esc(r.type)}</b>${esc(BY[r.id].nom)}</a>`).join('') + '</div>';
}

function relBullets(e) {
  const rows = [], seen = new Set();
  (e.relations || []).forEach(r => { if (BY[r.cible] && !seen.has(r.cible)) { seen.add(r.cible); rows.push([r.type, r.cible, r.note]); } });
  DB.forEach(o => (o.relations || []).forEach(r => { if (r.cible === e.id && o.id !== e.id && !seen.has(o.id) && o.type !== 'sujet') { seen.add(o.id); rows.push([r.inverse || r.type, o.id, r.note]); } }));
  return rows.map(([t, id, n]) => `${t ? t.charAt(0).toUpperCase() + t.slice(1) + ' : ' : ''}${BY[id].nom}${n ? ', ' + n : ''}`);
}
function savoirItems(e) {
  const out = [];
  const isP = e.type === 'pnj' || e.type === 'pj';
  const pl = e.lieu && BY[e.lieu] ? BY[e.lieu] : (e.parent && BY[e.parent] && ['lieu', 'ville'].includes(BY[e.parent].type) ? BY[e.parent] : null);
  const vil = pl && pl.type === 'lieu' ? chain(pl).find(c => c.type === 'ville') : null;
  if (isP && e.type === 'pnj' && pl) out.push(`Vu : ${pl.nom}${vil ? ' (' + vil.nom + ')' : ''}`);
  (e.connu || []).forEach(t => out.push(L(t, e.id)));
  if (e.type !== 'pj' && e.type !== 'evenement') (e.histoire || []).forEach(t => out.push(L(t, e.id)));
  if (isP) relBullets(e).forEach(t => out.push(esc(t)));
  return out;
}
const savoirHtml = e => { const it = savoirItems(e); return it.length ? '<ul>' + it.map(t => `<li>${t}</li>`).join('') + '</ul>' : ''; };
function detailBlock(e) {
  return `<h4>${esc(e.nom)}</h4><div class="nt">${esc(e.titre || '')} ${statusPill(e)}</div>` +
    (e.resume ? `<p class="resume" style="text-align:left;font-size:17px;margin:6px 0">${L(e.resume, e.id)}</p>` : '') +
    sec('Ce que le groupe sait', savoirHtml(e)) +
    (e.type === 'pj' ? sec('Enjeux et quête en cours', ul(e.histoire, e.id), 'past') : '') +
    (e.question ? sec('En suspens', `<p class="qs">${L(e.question, e.id)}</p>`) : '') +
    `<a class="more" href="#/${e.id}">Fiche complète ›</a>`;
}

function renderPanel(e, q) {
  const acc = e.accent ? ` style="--accent:${e.accent}"` : '';
  let h = `<div class="pin-pad"${acc}>` + crumbs(e);
  const sc = sceneOf(e, q);
  const asGallery = sc && sc.gallery;
  // chapeau (paysage 4:3) quand la scene est une carte
  if (e.galerie && e.galerie.length && !asGallery && ['ville', 'region', 'faction', 'continent'].includes(e.type)) {
    h += `<div class="hero"><img src="${e.galerie[0].img}" alt=""></div>`;
  }
  if (e.type !== 'pnj' && e.type !== 'pj' && e.blason) h += `<div class="crest"><img src="${e.blason}" alt=""></div>`;
  h += `<header class="head"><div class="tp">${esc(e.typeLabel || TYPES[e.type] || '')}</div><h1>${esc(e.nom)}</h1>${e.titre ? `<div class="ti">${L(e.titre, e.id)}</div>` : ''}${statusPill(e)}<div class="rule"><i></i></div></header>`;
  if (e.chef) h += `<div class="chef"><span class="rt">${esc(e.chef.titre)}</span><span class="rn">${esc(e.chef.nom)}</span></div>`;
  if (e.themes) h += `<div class="themes">${esc(e.themes)}</div>`;
  if (e.resume) h += `<p class="resume">${L(e.resume, e.id)}</p>`;

  // lieu : personnages en bulles
  const isPlace = e.type === 'lieu';
  const here = isPlace ? kids(e.id, 'pnj').concat(DB.filter(x => x.lieu === e.id && x.parent !== e.id && (x.type === 'pnj'))) : [];
  if (isPlace && here.length) {
    h += `<section class="sec"><h3>Personnages présents</h3><div class="bubs" id="npcs">${here.map(p => bubble(p, 'data-npc="1"')).join('')}</div><div id="npcbox"></div></section>`;
  }
  if (e.type === 'evenement') { h += sec('Ce que le groupe sait', connuHtml(e)); h += sec('Ce qui s’est passé', ul(e.histoire, e.id), 'past'); }
  else h += sec('Ce que le groupe sait', savoirHtml(e));
  if (e.type === 'pj') h += sec('Enjeux et quête en cours', ul(e.histoire, e.id), 'past');
  if (e.question) h += sec('En suspens', `<p class="qs">${L(e.question, e.id)}</p>`);
  if (e.citation) h += `<blockquote class="cite"><p>${esc(e.citation.texte)}</p>${e.citation.qui ? `<cite>${esc(e.citation.qui)}</cite>` : ''}</blockquote>`;
  if (e.type !== 'pnj' && e.type !== 'pj') { const rel = relations(e); if (rel) h += sec('Liens', rel); }

  // enfants
  const placed = new Set(here.map(x => x.id));
  KID_GROUPS.forEach(([t, label]) => {
    if (t === 'pnj') {
      let list = e.type === 'ville' || e.type === 'region' ? descPNJ(e) : kids(e.id, 'pnj').filter(x => !placed.has(x.id));
      if (isPlace) list = [];
      if (list.length) h += sec(label, `<div class="bubs">${list.map(p => bubble(p)).join('')}</div>`);
    } else if (t === 'lieu' && e.type === 'ville') {
      const l = collectLieux(e);
      if (l.length) h += sec(label, `<div class="kids">${l.map(kidCard).join('')}</div>`);
    } else if (t === 'lieu' && isPlace) {
      /* sous-lieux */
      const l = kids(e.id, 'lieu'); if (l.length) h += sec(label, `<div class="kids">${l.map(kidCard).join('')}</div>`);
    } else {
      const l = kids(e.id, t); if (l.length && !(t === 'lieu')) h += sec(label, `<div class="kids">${l.map(kidCard).join('')}</div>`);
      else if (l.length) h += sec(label, `<div class="kids">${l.map(kidCard).join('')}</div>`);
    }
  });
  h += '</div>';
  panelEl.innerHTML = h;
  panelEl.scrollTop = 0;

  // bulles : accordeon + silhouette sur la scene
  const box = $('#npcbox');
  if (box) {
    let sel = null;
    const open = id => {
      const p = BY[id];
      if (sel === id) { sel = null; box.innerHTML = ''; setCutout(null); S.cut = null; panelEl.querySelectorAll('.bub.sel').forEach(b => b.classList.remove('sel')); return; }
      sel = id;
      box.innerHTML = `<div class="npcbox">${detailBlock(p)}</div>`;
      panelEl.querySelectorAll('.bub').forEach(b => b.classList.toggle('sel', b.dataset.id === id));
      S.curForm = null; S.curFormOf = null; setCutout(p, formeFor(p, S.entry && S.entry.id));
    };
    $('#npcs').addEventListener('click', ev => {
      const b = ev.target.closest('[data-npc]');
      if (!b) return;
      ev.preventDefault(); open(b.dataset.id);
    });
  }
}

/* ---------- routage ---------- */
let TOKEN = 0;
function goUp(e) { location.hash = e.parent ? '#/' + e.parent : '#/'; }

async function route() {
  const my = ++TOKEN;
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const id = decodeURIComponent(path || '');
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', !id && a.dataset.nav === 'monde'));
  if (!id) { showWorld(); return; }
  const e = BY[id];
  if (e && e.locked) { location.hash = '#/'; return; }
  if (!e) { sceneEl.classList.remove('is-world'); panelEl.innerHTML = '<div class="pin-pad"><nav class="crumbs"><a class="back" href="#/">‹ Monde</a></nav><p class="empty">Cette page n’existe pas encore.</p></div>'; return; }
  if (e.redirige && BY[e.redirige]) { location.replace('#/' + e.redirige); return; }
  sceneEl.classList.remove('is-world');
  measure();
  const q = new URLSearchParams(qs || '');
  renderPanel(e, q);
  document.title = e.nom + ' · Thaldera Codex';
  await applyScene(e, q, my);
  if (S.cut === e.id) { const c = panelEl.querySelector('.cut'); if (c) { const sp = c.nextElementSibling; c.remove(); if (sp && sp.classList.contains('sepline')) sp.remove(); } }
}

/* ---------- recherche ---------- */
function initSearch() {
  const inp = $('#q'), box = $('#results');
  const idx = DB.filter(e => !e.locked).map(e => ({ e, k: norm([e.nom, ...(e.alias || []), e.titre, e.resume, ...(e.tags || [])].filter(Boolean).join(' ')), n: norm(e.nom) }));
  let sel = -1;
  const run = () => {
    const t = norm(inp.value.trim());
    if (!t) { box.hidden = true; return; }
    const parts = t.split(' ');
    const hits = idx.filter(x => parts.every(p => x.k.includes(p)))
      .sort((a, b) => (b.n.startsWith(t) - a.n.startsWith(t)) || (b.n.includes(t) - a.n.includes(t)) || a.e.nom.localeCompare(b.e.nom)).slice(0, 9);
    box.innerHTML = hits.length ? hits.map(h => `<a href="#/${h.e.id}"><span class="rt">${esc(TYPES[h.e.type] || '')}</span><span class="rn">${esc(h.e.nom)}</span><span class="rp">${esc(h.e.parent && BY[h.e.parent] ? BY[h.e.parent].nom : '')}</span></a>`).join('') : '<div class="none">Aucun résultat</div>';
    box.hidden = false; sel = -1;
  };
  inp.addEventListener('input', run);
  inp.addEventListener('focus', run);
  inp.addEventListener('keydown', ev => {
    const as = [...box.querySelectorAll('a')];
    if (ev.key === 'ArrowDown') { sel = Math.min(sel + 1, as.length - 1); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); ev.preventDefault(); }
    else if (ev.key === 'Enter') { const a = as[Math.max(sel, 0)]; if (a) { location.hash = a.getAttribute('href'); inp.blur(); box.hidden = true; inp.value = ''; } return; }
    else if (ev.key === 'Escape') { box.hidden = true; inp.blur(); return; }
    as.forEach((a, i) => a.classList.toggle('sel', i === sel));
  });
  document.addEventListener('click', ev => { if (!ev.target.closest('.search')) box.hidden = true; });
  box.addEventListener('click', () => { box.hidden = true; inp.value = ''; });
}

/* ---------- mode edition : relever des coordonnees ---------- */
function initEdit() {
  const t = document.createElement('div'); t.className = 'toast'; t.hidden = true; document.body.appendChild(t);
  let first = null;
  const say = s => { t.textContent = s; t.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => { t.hidden = true; }, 9000); };
  stageEl.addEventListener('click', ev => {
    const img = ev.target.closest('.cam')?.querySelector('img');
    if (!img || !ev.altKey && !ev.shiftKey) return;
    ev.preventDefault();
    const r = img.getBoundingClientRect();
    const x = +((ev.clientX - r.left) / r.width).toFixed(3), y = +((ev.clientY - r.top) / r.height).toFixed(3);
    if (ev.shiftKey) {
      if (!first) { first = { x, y }; say(`coin 1 : ${x}, ${y} (shift+clic sur le coin opposé)`); return; }
      const z = { x: Math.min(first.x, x), y: Math.min(first.y, y), w: +Math.abs(x - first.x).toFixed(3), h: +Math.abs(y - first.y).toFixed(3) };
      first = null; const s = JSON.stringify(z); navigator.clipboard?.writeText(s); say('zone ' + s);
    } else { const s = JSON.stringify({ x, y }); navigator.clipboard?.writeText(s); say('pos ' + s + '  (alt+clic)'); }
  }, true);
}

/* ---------- demarrage ---------- */
(async function init() {
  try {
    await load();
  } catch (err) {
    panelEl.innerHTML = '<p class="empty">Impossible de charger les données.</p>';
    console.error(err);
    return;
  }
  measure();
  buildWorld();
  initSearch();
  window.addEventListener('hashchange', route);
  route();
})();
/* zoom molette et glisser sur la carte */
(function () {
  let drag = null, moved = false;
  const live = () => S.map && !S.map.stack && !S.gal && S.map.rect && S.map.info;
  stageEl.addEventListener('wheel', ev => {
    if (!live()) return;
    ev.preventDefault();
    const L = S.map, r = L.rect, info = L.info;
    measure();
    const c = camFor(r, info, L.pad);
    const b = stageEl.getBoundingClientRect();
    const px = (ev.clientX - b.left - c.tx) / (info.w * c.s), py = (ev.clientY - b.top - c.ty) / (info.h * c.s);
    const k = Math.min(1.6, Math.max(0.6, Math.exp(ev.deltaY * 0.0016)));
    const nw = Math.min(1.1, Math.max(0.04, r.w * k)), kk = nw / r.w, nh = r.h * kk;
    const cx = px - kk * (px - (r.x + r.w / 2)), cy = py - kk * (py - (r.y + r.h / 2));
    setCam(L, { x: Math.min(1, Math.max(0, cx)) - nw / 2, y: Math.min(1, Math.max(0, cy)) - nh / 2, w: nw, h: nh }, true, L.pad);
  }, { passive: false });
  stageEl.addEventListener('pointerdown', ev => { if (!live() || ev.button !== 0) return; drag = { x: ev.clientX, y: ev.clientY, r: { ...S.map.rect } }; moved = false; });
  window.addEventListener('pointermove', ev => {
    if (!drag || !live()) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true;
    const L = S.map, info = L.info, c = camFor(drag.r, info, L.pad);
    setCam(L, { x: drag.r.x - dx / (info.w * c.s), y: drag.r.y - dy / (info.h * c.s), w: drag.r.w, h: drag.r.h }, false, L.pad);
  });
  window.addEventListener('pointerup', () => { drag = null; });
  stageEl.addEventListener('click', ev => { if (moved) { ev.stopPropagation(); ev.preventDefault(); moved = false; } }, true);
})();
})();
