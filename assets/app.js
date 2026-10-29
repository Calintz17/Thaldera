/* Thaldera Codex v2
   Carte persistante, zoom en entonnoir (monde > continent > region > ville > lieu > personnage),
   fiches liees automatiquement, recherche. Aucune dependance, aucune etape de build. */
(() => {
'use strict';

const VER = '76';
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

let DB = [], BY = {}, KIDS = {}, NPC_AT = {}, REVERSE_REL = {};
const COLLECTION_CACHE = new Map();
let RX = null, LOOK = {};

/* ---------- donnees ---------- */
async function load() {
  const idx = await (await fetch('data/index.json?v=' + VER)).json();
  const parts = await Promise.all(idx.fichiers.map(f => fetch('data/' + f + '?v=' + VER).then(r => r.json())));
  DB = parts.flat();
  DB.forEach(e => { BY[e.id] = e; });
  DB.forEach(e => {
    if (e.parent && BY[e.parent]) (KIDS[e.parent] ||= []).push(e);
    if (e.type === 'pnj') {
      [...new Set([e.lieu, ...(e.lieux || [])])].filter(Boolean).forEach(id => (NPC_AT[id] ||= []).push(e));
    }
    (e.relations || []).forEach(r => {
      if (BY[r.cible]) (REVERSE_REL[r.cible] ||= []).push({ source: e, relation: r });
    });
  });
  Object.values(KIDS).forEach(a => a.sort((x, y) => (x.ordre ?? 99) - (y.ordre ?? 99)));
  buildLinker();
}

const pnjsAt = pl => {
  const seen = new Set();
  return kids(pl.id, 'pnj').concat(NPC_AT[pl.id] || []).filter(p => !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99));
};
const mainOf = pl => { if (!pl || !(pl.type === 'lieu' || pl.fusion) || pl.nofusion) return null; if (kids(pl.id, 'lieu').length) return null; const l = pnjsAt(pl); return l.length === 1 ? l[0] : null; };
const mergedPlace = p => { const pl = p && p.type === 'pnj' ? (p.lieu && BY[p.lieu] ? BY[p.lieu] : (p.parent ? BY[p.parent] : null)) : null; return pl && mainOf(pl) ? pl : null; };
const kids = (id, type) => (KIDS[id] || []).filter(k => !k.redirige && (!type || k.type === type));
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
  DB.filter(e => !e.redirige).forEach(e => add(e.nom, e.id));
  DB.filter(e => !e.redirige).forEach(e => (e.alias || []).forEach(a => add(a, e.id)));
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
const SCENE_CACHE = new Map();
function cachedScene(e, query) {
  const key = e.id + '?' + (query?.toString() || '');
  if (SCENE_CACHE.has(key)) return SCENE_CACHE.get(key);
  const sc = sceneOf(e, query);
  if (SCENE_CACHE.size >= 120) SCENE_CACHE.delete(SCENE_CACHE.keys().next().value);
  SCENE_CACHE.set(key, sc);
  return sc;
}
const sceneEl = $('#scene'), stageEl = $('#stage'), panelEl = $('#panel'), worldEl = $('#world');
const PH_LAND = { img: 'img/placeholder/paysage.svg', legende: '', ph: true };
const PH_SIL = 'img/placeholder/silhouette.svg';
const S = { map: null, gal: null, entry: null, key: '', cut: null, W: 0, H: 0 };
const RETURN_TO = new Map();
document.addEventListener('click', ev => {
  const a = ev.target.closest('a[href^="#/"]');
  if (!a || !S.entry) return;
  const target = decodeURIComponent(a.getAttribute('href').slice(2).split('?')[0]);
  const dest = BY[target];
  if (dest?.type === 'pnj' && target !== S.entry.id) RETURN_TO.set(dest.id, S.entry.id);
}, true);

const BIGMAP = /^img\/cartes\/(istra|thaldera|thaldera-factions)\.webp$/;
const mapSrc = u => BIGMAP.test(u) ? u.replace('.webp', '-m.webp') : u;
function syncTop() { const t = document.querySelector('.top'); if (t) document.documentElement.style.setProperty('--top-h', t.offsetHeight + 'px'); }
window.addEventListener('resize', syncTop); window.addEventListener('orientationchange', syncTop); window.addEventListener('load', syncTop);
function measure() { S.W = stageEl.clientWidth; S.H = stageEl.clientHeight; }
function camFor(rect, info, pad = 0.94) {
  const s = Math.min(S.W / (rect.w * info.w), S.H / (rect.h * info.h)) * pad;
  return {
    s,
    tx: S.W / 2 - (rect.x + rect.w / 2) * info.w * s,
    ty: S.H / 2 - (rect.y + rect.h / 2) * info.h * s
  };
}
function clampMapRect(rect) {
  const bound = (start, size) => size >= 1 ? (1-size)/2 : Math.min(1-size, Math.max(0, start));
  return { ...rect, x: bound(rect.x, rect.w), y: bound(rect.y, rect.h) };
}
function setCam(layer, rect, animate, pad) {
  measure();
  const c = camFor(rect, layer.info, pad);
  layer.rect = rect; layer.pad = pad;
  const el = layer.cam;
  // Instant projection keeps crisp fixed-size pins geometrically locked to the map.
  el.classList.add('notrans');
  // Keep the screen-space label movement in lockstep with the image transform.
  layer.labels?.style.setProperty('--atlas-motion', animate ? (el.classList.contains('wz') ? '.28s' : '.95s') : '0s');
  el.style.setProperty('--s', c.s);
  const fs = camFor(FULL, layer.info, 0.94).s, rel = c.s / fs;
  el.classList.toggle('zl', !layer.zp && rect.w < 0.5);
  el.classList.toggle('zp', !!layer.zp);
  el.dataset.z = rel < 1.25 ? "0" : rel < 1.7 ? "1" : "2";
  // Download full-resolution map only when the zoom actually requires it.
  if (BIGMAP.test(layer.src) && rel >= 1.65 && !layer.hiLoading && !layer.hiFailed) {
    layer.hiLoading = true;
    const high = new Image();
    high.decoding = 'async';
    high.onload = () => { const img = layer.cam.querySelector('img'); if (img) img.src = layer.src; };
    high.onerror = () => { layer.hiFailed = true; };
    high.src = layer.src;
  }
  el.style.transform = `translate(${c.tx}px, ${c.ty}px) scale(${c.s})`;
  positionMapAnchors(layer, c, false);
  // Keep transitions disabled during gestures; no synchronous layout flush.
}
const RAIDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v18M7 4l11 6.5L7 14.5M7 13.5L18 21"/></svg>';
const FULL = { x: 0, y: 0, w: 1, h: 1 };
const around = (p, w = 0.14) => ({ x: p.x - w / 2, y: p.y - w / 2, w, h: w });

function ensureChrome() {
  if ($('.fog', stageEl)) return;
  stageEl.insertAdjacentHTML('beforeend', '<div class="fog"></div><div class="mapcap" id="mapcap"></div><div class="maptools" id="maptools" aria-label="Commandes de la carte"><button type="button" data-map-zoom="in" aria-label="Zoom avant" title="Zoom avant">+</button><button type="button" data-map-zoom="out" aria-label="Zoom arrière" title="Zoom arrière">−</button><button type="button" data-map-zoom="reset" aria-label="Recentrer la carte" title="Recentrer la carte">⌖</button></div>');
  $('#maptools').addEventListener('click', ev => {
    const action = ev.target.closest('[data-map-zoom]')?.dataset.mapZoom;
    if (!action || !S.map || S.map.stack || S.gal) return;
    if (action === 'reset') {
      const query = new URLSearchParams(location.hash.split('?')[1] || '');
      return setCam(S.map, S.entry ? (cachedScene(S.entry, query)?.cam || FULL) : FULL, true);
    }
    const rect = S.map.rect, factor = action === 'in' ? 0.75 : 1.33;
    const w = Math.min(1.1, Math.max(0.04, rect.w * factor)), ratio = w / rect.w;
    setCam(S.map, clampMapRect({ x: rect.x + rect.w * (1-ratio)/2, y: rect.y + rect.h * (1-ratio)/2, w, h: rect.h * ratio }), true);
  });
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
      const scene = {
        kind: 'map', src: c.img, cam: FULL, owner: e, tabs: e.cartes, tab: Math.min(tab, e.cartes.length - 1), zp: true, ...(e.galerie && e.galerie.length && /placeholder/.test(c.img) ? { gallery: e.galerie } : {}),
        frames: [], // Atlas territories belong in the explorer, not on the map.
        pins: collectLieux(e).filter(k => k.pos).map(k => ({ id: k.id, ...k.pos, label: k.nom, kind: 'lieu' })).concat(collectVilles(e).map(k => ({ id: k.id, ...k.pos, label: k.nom, kind: 'ville' }))).concat(collectVoyages(e).map(k => ({ id: k.id, ...k.pos, label: k.nom, kind: 'ville' })))
      };
      return e.id === 'manoir-des-ligaments' ? withCast(scene, e) : scene;
    }
    case 'region':
    case 'faction': {
      const om = ownerMap(e);
      if (!om) return depth === 0 ? sceneOf(BY[e.parent], null, depth + 1) : null;
      const z = e.zone;
      const cam = z ? { x: z.x - z.w * 0.06, y: z.y - z.h * 0.06, w: z.w * 1.12, h: z.h * 1.12 } : FULL;
      const host = om.host;
      return {
        kind: 'map', src: om.carte.img, cam, owner: host, tabs: host.cartes, tab: host.cartes.indexOf(om.carte), zp: true,
        frames: [],
        pins: collectVilles(host).map(v => ({ id: v.id, ...v.pos, label: v.nom, kind: 'ville' })).concat(collectVoyages(host).map(k => ({ id: k.id, ...k.pos, label: k.nom, kind: 'ville' }))),
        focus: z ? { x: z.x + z.w / 2, y: z.y + z.h / 2 } : null
      };
    }
    case 'ville': {
      const cs = e.cartes || [];
      if (!cs.length) {
        const ps = sceneOf(BY[e.parent], null, depth + 1);
        if (ps && depth === 0 && ps.kind === 'map') return withCast({ ...ps, gallery: (e.galerie && e.galerie.length) ? e.galerie : (ps.gallery || [PH_LAND]) }, e);
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
        if (ps && depth === 0 && ps.kind === 'map') return withCast({ ...ps, gallery: (e.galerie && e.galerie.length) ? e.galerie : (ps.gallery || [PH_LAND]) }, e);
        return ps;
      }
      const host = om.host, cs = host.cartes;
      if (cs.length > 1) {
        const st = stackScene(host, e);
        if (e.galerie && e.galerie.length) st.gallery = e.galerie;
        return depth === 0 ? withCast(st, e) : st;
      }
      const base = {
        kind: 'map', src: om.carte.img, cam: e.pos ? around(e.pos, Math.max(e.zoom || 0.2, 0.18)) : FULL, owner: host, tabs: cs, tab: cs.indexOf(om.carte),
        frames: [],
        pins: collectLieux(host).filter(l => (l.carte || cs[0].id) === om.carte.id && l.pos).map(l => ({ id: l.id, ...l.pos, label: l.nom, kind: 'lieu', dim: l.id !== e.id, here: l.id === e.id }))
      };
      if (e.galerie && e.galerie.length) base.gallery = e.galerie;
      return depth === 0 ? withCast(base, e) : base;
    }
    default: {
      const lieu = e.lieu ? BY[e.lieu] : null;
      let s = lieu ? sceneOf(lieu, null, depth + 1) : (e.parent ? sceneOf(BY[e.parent], null, depth + 1) : null);
      if (!s && depth === 0) s = sceneOf(BY.istra, null, 1);
      if (s && (e.type === 'pnj' || e.type === 'pj') && depth === 0) {
        let gal = (e.galerie && e.galerie.length) ? e.galerie : (s.gallery || fallbackLand(e) || [PH_LAND]);
        if (e.etapes && e.etapes.length) {
          gal = e.etapes.map(f => ({ img: f.fond || PH_LAND.img, ph: !f.fond, legende: f.label, cut: f }));
        } else if (e.formes && e.formes.length > 1) {
          if (e.galerie?.some(g => Number.isInteger(g.forme))) {
            gal = gal.map(g => ({ ...g, cut: e.formes[g.forme] || e.formes[0] }));
          } else {
            const bg = (f, d) => f.fond ? { img: f.fond, legende: '' } : d;
            gal = gal.map(g => ({ ...bg(e.formes[0], g), cut: e.formes[0] })).concat(e.formes.slice(1).map(f => ({ ...bg(f, gal[0]), cut: f })));
          }
        }
        s = { ...s, gallery: gal, cutout: e };
      }
      return s;
    }
  }
}
function castOf(e) {
  const ps = pnjsAt(e);
  const seen = new Set();
  return ps.filter(p => !seen.has(p.id) && seen.add(p.id) && ((p.formes && p.formes[0] && p.formes[0].img) || p.img)).sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99));
}
function withCast(sc, e) {
  if (!sc) return sc;
  const cast = castOf(e);
  if (!cast.length) return sc;
  // Everyone at this location appears first, including if there are no
  // authored landscapes, or the parent city has several map sheets.
  const gallery = (sc.gallery && sc.gallery.length) ? sc.gallery : (fallbackLand(e) || [PH_LAND]);
  const bg = gallery[0];
  const extra = cast.map(p => {
    const f = formeFor(p, e.id);
    return { img: bg.img, legende: p.nom, who: p, cut: f && f.img ? f : { img: p.img, teinte: p.teinte, label: '' } };
  });
  return { ...sc, gallery: extra.concat(gallery) };
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
  return { id: k.id, poly: k.poly, polyx: k.polyx, color: k.couleur || k.accent || '#d9402f', lab: k.lab, label: k.nom, sub: k.titre, solo: !!solo };
}
function cachedCollection(kind, e, make) {
  const key = kind + ':' + e.id;
  if (!COLLECTION_CACHE.has(key)) COLLECTION_CACHE.set(key, make());
  return COLLECTION_CACHE.get(key);
}
function collectVoyages(e) {
  return cachedCollection('voyages', e, () => {
    const out = [];
    const walk = x => kids(x.id).forEach(k => { if (k.voyage && k.pos) out.push(k); walk(k); });
    walk(e);
    return out;
  });
}
function collectVilles(e) {
  return cachedCollection('villes', e, () => {
    const out = [];
    const walk = x => kids(x.id).forEach(k => { if (k.type === 'ville' && k.pos) out.push(k); else if (k.type === 'region' || k.type === 'faction') walk(k); });
    walk(e);
    return out;
  });
}
function collectLieux(v) {
  return cachedCollection('lieux', v, () => {
    const out = [];
    const walk = x => kids(x.id).forEach(k => { if (k.type === 'lieu') { out.push(k); walk(k); } });
    walk(v);
    return out;
  });
}

function sceneKey(sc) {
  if (!sc) return 'none';
  return JSON.stringify([sc.src, sc.cam, sc.frames.map(f => f.id + (f.solo ? 's' : '') + (f.act ? 'a' : '')), sc.pins.map(p => p.id + (p.dim ? 'd' : '') + (p.here ? 'h' : '') + (p.near ? 'n' : '')), sc.gallery?.map(g => g.img + (g.cut ? g.cut.img : '')), sc.cutout?.id, sc.tab, sc.focus]);
}

function positionMapAnchors(layer, camera, animate) {
  if (!layer.labels) return;
  const hud = layer.labels;
  hud.classList.toggle('zp', !!layer.zp);
  hud.dataset.z = layer.cam.dataset.z;
  hud.classList.toggle('notrans', !animate);
  const sx = layer.info.w * camera.s, sy = layer.info.h * camera.s;
  const occupied = [];
  for (const anchor of layer.anchors || []) {
    const x = Math.round(camera.tx + Number(anchor.dataset.x) * sx);
    const y = Math.round(camera.ty + Number(anchor.dataset.y) * sy);
    anchor.style.left = x + 'px';
    anchor.style.top = y + 'px';
    anchor.classList.toggle('offscreen', x < -180 || x > S.W + 180 || y < -110 || y > S.H + 110);
    anchor.classList.remove('crowded');
    if (anchor.classList.contains('offscreen')) continue;
    if (anchor.classList.contains('rlab')) {
      const width = Math.min(215, Math.max(115, (BY[anchor.dataset.id]?.nom.length || 13) * 8));
      occupied.push({ l:x-width/2-8, r:x+width/2+8, t:y-24, b:y+25 });
      continue;
    }
    if (!anchor.classList.contains('pin') || hud.dataset.z === '0') continue;
    const title = BY[anchor.dataset.id]?.nom || '';
    const width = Math.min(190, Math.max(80, title.length * 7 + 20));
    const r = { l:x-width/2-5, r:x+width/2+5, t:y+18, b:y+57 };
    const conflict = occupied.some(v => r.l<v.r && r.r>v.l && r.t<v.b && r.b>v.t);
    // Show a stable, uncrowded subset. All markers remain navigable and reveal
    // their names on hover/focus. Never suppress the selected destination.
    if (conflict && !anchor.classList.contains('here')) anchor.classList.add('crowded');
    else occupied.push(r);
  }
}
function makeLayer(src, info) {
  const layer = document.createElement('div');
  layer.className = 'layer';
  layer.innerHTML = `<div class="drift"><div class="cam" style="width:${info.w}px;height:${info.h}px"><img src="${mapSrc(src)}" alt="" decoding="async" draggable="false"><div class="ovl"></div></div></div><div class="map-labels" aria-label="Lieux et territoires de la carte"></div>`;
  const o = { el: layer, cam: $('.cam', layer), ovl: $('.ovl', layer), labels: $('.map-labels', layer), anchors: [], info, src };
  return o;
}
function smoothPath(pts) {
  // Atlas: preserve each authored geographical vertex; Bezier interpolation
  // overshoots coastlines and moves borders away from their coordinates.
  return pts.length ? 'M' + pts.map(p => p.join(' ')).join('L') + 'Z' : '';
}
function centroid(poly) {
  let x = 0, y = 0; poly.forEach(p => { x += p[0]; y += p[1]; }); return [x / poly.length, y / poly.length];
}
function renderOverlay(layer, sc) {
  const ov = layer.ovl;
  ov.classList.remove('fresh');
  ov.innerHTML = '';
  const hud = layer.labels || ov;
  if (hud !== ov) { hud.replaceChildren(); layer.anchors = []; }
  const addAnchor = (el, x, y) => {
    if (hud !== ov) {
      el.dataset.x = x; el.dataset.y = y;
      layer.anchors.push(el);
    } else {
      el.style.left = x * 100 + '%'; el.style.top = y * 100 + '%';
    }
    hud.appendChild(el);
  };
  if (sc.frames.length) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'regs'); svg.setAttribute('viewBox', '0 0 1 1'); svg.setAttribute('preserveAspectRatio', 'none');
    sc.frames.forEach(f => {
      const d = smoothPath(f.poly) + (f.polyx || []).map(smoothPath).join('');
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'reg' + (f.solo ? ' solo' : '') + (f.act ? ' act' : '')); g.setAttribute('fill-rule', 'evenodd'); g.dataset.id = f.id; g.style.setProperty('--c', f.color);
      ['fill', 'glow', 'glow2', 'line', 'run'].forEach(c => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', c); if (c === 'run') p.setAttribute('pathLength', '1'); g.appendChild(p); });
      svg.appendChild(g);
    });
    ov.appendChild(svg);
    sc.frames.forEach(f => {
      if (f.solo) return;
      const a = document.createElement('a');
      a.className = 'rlab' + (f.act ? ' act' : ''); a.href = '#/' + f.id; a.dataset.id = f.id; a.style.setProperty('--c', f.color);
      a.setAttribute('aria-label', 'Explorer ' + f.label);
      const c = f.lab || centroid(f.poly);
      a.innerHTML = `<span class="fl">${esc(f.label)}${f.sub ? `<span class="fs">${esc(f.sub)}</span>` : ''}</span>`;
      addAnchor(a, c[0], c[1]);
    });
    const hot = (id, on) => [ov, hud].forEach(root => root.querySelectorAll(`[data-id="${id}"]`).forEach(n => n.classList.toggle('hot', on)));
    svg.addEventListener('mouseover', ev => { const g = ev.target.closest('.reg'); if (g && !g.contains(ev.relatedTarget)) hot(g.dataset.id, true); });
    svg.addEventListener('mouseout', ev => { const g = ev.target.closest('.reg'); if (g && !g.contains(ev.relatedTarget)) hot(g.dataset.id, false); });
    svg.addEventListener('click', ev => { const g = ev.target.closest('.reg'); if (g && !g.classList.contains('solo')) location.hash = '#/' + g.dataset.id; });
    hud.querySelectorAll('.rlab').forEach(a => { a.addEventListener('mouseenter', () => hot(a.dataset.id, true)); a.addEventListener('mouseleave', () => hot(a.dataset.id, false)); });
  }
  hud.classList.toggle('many', sc.pins.filter(p => !p.near).length > 8);
  sc.pins.forEach(p => {
    const a = document.createElement('a');
    a.className = `pin k-${p.kind}${p.dim ? ' dim' : ''}${p.near ? ' near' : ''}${p.here ? ' here' : ''}${p.x < 0.1 ? ' edge-l' : ''}${p.x > 0.9 ? ' edge-r' : ''}`;
    a.href = '#/' + p.id; a.dataset.id = p.id;
    a.setAttribute('aria-label', 'Ouvrir ' + p.label);
    const ru = BY[p.id] && BY[p.id].rune;
    if (ru) a.classList.add('rune', 'r-' + ru.etat);
    a.innerHTML = `<span class="in"><span class="pd"></span>${ru ? `<span class="rb" title="Rune Raido de Philippa">${RAIDO}</span>` : ''}<span class="pl">${esc(p.label)}</span></span>`;
    // Screen-space pin: geographic anchor computed from camera each frame,
    // visual size independent of the image zoom and always pixel sharp.
    addAnchor(a, p.x, p.y);
  });
  // No image/text card on region hover; map labels and panels provide context.
  if (layer.labels && layer.rect && layer.info) positionMapAnchors(layer, camFor(layer.rect, layer.info, layer.pad), false);
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
    `<section class="sheet" data-i="${i}" style="--s:1"><div class="shcap">${esc(sh.carte.legende || '')}</div><div class="shw"><img src="${mapSrc(sh.carte.img)}" loading="${i > sc.focusSheet ? 'lazy' : 'eager'}" decoding="async" alt="" draggable="false"><div class="ovl"></div></div></section>`).join('') + '</div>';
  const layer = { el, stack: true, src: sc.src };
  const stk = $('.stk', el);
  const listenerScope = new AbortController();
  layer.cleanup = () => listenerScope.abort();
  /* deplacement haut/bas au clic : glisser a la souris + fleches */
  let dg = null, dmoved = false;
  stk.addEventListener('pointerdown', ev => { if (ev.button !== 0 || ev.pointerType === 'touch') return; dg = { y: ev.clientY, t: stk.scrollTop }; dmoved = false; });
  window.addEventListener('pointermove', ev => {
    if (!dg) return;
    const dy = ev.clientY - dg.y;
    if (!dmoved && Math.abs(dy) < 6) return;
    dmoved = true; stk.classList.add('grab'); stk.style.scrollBehavior = 'auto';
    stk.scrollTop = dg.t - dy;
  }, { signal: listenerScope.signal });
  window.addEventListener('pointerup', () => { if (!dg) return; dg = null; stk.classList.remove('grab'); stk.style.scrollBehavior = ''; if (dmoved) setTimeout(() => { dmoved = false; }, 0); }, { signal: listenerScope.signal });
  stk.addEventListener('click', ev => { if (dmoved) { ev.preventDefault(); ev.stopPropagation(); } }, true);
  if (sc.sheets.length > 1) {
    const nav = document.createElement('div');
    nav.className = 'stknav';
    nav.innerHTML = '<button type="button" class="up" aria-label="Carte du dessus" title="Carte du dessus">▲</button><button type="button" class="dn" aria-label="Carte du dessous" title="Carte du dessous">▼</button>';
    const cur = () => { const mid = stk.scrollTop + stk.clientHeight * 0.4; let c = 0; stk.querySelectorAll('.sheet').forEach((sh, i) => { if (sh.offsetTop <= mid) c = i; }); return c; };
    const go = d => { const n = sc.sheets.length; scrollSheet(Math.max(0, Math.min(n - 1, cur() + d))); };
    $('.up', nav).addEventListener('click', ev => { ev.stopPropagation(); go(-1); });
    $('.dn', nav).addEventListener('click', ev => { ev.stopPropagation(); go(1); });
    el.appendChild(nav);
  }
  stk.addEventListener('scroll', () => {
    const mid = stk.scrollTop + stk.clientHeight * 0.4;
    let cur = 0; stk.querySelectorAll('.sheet').forEach((sh, i) => { if (sh.offsetTop <= mid) cur = i; });
    document.querySelectorAll('#mapcap .tab[data-sheet]').forEach(t => t.classList.toggle('on', parseInt(t.dataset.sheet, 10) === cur));
  }, { passive: true });
  return layer;
}
async function applyStack(sc, old, token) {
  if (old && old.stack && old.src === sc.src) { fillStack(old, sc); scrollSheet(sc.focusSheet, sc.focusPos, true); return; }
  const layer = makeStack(sc);
  stageEl.insertBefore(layer.el, $('.fog', stageEl));
  fillStack(layer, sc);
  S.map = layer;
  void layer.el.offsetWidth;
  layer.el.classList.add('on');
  const imgs = [...layer.el.querySelectorAll('.shw img')];
  const through = imgs.slice(0, Math.max(0, sc.focusSheet) + 1);
  await Promise.all(through.map(img => img.complete ? null : new Promise(resolve => { img.onload = img.onerror = resolve; })));
  if (token !== TOKEN) { layer.cleanup?.(); layer.el.remove(); if (S.map === layer) S.map = null; return false; }
  scrollSheet(sc.focusSheet, sc.focusPos, false);
  if (old) { setTimeout(() => old.el.classList.remove('on'), 120); setTimeout(() => { old.cleanup?.(); old.el.remove(); }, 1200); }
}

async function applyMap(sc, dir, focus, token) {
  ensureChrome();
  if (sc.kind === 'stack') return applyStack(sc, S.map, token);
  if (S.map && S.map.stack) {
    const o = S.map; S.map = null;
    setTimeout(() => o.el.classList.remove('on'), 60); setTimeout(() => { o.cleanup?.(); o.el.remove(); }, 1100);
  }
  const info = await imgInfo(sc.src);
  if (token !== TOKEN) return false;
  const old = S.map;
  if (old && old.src === sc.src) {
    old.info = info; old.zp = !!sc.zp;
    if (S.keepCam) S.keepCam = false; else setCam(old, sc.cam, true);
    renderOverlay(old, sc);
    return;
  }
  const layer = makeLayer(sc.src, info);
  layer.zp = !!sc.zp;
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
  g.innerHTML = imgs.map((im, i) => `<div class="sl${i === 0 ? ' act' : ''}"><img ${i < 2 ? 'src' : 'data-src'}="${esc(im.img)}" decoding="async" alt="${esc(im.legende || title || '')}"></div>`).join('') +
    `<div class="gcap"><span class="gt"></span>${imgs.length > 1 ? '<div class="gdots">' + imgs.map((_, i) => `<button type="button" data-i="${i}" aria-label="Illustration ${i + 1} sur ${imgs.length}"${i === 0 ? ' class="on"' : ''}></button>`).join('') + '</div><div class="gnav"><button data-d="-1" aria-label="Précédente">‹</button><button data-d="1" aria-label="Suivante">›</button></div>' : ''}</div>`;
  stageEl.insertBefore(g, $('.fog', stageEl));
  S.gal = g;
  const wake = n => [n, n + 1].forEach(k => {
    const sl = g.querySelectorAll('.sl')[k % imgs.length], im = sl && sl.querySelector('img');
    if (im && im.dataset.src) { im.src = im.dataset.src; delete im.dataset.src; }
  });
  g.querySelectorAll('.sl img').forEach(im => {
    const fit = () => { if (!im.naturalWidth) return; const r = im.naturalWidth / im.naturalHeight; im.style.maxWidth = 'none'; im.style.width = Math.min(stageEl.clientWidth * 0.92, stageEl.clientHeight * 0.92 * r, im.naturalWidth * 2.04) + 'px'; };
    if (im.complete) fit(); else im.addEventListener('load', fit);
  });
  let cur = 0;
  const go = n => {
    cur = (n + imgs.length) % imgs.length;
    wake(cur);
    g.querySelectorAll('.sl').forEach((s, i) => { s.classList.toggle('act', i === cur); });
    g.querySelectorAll('.gdots button').forEach((d, i) => d.classList.toggle('on', i === cur));
    const c = imgs[cur].cut, who = imgs[cur].who || ent;
    if (ent && ent.etapes && c) {
      $('.gt', g).textContent = `Étape ${cur + 1} sur ${imgs.length} : ${c.label}`;
      panelEl.querySelectorAll('.etape').forEach((x, i) => x.classList.toggle('on', i === cur));
    } else $('.gt', g).textContent = [imgs[cur].legende, c && who && who.formes && who.formes.length > 1 && c !== who.formes[0] ? c.label : ''].filter(Boolean).join(', ');
    if (who && c) { S.curForm = c; S.curFormOf = who.id; setCutout(who, c); }
    else if (imgs.some(i => i.who)) { S.curForm = null; S.curFormOf = null; setCutout(null); }
  };
  go(0);
  g.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-d]'); const d = ev.target.closest('button[data-i]');
    if (b) go(cur + parseInt(b.dataset.d, 10));
    if (d) go(parseInt(d.dataset.i, 10));
  });
  const forms = imgs.some(i => i.cut);
  // Player-controlled gallery: no automatic slideshow during reading.
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
function hashSide(id) { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 2; }
function setCutout(e, form) {
  let c = $('.cutout', stageEl);
  if (!e || !S.gal || !((form && form.img) || e.img)) { if (c) c.remove(); S.cut = null; return; }
  if (!form && e.formes && S.curFormOf === e.id) form = S.curForm;
  const src = (form && form.img) || e.img;
  const ck = e.id + '|' + (src || '');
  if (S.cut === ck && c) return;
  if (c) c.remove();
  c = document.createElement('div');
  c.className = 'cutout';
  c.className = 'cutout' + (src ? '' : ' ph') + (hashSide(e.id) ? ' lf' : '');
  const tn = (form && form.teinte) || e.teinte || '#3a2a14';
  c.style.setProperty('--tn', tn);
  c.innerHTML = `<i class="glow"></i><img src="${src}" alt="${esc(e.nom)}">`;
  stageEl.insertBefore(c, $('.fog', stageEl));
  const ci = $('img', c);
  const cfit = () => { if (ci.naturalHeight && src) { const mh = stageEl.clientHeight * (innerWidth <= 760 ? 0.78 : 0.86); ci.style.height = mh + 'px'; ci.style.maxHeight = mh + 'px'; ci.style.width = 'auto'; ci.style.maxWidth = (stageEl.clientWidth * 0.6) + 'px'; } };
  if (ci.complete) cfit(); else ci.addEventListener('load', cfit);
  const anchor = () => {
    const bg = S.gal && $('.sl.act img', S.gal); if (!bg || !bg.naturalWidth) return;
    const sr = stageEl.getBoundingClientRect(), br = bg.getBoundingClientRect();
    c.style.setProperty('--cb', Math.max(0, sr.bottom - br.bottom) + 'px');
    c.style.setProperty('--cx', Math.max(0, sr.right - br.right) + 'px');
    c.style.setProperty('--cl', Math.max(0, br.left - sr.left) + 'px');
  };
  setTimeout(anchor, 60); setTimeout(anchor, 600);
  const bgi = S.gal && $('.sl.act img', S.gal); if (bgi && !bgi.complete) bgi.addEventListener('load', anchor);
  S.cut = ck;
}
function renderCap(sc, entry) {
  const cap = $('#mapcap');
  if (!cap) return;
  const maptools = $('#maptools');
  if (maptools) maptools.hidden = !sc || sc.kind === 'stack' || !!sc.gallery;
  let h = '';
  if (sc && sc.kind === 'stack') {
    h += sc.tabs.map((t, i) => `<a class="tab${i === sc.tab ? ' on' : ''}" data-sheet="${i}" href="#/${sc.owner.id}">${esc(t.legende || 'Carte ' + (i + 1))}</a>`).join('');
  } else if (sc && sc.owner && sc.owner.type === 'continent') {
    h = '';
  } else if (sc && sc.tabs && sc.tabs.length > 1) {
    h += sc.tabs.map((t, i) => `<a class="tab${i === sc.tab ? ' on' : ''}" href="#/${sc.owner.id}${i ? '?c=' + i : ''}">${esc(t.legende || 'Carte ' + (i + 1))}</a>`).join('');
  } else if (sc && !sc.gallery && sc.tabs && sc.tabs[0] && sc.tabs[0].legende) {
    h += `<span class="cap">${esc(sc.tabs[0].legende)}</span>`;
  }
  cap.innerHTML = h;
  cap.querySelectorAll('a[data-sheet]').forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); scrollSheet(parseInt(a.dataset.sheet, 10)); }));
}

async function applyScene(e, q, token) {
  const sc = cachedScene(e, q);
  ensureChrome();
  const prevEntry = S.entry;
  S.entry = e;
  if (!sc) { stageEl.classList.add('empty'); return; }
  const key = sceneKey(sc);
  renderCap(sc, e);
  const castG = !!(sc.gallery && sc.gallery.some(g => g.who));
  if (key === S.key) { if (!castG) setCutout(sc.cutout); return; }
  // sens du zoom
  let dir = null, focus = null;
  if (prevEntry && S.map && S.map.src !== sc.src) {
    if (isAnc(prevEntry, e)) { dir = 'in'; focus = focusIn(e, S.map.src); }
    else if (isAnc(e, prevEntry)) { dir = 'out'; focus = focusIn(prevEntry, sc.src); }
  }
  const applied = await applyMap(sc, dir, focus, token);
  if (token !== TOKEN || applied === false) return;
  S.key = key;
  if (sc.gallery) {
    const sameGal = S.gal && S.galKey === JSON.stringify(sc.gallery.map(g => g.img + (g.cut ? g.cut.img : '')));
    if (!sameGal) { showGallery(sc.gallery, e.nom, sc.cutout); S.galKey = JSON.stringify(sc.gallery.map(g => g.img + (g.cut ? g.cut.img : ''))); }
  } else { clearGal(); S.galKey = null; }
  if (!castG) setCutout(sc.cutout);
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
  worldEl.innerHTML = `<div class="whead"><h1><span>Thaldera</span><strong>Codex</strong></h1><div class="wrule"><i></i></div></div><div class="wgrid">` + cont.map(c => {
    const inner = `<span class="wcr"><img loading="lazy" decoding="async" src="${esc(c.blason || 'img/blasons/vide.svg')}" alt=""></span><span class="wn">${esc(c.nom)}</span><span class="ws">${esc(c.sousTitre || '')}</span>`;
    return c.locked
      ? `<div class="wcrest locked" id="world-${c.id}" aria-disabled="true">${inner}</div>`
      : `<a class="wcrest" id="world-${c.id}" href="#/${c.id}" data-id="${c.id}"${c.accent ? ` style="--accent:${c.accent}"` : ''}>${inner}</a>`;
  }).join('') + `</div><div class="wbar">${worldBar()}</div>`;
  // Crest links use normal, immediate navigation.
}
function worldBar() {
  const pj = DB.filter(e => e.type === 'pj');
  let h = '';
  if (pj.length) h += `<div class="wgroup"><b>Le groupe</b>${pj.map(p => `<a href="#/${p.id}">${p.img ? `<span class="bub" style="width:auto"><span class="av" style="width:34px;height:34px;font-size:13px"><img src="${p.img}" alt=""></span></span>` : ''}${esc(p.nom.split(' ')[0])}</a>`).join('')}</div>`;
  return h;
}
function showWorld() {
  document.title = 'Thaldera Codex';
  sceneEl.classList.add('is-world');
  worldEl.classList.remove('leaving');
  S.entry = null;
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === 'monde'));
}

/* ---------- panneau ---------- */
function statusPill(e) {
  const s = e.statut;
  if (!s) return '';
  return `<span class="pill ${esc(s)}">${esc(s === 'pj' ? 'joueur' : s)}</span>`;
}
const ATT_LABEL = { ennemi: 'ennemi', neutre: 'neutre', positif: 'positif', allie: 'allié' };
const ATT_TIP = { ennemi: 'Ennemi du groupe', neutre: 'Neutre envers le groupe', positif: 'Bien disposé envers le groupe', allie: 'Allié : prêt à répondre à l’appel, à se sacrifier, à aider le groupe' };
function attPill(e) {
  const a = e.attitude;
  if (e.type !== 'pnj' || !a) return '';
  return `<span class="pill att ${esc(a)}" title="${esc(ATT_TIP[a] || '')}">${esc(ATT_LABEL[a] || a)}</span>`;
}
const pills = e => { const p = statusPill(e) + attPill(e); return p ? `<div class="pills">${p}</div>` : ''; };
function network(e) {
  const rows = [], seen = new Set();
  const add = (id, type, ton, rev) => { if (BY[id] && id !== e.id && !seen.has(id)) { seen.add(id); rows.push({ id, type, ton, rev }); } };
  (e.relations || []).forEach(r => add(r.cible, r.type, r.ton));
  (REVERSE_REL[e.id] || []).forEach(({ source: o, relation: r }) => {
    if (o.type !== 'sujet') add(o.id, r.inverse || r.type, r.ton, true);
  });
  const grp = (label, ton) => {
    const l = rows.filter(r => ton === 'neutre' ? (r.ton !== 'positif' && r.ton !== 'negatif') : r.ton === ton);
    return l.length ? `<div class="net ${ton}"><span class="nl">${label}</span><div class="rels">${l.map(r => `<a class="chip ${ton === 'positif' ? 'pos' : ton === 'negatif' ? 'neg' : ''}" href="#/${r.id}">${r.rev ? `${esc(BY[r.id].nom)} <small>(${esc(r.type.charAt(0).toLowerCase() + r.type.slice(1))})</small>` : `<b>${esc(r.type)}</b>${esc(BY[r.id].nom)}`}</a>`).join('')}</div></div>` : '';
  };
  return grp('Alliés', 'positif') + grp('Ennemis', 'negatif') + grp('Autres liens', 'neutre');
}
function parcours(e) {
  if (!e.etapes || !e.etapes.length) return '';
  const pl = BY[e.lieu];
  return '<ol class="parc">' + e.etapes.map((f, i) => {
    const lp = f.lieu && BY[f.lieu] ? `<a href="#/${f.lieu}">${esc(BY[f.lieu].nom)}</a>` : (f.lieuNom ? esc(f.lieuNom) : '');
    const last = i === e.etapes.length - 1;
    const st = f.statut ? `<span class="pill ${esc(f.statut)}">${esc(f.statut === 'pj' ? 'joueur' : f.statut)}</span>` : '';
    const at = f.attitude ? `<span class="pill att ${esc(f.attitude)}" title="${esc(ATT_TIP[f.attitude] || '')}">${esc(ATT_LABEL[f.attitude] || f.attitude)}</span>` : '';
    return `<li class="etape${i === 0 ? ' on' : ''}${last ? ' now' : ''}" data-i="${i}"><div class="eh"><span class="en">${i + 1}</span><b>${esc(f.label)}</b>${last ? '<em>aujourd’hui</em>' : ''}</div>${lp ? `<div class="el">${lp}</div>` : ''}<div class="pills">${st}${at}</div><p>${L(f.texte || '', e.id)}</p></li>`;
  }).join('') + '</ol>';
}
function sec(title, body, cls = '') { if (body) body = body.replace(/<li>!! /g, '<li class="key">'); return body ? `<section class="sec ${cls}"><h3>${esc(title)}</h3>${body}</section>` : ''; }
const ul = (arr, id) => arr && arr.length ? '<ul>' + arr.map(t => `<li>${L(t, id)}</li>`).join('') + '</ul>' : '';
function connuHtml(e) {
  let items = (e.connu || []).map(t => `<li>${L(t, e.id)}</li>`).join('');
  return items ? `<ul>${items}</ul>` : '';
}
const tgt = c => { if (c.redirige && BY[c.redirige]) return tgt(BY[c.redirige]); const m = mainOf(c); return m ? m : c; };
function upOf(e) {
  const mp = mergedPlace(e);
  let c = mp ? BY[mp.parent] : (e.parent ? BY[e.parent] : null);
  let g = 0;
  while (c && g++ < 12 && (tgt(c) === e || c === e)) c = c.parent ? BY[c.parent] : null;
  return c;
}
function crumbs(e) {
  const mp = mergedPlace(e);
  const previous = e.type === 'pnj' && RETURN_TO.has(e.id) ? BY[RETURN_TO.get(e.id)] : null;
  const ch = previous ? [previous] : chain(e).filter(c => c !== mp && c !== e && tgt(c) !== e);
  const parts = ['<a href="#/">Monde</a>'];
  ch.forEach(c => parts.push(`<a href="#/${tgt(c).id}">${esc(c.nom)}</a>`));
  parts.push(`<span>${esc(e.nom)}</span>`);
  const upE = previous || upOf(e);
  const up = upE ? '#/' + tgt(upE).id : '#/';
  const upName = upE ? upE.nom : 'Monde';
  return `<nav class="crumbs"><a class="back" href="${up}" title="Retour : ${esc(upName)}">‹ Retour</a>${parts.join('<span class="sep">›</span>')}</nav>`;
}
function bubble(p, attrs = '') {
  const st = p.statut ? ` st-${p.statut}` : '';
  const initials = p.nom.split(/[\s'’-]+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('');
  return `<a class="bub${st}" href="#/${p.id}" data-id="${p.id}" ${attrs}><span class="av">${p.img ? `<img src="${p.img}" alt="" loading="lazy">` : esc(initials)}</span>${p.statut ? '<i class="sd"></i>' : ''}<span class="nm">${esc(p.nom)}</span></a>`;
}
function kidCard(k) {
  const img = k.type === 'lieu' && k.galerie && k.galerie[0] ? k.galerie[0].img : (k.type !== 'pnj' && k.img ? k.img : '');
  return `<a class="kcard${img ? ' has-img' : ''}" href="#/${k.id}"${k.accent ? ` style="--accent:${k.accent}"` : ''}>${img ? `<span class="kimg"><img loading="lazy" decoding="async" src="${esc(img)}" alt=""></span>` : ''}${k.blason ? `<img class="kc" src="${k.blason}" alt="">` : ''}<span class="kn">${esc(k.nom)}</span><span class="kt">${esc(k.titre || '')}</span></a>`;
}
function descPNJ(e) {
  return cachedCollection('pnj-desc', e, () => {
    const out = [], seen = new Set(), traversed = new Set();
    const add = p => { if (!seen.has(p.id)) { seen.add(p.id); out.push(p); } };
    const walk = x => {
      if (traversed.has(x.id)) return;
      traversed.add(x.id);
      kids(x.id).forEach(k => {
        if (k.type === 'pnj') add(k);
        if (['region', 'faction', 'ville', 'lieu', 'clan', 'organisation', 'pnj'].includes(k.type)) walk(k);
      });
    };
    walk(e);
    // A character may be classified under a clan yet appear at a city/location.
    // Show them in the relevant regional/city index without changing their parent.
    DB.forEach(p => {
      if (p.type !== 'pnj' || seen.has(p.id)) return;
      const locations = [p.lieu, ...(p.lieux || [])].filter(id => BY[id]);
      if (locations.some(id => chain(BY[id]).some(ancestor => ancestor.id === e.id))) add(p);
    });
    return out;
  });
}
function relations(e) {
  const rows = [];
  (e.relations || []).forEach(r => { if (BY[r.cible]) rows.push({ id: r.cible, type: r.type, ton: r.ton, note: r.note }); });
  (REVERSE_REL[e.id] || []).forEach(({ source: o, relation: r }) => {
    if (o.id !== e.id && !rows.some(x => x.id === o.id))
      rows.push({ id: o.id, type: r.inverse || r.type, ton: r.ton, note: r.note, rev: true });
  });
  if (!rows.length) return '';
  const cls = t => t === 'positif' ? ' pos' : t === 'negatif' ? ' neg' : '';
  return '<div class="rels">' + rows.map(r => `<a class="chip${cls(r.ton)}" href="#/${r.id}" title="${esc(r.note || '')}"><b>${esc(r.type)}</b>${esc(BY[r.id].nom)}</a>`).join('') + '</div>';
}

function relBullets(e) {
  const rows = [], seen = new Set();
  (e.relations || []).forEach(r => { if (BY[r.cible] && !seen.has(r.cible)) { seen.add(r.cible); rows.push([r.type, r.cible, r.note]); } });
  (REVERSE_REL[e.id] || []).forEach(({ source: o, relation: r }) => {
    if (o.id !== e.id && !seen.has(o.id) && o.type !== 'sujet') {
      seen.add(o.id); rows.push([r.inverse || r.type, o.id, r.note]);
    }
  });
  return rows.map(([t, id, n]) => `${t ? t.charAt(0).toUpperCase() + t.slice(1) + ' : ' : ''}${BY[id].nom}${n ? ', ' + n : ''}`);
}
function savoirItems(e) {
  const out = [];
  const isP = e.type === 'pnj' || e.type === 'pj';
  const pl = e.lieu && BY[e.lieu] ? BY[e.lieu] : (e.parent && BY[e.parent] && ['lieu', 'ville'].includes(BY[e.parent].type) ? BY[e.parent] : null);
  const vil = pl && pl.type === 'lieu' ? chain(pl).find(c => c.type === 'ville') : null;
  (e.connu || []).forEach(t => out.push(L(t, e.id)));
  if (e.type !== 'pj' && e.type !== 'evenement') (e.histoire || []).forEach(t => out.push(L(t, e.id)));
  return out;
}
const savoirHtml = e => { const it = savoirItems(e); return it.length ? '<ul>' + it.map(t => `<li>${t}</li>`).join('') + '</ul>' : ''; };
function detailBlock(e) {
  return `<h4>${esc(e.nom)}</h4><div class="nt">${esc(e.titre || '')}${pills(e)}</div>` +
    (e.resume ? `<p class="resume" style="text-align:left;font-size:17px;margin:6px 0">${L(e.resume, e.id)}</p>` : '') +
    sec('Ce que le groupe sait', savoirHtml(e)) +
    (e.type === 'pj' ? sec('Enjeux et quête en cours', ul(e.histoire, e.id), 'past') : '') +
    (e.question ? sec('En suspens', `<p class="qs">${L(e.question, e.id)}</p>`) : '') +
    `<a class="more" href="#/${e.id}">Fiche complète ›</a>`;
}

function renderPanel(e, q) {
  const acc = e.accent ? ` style="--accent:${e.accent}"` : '';
  let h = `<div class="pin-pad"${acc}>` + crumbs(e);
  const sc = cachedScene(e, q);
  const asGallery = sc && sc.gallery;
  // chapeau (paysage 4:3) quand la scene est une carte
  if (e.galerie && e.galerie.length && !asGallery && !e.blason && ['region', 'faction', 'continent'].includes(e.type)) {
    h += `<div class="hero"><img loading="lazy" decoding="async" src="${esc(e.galerie[0].img)}" alt=""></div>`;
  }
  if (e.type !== 'pnj' && e.type !== 'pj' && e.blason) h += `<div class="crest"><img loading="lazy" decoding="async" src="${esc(e.blason)}" alt=""></div>`;
  h += `<header class="head"><div class="tp">${esc(e.typeLabel || TYPES[e.type] || '')}</div><h1>${esc(e.nom)}</h1>${e.titre ? `<div class="ti">${L(e.titre, e.id)}</div>` : ''}${pills(e)}<div class="rule"><i></i></div></header>`;
  const mp0 = mergedPlace(e), ru0 = e.rune || (mp0 && mp0.rune);
  if (ru0) h += `<div class="runeline r-${esc(ru0.etat)}"><span class="rb">${RAIDO}</span><span><b>Rune Raido${ru0.etat === 'detruite' ? ' (détruite)' : ru0.etat === 'tbc' ? ' (à confirmer)' : ''}</b>${esc(ru0.note || '')}</span></div>`;
  if (e.chef) h += `<div class="chef"><span class="rt">${esc(e.chef.titre)}</span><span class="rn">${esc(e.chef.nom)}</span></div>`;
  if (e.themes) h += `<div class="themes">${esc(e.themes)}</div>`;
  const mp = mergedPlace(e);
  if (mp && mp.chapeau) h += `<p class="chapeau">${L(mp.chapeau, e.id)}</p>`;
  else if (e.chapeau) h += `<p class="chapeau">${L(e.chapeau, e.id)}</p>`;
  if (e.resume && !(mp && mp.chapeau) && !e.chapeau) h += `<p class="resume">${L(e.resume, e.id)}</p>`;
  if (mp) {
    const pit = [...(mp.connu || []), ...(mp.histoire || [])].map(t => L(t, e.id));
    if (pit.length) h += sec(mp.nom, '<ul>' + pit.map(t => `<li>${t}</li>`).join('') + '</ul>', 'past');
  }

  // lieu : personnages en bulles
  const isPlace = e.type === 'lieu';
  const here = isPlace ? pnjsAt(e) : [];
  if (isPlace && here.length) {
    h += `<section class="sec"><h3>Personnages présents</h3><div class="bubs" id="npcs">${here.map(p => bubble(p, 'data-npc="1"')).join('')}</div><div id="npcbox"></div></section>`;
  }
  if (e.type === 'evenement') { h += sec('Ce que le groupe sait', connuHtml(e)); h += sec('Ce qui s’est passé', ul(e.histoire, e.id), 'past'); }
  else h += sec('Ce que le groupe sait', savoirHtml(e));
  if (e.scenar && e.scenar.texte) h += `<aside class="scenar"><div class="sch">${esc(e.scenar.titre || 'Où en est le scénario')}</div>${e.scenar.texte.map(t => `<p>${L(t, e.id)}</p>`).join('')}</aside>`;
  if (e.etapes) h += sec('Parcours', parcours(e), 'parcsec');
  if (e.type === 'pj') h += sec('Enjeux et quête en cours', ul(e.histoire, e.id), 'past');
  if (e.question) h += sec('En suspens', `<p class="qs">${L(e.question, e.id)}</p>`);
  if (e.type === 'pnj' && (e.lieux || []).length >= 2) {
    const places = [...new Set(e.lieux)].map(id => BY[id]).filter(p => p && !p.redirige);
    if (places.length > 1) h += sec('Lieux traversés',
      `<div class="rels">${places.map(p => `<a class="chip" href="#/${p.id}">${esc(p.nom)}</a>`).join('')}</div>`);
  }
  if (mp) { const sib = pnjsAt(mp).filter(x => x.id !== e.id); if (sib.length) h += sec('Aussi présents', `<div class="bubs">${sib.map(q2 => bubble(q2)).join('')}</div>`); }
  if (e.citation) h += `<blockquote class="cite"><p>${esc(e.citation.texte)}</p>${e.citation.qui ? `<cite>${esc(e.citation.qui)}</cite>` : ''}</blockquote>`;
  if (e.type !== 'pnj' && e.type !== 'pj') { const rel = relations(e); if (rel) h += sec('Liens', rel); }
  else { const nw = network(e); if (nw) h += sec('Réseau', nw, 'netsec'); }

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
  panelEl.querySelectorAll('.etape').forEach(li => li.addEventListener('click', ev => {
    if (ev.target.closest('a')) return;
    const d = S.gal && S.gal.querySelectorAll('.gdots button')[+li.dataset.i];
    if (d) d.click();
  }));

  // bulles : ouvre directement la fiche complete
  const npcs = $('#npcs');
  if (npcs) npcs.addEventListener('click', ev => {
    const b = ev.target.closest('[data-npc]');
    if (!b) return;
    ev.preventDefault(); location.hash = '#/' + b.dataset.id;
  });
}

/* ---------- routage ---------- */
let TOKEN = 0;
function goUp(e) { const u = upOf(e); location.hash = u ? '#/' + tgt(u).id : '#/'; }

async function route() {
  journalMode(null, false);
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
  { const m = mainOf(e); if (m) { location.replace('#/' + m.id); return; } }
  sceneEl.classList.remove('is-world');
  measure();
  const q = new URLSearchParams(qs || '');
  renderPanel(e, q);
  document.title = e.nom + ' - Thaldera Codex';
  await applyScene(e, q, my);
  S.keepCam = false; S.navBusy = false;
  if (S.cut === e.id) { const c = panelEl.querySelector('.cut'); if (c) { const sp = c.nextElementSibling; c.remove(); if (sp && sp.classList.contains('sepline')) sp.remove(); } }
}


/* ---------- explorateur du codex ---------- */
function initExplorer() {
  const btn = $('#ebtn'), box = $('#elog');
  if (!btn || !box) return;
  const continents = DB.filter(e => e.type === 'continent' && !e.locked);
  let continent = '', region = '', type = '', term = '';
  const regions = DB.filter(e => (e.type === 'region' || e.type === 'faction') && !e.locked && !e.redirige);
  const types = [['', 'Tout'], ['region', 'Régions'], ['faction', 'Factions'],
    ['ville', 'Villes'], ['lieu', 'Lieux'], ['pnj', 'PNJ'], ['pj', 'Joueurs']];
  const render = () => {
    const visible = DB.filter(e => {
      if (e.locked || e.redirige) return false;
      if (continent && continentOf(e)?.id !== continent) return false;
      if (region && !chain(e).some(p => p.id === region)) return false;
      if (type && e.type !== type) return false;
      return !term || norm([e.nom, ...(e.alias || []), e.titre].filter(Boolean).join(' ')).includes(term);
    }).sort((a, b) => {
      const ca = chain(a).find(e => e.type === 'ville')?.nom || '';
      const cb = chain(b).find(e => e.type === 'ville')?.nom || '';
      return ca.localeCompare(cb, 'fr') || a.nom.localeCompare(b.nom, 'fr');
    });
    const items = visible.slice(0, 80).map(e => {
      const parent = e.parent && BY[e.parent];
      return `<a class="eitem" href="#/${encodeURIComponent(e.id)}"><span class="ekind">${esc(TYPES[e.type] || '')}</span><span class="ename">${esc(e.nom)}</span><span class="eparent">${esc(parent?.nom || '')}</span></a>`;
    }).join('');
    const matchingRegions = regions.filter(e => !continent || continentOf(e)?.id === continent);
    if (region && !matchingRegions.some(e => e.id === region)) region = '';
    $('#eregion', box).innerHTML = '<option value="">Toutes les régions</option>' +
      matchingRegions.map(e => `<option value="${esc(e.id)}">${esc(e.nom)}</option>`).join('');
    $('#eregion', box).value = region;
    $('#efilters', box).innerHTML = types.map(([id, label]) =>
      `<button type="button" class="efilter${id === type ? ' active' : ''}" data-type="${id}" aria-pressed="${id === type}">${label}</button>`).join('');
    $('#eresults', box).innerHTML = items || '<p class="eempty">Aucune fiche trouvée.</p>';
    $('#ecount', box).textContent = visible.length + ' fiches' + (visible.length > 80 ? ' (80 affichées, affinez votre recherche)' : '');
  };
  const toggle = open => {
    box.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      if (!box.firstElementChild) {
        box.innerHTML = `<div class="ewin" role="document">
          <header class="ehead"><div><span class="eeyebrow">Atlas & personnages</span><h2>Explorer le codex</h2></div><button class="eclose" type="button" aria-label="Fermer l’explorateur">×</button></header>
          <div class="etools"><label for="econtinent">Continent</label><select id="econtinent"><option value="">Tous les continents</option>${continents.map(e => `<option value="${esc(e.id)}">${esc(e.nom)}</option>`).join('')}</select>
          <label for="eregion">Région ou territoire</label><select id="eregion"><option value="">Toutes les régions</option></select>
          <label for="equery">Rechercher une fiche</label><input id="equery" type="search" placeholder="Ville, lieu, personnage..." autocomplete="off"></div>
          <div id="efilters" class="efilters" aria-label="Type de fiche"></div><p id="ecount" class="ecount" aria-live="polite"></p>
          <div id="eresults" class="eresults"></div></div>`;
      }
      const current = S.entry && continentOf(S.entry);
      if (current && !continent) continent = current.id;
      $('#econtinent', box).value = continent;
      render();
      $('#equery', box).focus();
    }
  };
  btn.addEventListener('click', () => toggle(box.hidden));
  box.addEventListener('click', ev => {
    if (ev.target === box || ev.target.closest('.eclose') || ev.target.closest('.eitem')) toggle(false);
    const filter = ev.target.closest('[data-type]');
    if (filter) { type = filter.dataset.type; render(); }
  });
  box.addEventListener('change', ev => {
    if (ev.target.id === 'econtinent') { continent = ev.target.value; region = ''; render(); }
    if (ev.target.id === 'eregion') { region = ev.target.value; render(); }
  });
  box.addEventListener('input', ev => { if (ev.target.id === 'equery') { term = norm(ev.target.value.trim()); render(); } });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !box.hidden) toggle(false); });
}

/* ---------- recherche ---------- */
function initSearch() {
  const inp = $('#q'), box = $('#results');
  const idx = DB.filter(e => !e.locked && !e.redirige).map(e => ({ e, k: norm([e.nom, ...(e.alias || []), e.titre, e.resume, ...(e.tags || [])].filter(Boolean).join(' ')), n: norm(e.nom) }));
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
  document.addEventListener('keydown', ev => {
    if (ev.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') && !ev.ctrlKey && !ev.metaKey && $('#elog')?.hidden !== false) {
      ev.preventDefault(); inp.focus();
    }
  });
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

/* ---------- journal latéral : 60% contexte / 40% journal ---------- */
function journalMode(box, open) {
  for (const [id, buttonId] of [['qlog','qbtn'],['rlog','rbtn'],['slog','sbtn']]) {
    const panel = document.getElementById(id), trigger = document.getElementById(buttonId);
    if (!panel || !trigger) continue;
    const active = !!open && panel === box;
    panel.hidden = !active;
    trigger.setAttribute('aria-expanded', String(active));
  }
  document.body.classList.toggle('journal-open', !!open);
  requestAnimationFrame(() => {
    syncTop(); measure();
    if (S.map && !S.map.stack && S.map.rect) setCam(S.map, S.map.rect, false, S.map.pad);
  });
}
/* ---------- compte-rendus des séances en panneau latéral ---------- */
function initSessions() {
  const btn = $('#sbtn'), box = $('#slog'); if (!btn || !box) return;
  let sessions = null;
  const draw = () => {
    const items = sessions || [];
    box.innerHTML = `<div class="qwin" role="document">
      <header><span class="qgem"></span><h2>Résumé des parties</h2><span class="qcount">${items.length} séances</span><button type="button" class="qx" aria-label="Fermer">×</button></header>
      <div class="qlist session-entries">${items.length
        ? items.map((s,i) => `<details class="session-entry"><summary><span class="qstar" aria-hidden="true">✦</span><span class="session-label">${esc(s.titre || 'Partie ' + (i + 1))}<small>${esc(s.date || '')}</small></span><span class="session-arrow" aria-hidden="true">›</span></summary><div class="session-body"><p>${esc(s.resume || 'Résumé à rédiger.')}</p>${(s.liens || []).filter(x => BY[x.id] && !BY[x.id].locked).map(x => `<a href="#/${esc(x.id)}">${esc(x.label || BY[x.id].nom)}</a>`).join('')}</div></details>`).join('')
        : '<p class="qempty">Les résumés des séances jouées apparaîtront ici dès leur rédaction.</p>'}</div></div>`;
    $('.qx', box).addEventListener('click', () => journalMode(box,false));
    box.querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click',()=>journalMode(box,false)));
  };
  const toggle = async open => {
    if (open && !sessions) {
      try {
        const r = await fetch('data/parties.json?v=' + VER);
        if (!r.ok) throw new Error('Journal HTTP ' + r.status);
        sessions = (await r.json()).parties || [];
      } catch(error) { console.error(error); sessions = []; }
    }
    journalMode(box,open); if(open) draw();
  };
  btn.addEventListener('click', () => toggle(box.hidden));
  document.addEventListener('keydown', ev => { if(ev.key==='Escape' && !box.hidden) journalMode(box,false); });
}
/* ---------- journal de quêtes ---------- */
async function initQuests() {
  const btn = $('#qbtn'), box = $('#qlog');
  if (!btn || !box) return;
  let Q = null;
  const draw = () => {
    const n = Q.length;
    box.innerHTML = `<div class="qwin" role="document"><header><span class="qgem"></span><h2>Journal de quêtes</h2><span class="qcount">${n} en cours</span><button type="button" class="qx" aria-label="Fermer">×</button></header><ol class="qlist">${Q.map(x => `<li class="qitem"><span class="qstar" aria-hidden="true">✦</span><div><b>${esc(x.titre)}</b><p>${L(x.texte, '')}</p></div></li>`).join('') || '<li class="qempty">Aucune quête renseignée pour le moment.</li>'}</ol></div>`;
    box.querySelector('.qx').addEventListener('click', () => toggle(false));
    box.querySelectorAll('.qitem a').forEach(a => a.addEventListener('click', () => toggle(false)));
  };
  const toggle = async open => {
    if (open && !Q) { try { Q = (await (await fetch('data/quetes.json?v=' + VER)).json()).quetes || []; } catch (e) { Q = []; } }
    journalMode(box, open);
    if (open) draw();
  };
  btn.addEventListener('click', ev => { ev.stopPropagation(); toggle(box.hidden); });
  box.addEventListener('click', ev => { if (ev.target === box) toggle(false); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !box.hidden) toggle(false); });
}

/* ---------- journal des runes de Philippa ---------- */
function initRunes() {
  const btn = $('#rbtn'), box = $('#rlog');
  if (!btn || !box) return;
  const ETAT = { active: 'Active', detruite: 'Détruite', tbc: 'Active' };
  const where = e => { let p = BY[e.parent], g = 0; while (p && g++ < 8) { if (p.type === 'ville' || p.type === 'continent') return p; p = BY[p.parent]; } return null; };
  const draw = () => {
    const R = Object.values(BY).filter(x => x.rune).sort((a, b) => (a.rune.ordre || 99) - (b.rune.ordre || 99));
    box.innerHTML = `<div class="qwin" role="document"><header><span class="qgem"></span><h2>Runes de Philippa</h2><span class="qcount">${R.length} posées</span><button type="button" class="qx" aria-label="Fermer">×</button></header><ol class="qlist">${R.map(x => { const w = where(x); return `<li class="qitem r-${esc(x.rune.etat)}"><span class="rb rbl">${RAIDO}</span><div><b><a href="#/${esc(x.id)}">${esc(x.rune.label || x.nom)}</a>${w ? ' · ' + esc(w.nom) : ''}</b><p>${esc(ETAT[x.rune.etat] || x.rune.etat)}</p></div></li>`; }).join('') || '<li class="qempty">Aucune rune posée pour le moment.</li>'}</ol></div>`;
    box.querySelector('.qx').addEventListener('click', () => toggle(false));
    box.querySelectorAll('.qitem a').forEach(a => a.addEventListener('click', () => toggle(false)));
  };
  const toggle = open => {
    journalMode(box, open);
    if (open) draw();
  };
  btn.addEventListener('click', ev => { ev.stopPropagation(); toggle(box.hidden); });
  box.addEventListener('click', ev => { if (ev.target === box) toggle(false); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !box.hidden) toggle(false); });
}

(async function init() {
  try {
    await load();
  } catch (err) {
    panelEl.innerHTML = '<p class="empty">Impossible de charger les données.</p>';
    console.error(err);
    return;
  }
  syncTop();
  measure();
  buildWorld();
  initSearch();
  initExplorer();
  initQuests();
  initRunes();
  initSessions();
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
    L.cam.classList.add('wz'); clearTimeout(L.wzT); L.wzT = setTimeout(() => L.cam.classList.remove('wz'), 450);
    setCam(L, clampMapRect({ x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh }), true, L.pad);
  }, { passive: false });
  const ptrs = new Map(); let pinch = null;
  const spread = () => { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; };
  stageEl.addEventListener('pointerdown', ev => {
    if (!live() || ev.button !== 0 || ev.target.closest('.maptools, .mapcap')) return;
    ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ptrs.size === 2) { const sp = spread(); pinch = { d: sp.d, r: { ...S.map.rect } }; drag = null; moved = true; return; }
    drag = { x: ev.clientX, y: ev.clientY, r: { ...S.map.rect } }; moved = false;
  });
  window.addEventListener('pointermove', ev => {
    if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch && ptrs.size >= 2 && live()) {
      const L = S.map, r = pinch.r, sp = spread(), k = pinch.d / Math.max(10, sp.d);
      const nw = Math.min(1.1, Math.max(0.04, r.w * k)), nh = r.h * (nw / r.w);
      setCam(L, clampMapRect({ x: r.x + r.w / 2 - nw / 2, y: r.y + r.h / 2 - nh / 2, w: nw, h: nh }), false, L.pad);
      return;
    }
    if (!drag || !live()) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true;
    const L = S.map, info = L.info, c = camFor(drag.r, info, L.pad);
    setCam(L, clampMapRect({ x: drag.r.x - dx / (info.w * c.s), y: drag.r.y - dy / (info.h * c.s), w: drag.r.w, h: drag.r.h }), false, L.pad);
  });
  const endp = ev => {
    ptrs.delete(ev.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!ptrs.size) { drag = null; setTimeout(() => { moved = false; }, 0); }
  };
  window.addEventListener('pointerup', endp); window.addEventListener('pointercancel', endp);
  stageEl.addEventListener('click', ev => { if (moved) { ev.stopPropagation(); ev.preventDefault(); moved = false; } }, true);
})();
})();
