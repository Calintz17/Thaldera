/* Liveplay : fiches de table en direct (PV, emplacements, ressources, sorts, armes) et tour de controle du MJ.
   Etat partage via Supabase, acces libre en lecture et en ecriture (table de 4). Repli local si hors ligne. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const REST_LABEL = { court: 'repos court', long: 'repos long', aube: 'aube', ws: 'repos court (1), long (tout)' };
  const ACTS = ['Action', 'Action bonus', 'Réaction', 'Hors combat'];
  let CFG = null, root = null, sb = null, online = false, chan = null, tick = null;
  let ST = {}, EV = [];
  const view = { mode: 'pick', char: null, tab: null, q: '', act: 'all', gopen: null, open: null, cast: null, confirm: null, filterChar: 'all', fromDM: false, pool: {}, heal: null };

  let GL = null, GX = null;
  const nrm0 = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function buildGlossary(g) {
    GL = {}; const parts = [];
    g.terms.forEach(t => { GL[t.id] = t; parts.push({ id: t.id, rx: t.rx, i: true }); });
    g.spells.forEach(t => { GL[t.id] = t; parts.push({ id: t.id, rx: [t.fr, t.en].filter((x, k, a) => a.indexOf(x) === k).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), i: false }); });
    const ci = parts.filter(x => x.i), cs = parts.filter(x => !x.i);
    const mk = (arr, f) => new RegExp('(?<![\\p{L}\\p{N}])(?:' + arr.map((x, k) => '(?<g' + k + '>' + x.rx + ')').join('|') + ')(?![\\p{L}\\p{N}])', f);
    GX = [{ re: mk(ci, 'giu'), arr: ci }, { re: mk(cs, 'gu'), arr: cs }];
  }
  function rich(text, selfId) {
    text = String(text == null ? '' : text);
    if (!GX) return esc(text);
    const hits = [];
    GX.forEach(({ re, arr }) => { re.lastIndex = 0; let m; while ((m = re.exec(text))) { const k = arr.findIndex((x, j) => m.groups['g' + j] != null); if (k < 0) continue; hits.push({ a: m.index, b: m.index + m[0].length, id: arr[k].id }); if (m[0].length === 0) re.lastIndex++; } });
    hits.sort((x, y) => x.a - y.a || (y.b - y.a) - (x.b - x.a));
    let out = '', pos = 0;
    for (const h of hits) {
      if (h.a < pos || h.id === selfId) continue;
      out += esc(text.slice(pos, h.a)) + `<button type="button" class="lp-kw ${GL[h.id].kind}" data-act="kw" data-id="${esc(h.id)}" data-tip="k|${esc(h.id)}">${esc(text.slice(h.a, h.b))}</button>`;
      pos = h.b;
    }
    return out + esc(text.slice(pos));
  }
  function popup() {
    const g = view.pop && GL && GL[view.pop]; if (!g) return '';
    const paras = t => String(t).split('\n').map(l => /^[•]/.test(l) ? `<p class="b">${rich(l, g.id)}</p>` : `<p>${rich(l, g.id)}</p>`).join('');
    const meta = g.kind === 'sort' ? `<p class="lp-pm">${g.lvl ? 'Niveau ' + g.lvl : 'Sort mineur'}<i class="gap"></i>${esc(g.school)}<i class="gap"></i>${esc(g.cast)}<i class="gap"></i>Portée ${esc(g.range)}<i class="gap"></i>${esc(g.comp)}<i class="gap"></i>${esc(g.dur)}</p>` : '<p class="lp-pm">État</p>';
    return `<div class="lp-ov" data-act="kwx"><div class="lp-pop" role="dialog" aria-modal="true"><button type="button" class="lp-px" data-act="kwx" aria-label="Fermer">×</button>
      <h3>${esc(g.fr)}</h3><span class="lp-en">${esc(g.en)}</span>${meta}${paras(g.text)}${g.hl ? `<p class="lp-hl">${esc(g.hl)}</p>` : ''}<p class="lp-src">${esc(g.src || '')}</p></div></div>`;
  }
  const cfgOf = id => CFG.chars.find(c => c.id === id);
  const localKey = id => 'lp_state_' + id;
  const total = (c, lv) => c.slots[lv] || 0;
  const used = (st, lv) => st.slots[lv] || 0;
  const resOf = (c, id) => c.resources.find(r => r.id === id);
  const left = (c, st, id) => resOf(c, id).max - (st.res[id] || 0);
  const equipables = c => (c.weapons || []).filter(w => !w.fixed).map(w => w.n).concat((c.gear || []).map(g => g.n));
  const permas = c => (c.weapons || []).filter(w => w.perma).map(w => w.n);
  const isEq = (c, st, name) => !name || !equipables(c).includes(name) || permas(c).includes(name) || (st.eq || []).includes(name);
  const visRes = (c, st) => c.resources.filter(r => isEq(c, st, r.src));
  const eqNames = (c, st) => permas(c).concat((st.eq || []).filter(n => equipables(c).includes(n) && !permas(c).includes(n)));


  /* ---------- v151 : aides (icones, jets, CA, vitesse, infobulles) ---------- */
  const ICO = {
    'Action': '<svg class="ico a" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/></svg>',
    'Action bonus': '<svg class="ico b" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 L14.5 13.5 H1.5 Z"/></svg>',
    'Réaction': '<svg class="ico r" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 L9.7 6.3 L15 8 L9.7 9.7 L8 15 L6.3 9.7 L1 8 L6.3 6.3 Z"/></svg>'
  };
  const ico = t => ICO[t] || '';
  const im = (n, cl) => `<img class="uic ${cl || ''}" src="img/ui/${n}.png" alt="" width="20" height="20" decoding="async">`;
  const RIC = { bardic: 'bardic', sup: 'superiority', ws: 'wildshape' };
  const SV = {
    ca: '<svg class="si" viewBox="0 0 16 16"><path d="M8 1.5l5.5 2v4.2c0 3.3-2.3 5.6-5.5 6.8C4.8 13.3 2.5 11 2.5 7.7V3.5z"/></svg>',
    vit: '<svg class="si" viewBox="0 0 16 16"><path d="M2 3l5 5-5 5M8 3l5 5-5 5" fill="none" stroke-width="1.8"/></svg>',
    ini: '<svg class="si" viewBox="0 0 16 16"><path d="M9.5 1L3 9h4l-1 6 7-9H9z"/></svg>',
    per: '<svg class="si" viewBox="0 0 16 16"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" fill="none" stroke-width="1.5"/><circle cx="8" cy="8" r="2"/></svg>',
    mai: '<svg class="si" viewBox="0 0 16 16"><path d="M8 1l2 4.5 5 .5-3.7 3.3 1.1 5L8 11.8 3.6 14.3l1.1-5L1 6l5-.5z"/></svg>',
    dd: '<svg class="si" viewBox="0 0 16 16"><path d="M8 1l6 3.5v7L8 15l-6-3.5v-7z" fill="none" stroke-width="1.5"/><circle cx="8" cy="8" r="1.6"/></svg>',
    att: '<svg class="si" viewBox="0 0 16 16"><path d="M8 1l1.6 5.4L15 8l-5.4 1.6L8 15l-1.6-5.4L1 8l5.4-1.6z"/></svg>'
  };
  const typeOfPw = a => a === 'B' ? 'Action bonus' : a === 'R' ? 'Réaction' : 'Action';
  const dcify = (c, t) => String(t == null ? '' : t).replace(/([Jj]et d(?:e |')(?:FOR|DEX|CON|INT|SAG|CHA))(?!\s*\(?DD)/g, `$1 (DD ${c.dc})`);
  const rd = n => 1 + Math.floor(Math.random() * n);
  const UP = { 'hellish rebuke': '1d10', 'thunderwave': '1d8', 'heat metal': '1d8', 'dissonant whispers': '1d6', 'vampiric touch': '1d6', 'flaming sphere': '1d6', 'mind spike': '1d8', 'burning hands': '1d6', 'blight': '1d8', 'staggering smite': '1d6', 'moonbeam': '1d10', 'call lightning': '1d10', 'ice knife': '1d6', 'armor of agathys': '' };
  const coinsDef = [['pp', 'Platine', 'PP'], ['gp', 'Or', 'PO'], ['ist', "Monnaie d'Istra", 'MI'], ['sp', 'Argent', 'PA'], ['cp', 'Cuivre', 'PC']];
  const gpOf = st => ((st.coins || {}).gp) || 0;
  function poolLvl(c, sp, cur) {
    if (!cur) return sp.lv;
    if (cur.k === 'pact') return c.pact.lvl;
    if (/^\d+$/.test(cur.k)) return +cur.k;
    return sp.lv;
  }
  function spellDice(c, sp, lvl) {
    if (sp.heal) { const h = sp.heal, n = h.n + h.pn * Math.max(0, lvl - h.base); return { n, f: h.d, flat: h.b, mult: 1, heal: true }; }
    const m = /(\d+)d(\d+)(?:\s*\+\s*(\d+)(?!\d|d))?/.exec(sp.d || ''); if (!m) return null;
    let n = +m[1], f = +m[2], flat = +(m[3] || 0), mult = 1;
    const ray = /(\d+) rayons/.exec(sp.d), dart = /(\d+) fléchettes/.exec(sp.d);
    if (ray) mult = +ray[1]; if (dart) mult = +dart[1] + Math.max(0, lvl - sp.lv);
    if (sp.lv > 0 && lvl > sp.lv) {
      const u = /\+\s*(\d+)d(\d+)\s*par niveau/.exec(sp.d), t = UP[(sp.en || '').toLowerCase()];
      const x = u ? { n: +u[1], f: +u[2] } : t ? { n: +t.split('d')[0], f: +t.split('d')[1] } : null;
      if (x && x.f === f) n += x.n * (lvl - sp.lv);
    }
    return { n, f, flat, mult, heal: /récup|soin|PV\b/i.test(sp.d) && !/dégât|force|feu|froid|foudre|tonnerre|nécro|psych|radiant|poison|acide|contondant|perçant|tranchant/i.test(sp.d) };
  }
  const diceStr = x => `${x.n * x.mult}d${x.f}${x.flat ? '+' + x.flat * x.mult : ''}`;
  function rollSum(x) { const rs = []; for (let i = 0; i < x.n * x.mult; i++) rs.push(rd(x.f)); return { tot: rs.reduce((a, b) => a + b, 0) + x.flat * x.mult, rs }; }
  function rollStr(str) {
    const rx = /(\d+)d(\d+)(?:\s*\+\s*(\d+)(?!\d|d))?/g; let m, tot = 0; const det = [];
    while ((m = rx.exec(str || ''))) { const r = rollSum({ n: +m[1], f: +m[2], flat: +(m[3] || 0), mult: 1 }); tot += r.tot; det.push(`${m[0].replace(/\s/g, '')} [${r.rs.join(', ')}]`); }
    return det.length ? { tot, det: det.join(' + ') } : null;
  }
  const signed = n => (n >= 0 ? '+' : '') + n;
  function showRoll(id, title, lines, label, big) { view.roll = { char: id, title, lines, big: big == null ? '' : big }; return say(id, label || `${title} : ${lines.join(', ')}`, 'roll'); }
  function atkLine(mod) { const r = rd(20); return { txt: `Toucher ${r + mod} (d20 ${r}${signed(mod)})`, nat: r, tot: r + mod }; }
  function canJet(c, sp) { return !sp.thp && !!(sp.atk || /attaque de sort/i.test(sp.d || '') || spellDice(c, sp, sp.lv)); }
  function jetSpell(id, sp) {
    const c = cfgOf(id), st = S(id), pk = pickPool(c, st, sp), lvl = poolLvl(c, sp, pk.cur), L = []; let big = null;
    if (sp.atk || /attaque de sort/i.test(sp.d)) { const a = atkLine(c.atk); L.push(a.txt + (a.nat === 20 ? ' (critique)' : '')); big = a.tot; }
    const x = spellDice(c, sp, lvl); if (x) { const r = rollSum(x); L.push(`${x.heal ? 'Soins' : 'Dégâts'} ${r.tot} (${diceStr(x)} [${r.rs.join(', ')}])`); big = r.tot; }
    if (!L.length) return toast('Pas de jet pour ce sort');
    return showRoll(id, `${sp.n}${lvl ? ' niveau ' + lvl : ''}`, L, null, big);
  }
  function jetWeapon(id, name, kind) {
    const c = cfgOf(id), w = c.weapons.find(x => x.n === name); if (!w) return;
    if (kind === 'hit') { const mod = parseInt(w.hit, 10) || 0, a = atkLine(mod); return showRoll(id, w.n, [a.txt + (a.nat === 20 ? ' (critique)' : a.nat === 1 ? ' (échec critique)' : '')], null, a.tot); }
    const r = rollStr(w.dmg); if (!r) { const f = parseInt(w.dmg, 10); if (!f) return toast('Pas de dégâts à lancer'); return showRoll(id, w.n, [`Dégâts ${f}`], null, f); }
    return showRoll(id, w.n, [`Dégâts ${r.tot} (${r.det})`], null, r.tot);
  }
  function jetPw(id, wn, i) {
    const c = cfgOf(id), w = c.weapons.find(x => x.n === wn), o = w && w.pw[i]; if (!o || !o.r) return toast('Pas de jet');
    const r = rollStr(o.r); return showRoll(id, `${w.n} : ${o.n}`, [`${r.tot} (${r.det})`], null, r.tot);
  }
  function jetItem(id, iid) {
    const c = cfgOf(id), st = S(id), it = st.items.find(x => x.id === iid), cat = it && (c.items || []).find(x => x.n === it.n); if (!cat || !cat.roll) return toast('Pas de jet');
    const r = rollStr(cat.roll); return showRoll(id, it.n, [`${r.tot} (${r.det})`], null, r.tot);
  }
  function acOf(c, st) {
    const f = c.acfx; if (!f) return { v: c.ca, parts: [] };
    let base = f.un, bn = 'Sans armure'; (f.base || []).forEach(([n, v]) => { if (isEq(c, st, n) && v > base) { base = v; bn = n; } });
    const parts = [`${bn} ${base}`]; let add = 0;
    (f.add || []).forEach(([n, v]) => { if (isEq(c, st, n)) { add += v; parts.push(`${n} +${v}`); } });
    if (st.hp <= c.hp / 2) (f.bloody || []).forEach(([n, v]) => { if (bn === n) { add += v; parts.push(`${n} (blessé) +${v}`); } });
    return { v: base + add, parts };
  }
  function spdOf(c, st) {
    const f = c.spd || { base: 30, add: [] }; let v = f.base; const parts = [`base ${f.base}`];
    (f.add || []).forEach(([n, x]) => { if (isEq(c, st, n)) { v += x; parts.push(`${n} +${x}`); } });
    return { v, parts };
  }
  const featType = f => /action bonus/i.test(f.d) ? 'Action bonus' : /réaction/i.test(f.d) ? 'Réaction' : /^action\b|en action\b/i.test(f.d) ? 'Action' : '';

  /* infobulles et fenetres */
  const nl = t => esc(t).replace(/\n/g, '<br>');
  function spellBody(c, sp, st) {
    const g = sp.gid && GL && GL[sp.gid];
    let h = `<h3>${esc(sp.n)}</h3>${sp.en ? `<span class="lp-en">${esc(sp.en)}</span>` : ''}<p class="lp-pm">${sp.lv ? 'Niveau ' + sp.lv : 'Sort mineur'}<i class="gap"></i>${esc(sp.t)}${sp.p ? '<i class="gap"></i>' + esc(sp.p) : ''}${sp.c ? '<i class="gap"></i>Concentration' : ''}</p>`;
    h += g ? String(g.text).split('\n').map(l => `<p>${nl(dcify(c, l))}</p>`).join('') : `<p>${nl(dcify(c, sp.d))}</p>`;
    if (st && sp.lv >= 0) { const pk = pickPool(c, st, sp), lv = poolLvl(c, sp, pk.cur), x = spellDice(c, sp, lv); if (x && sp.lv > 0 && lv > sp.lv) h += `<p class="lp-hl">Au niveau ${lv} : ${diceStr(x)}</p>`; }
    return h;
  }
  function tipHtml(spec) {
    const [k, a, b] = spec.split('|'), c = view.char && cfgOf(view.char); let h = '';
    if (k === 'k' && GL && GL[a]) { const g = GL[a]; h = `<h3>${esc(g.fr)}</h3>${g.en ? `<span class="lp-en">${esc(g.en)}</span>` : ''}${String(g.text).split('\n').map(l => `<p>${nl(l)}</p>`).join('')}`; }
    else if (c && k === 's') { const sp = c.spells.find(x => x.n === a); if (sp) h = spellBody(c, sp, S(c.id)); }
    else if (c && k === 'p') { const w = c.weapons.find(x => x.n === a), o = w && w.pw[+b]; if (o) h = `<h3>${esc(o.n)}</h3><p class="lp-pm">${ico(typeOfPw(o.a))} ${esc(typeOfPw(o.a))}<i class="gap"></i>${esc(w.n)}</p><p>${nl(dcify(c, o.d))}</p>`; }
    else if (c && k === 'f') { const f = (c.feats || [])[+a]; if (f) h = `<h3>${esc(f.n)}</h3>${f.en ? `<span class="lp-en">${esc(f.en)}</span>` : ''}<p>${nl(dcify(c, f.d))}</p>`; }
    return h;
  }
  function showTip(el) {
    const t = root.querySelector('.lp-tip'); if (!t) return; const h = tipHtml(el.dataset.tip); if (!h) return hideTip();
    t.innerHTML = h; t.classList.add('on');
    const r = el.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    let x = Math.min(Math.max(8, r.left), vw - tw - 8), y = r.bottom + 8; if (y + th > vh - 8) y = Math.max(8, r.top - th - 8);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function hideTip() { const t = root && root.querySelector('.lp-tip'); if (t) t.classList.remove('on'); }
  function popupX() {
    const c = view.char && cfgOf(view.char); if (!c) return '';
    let body = '';
    if (view.popsp) { const sp = c.spells.find(x => x.n === view.popsp); if (sp) body = spellBody(c, sp, S(c.id)); }
    else if (view.poppw) { const w = c.weapons.find(x => x.n === view.poppw[0]), o = w && w.pw[view.poppw[1]]; if (o) body = `<h3>${esc(o.n)}</h3><p class="lp-pm">${ico(typeOfPw(o.a))} ${esc(typeOfPw(o.a))}<i class="gap"></i>${esc(w.n)}</p><p>${nl(dcify(c, o.d))}</p>`; }
    if (!body) return '';
    return `<div class="lp-ov" data-act="kwx"><div class="lp-pop" role="dialog" aria-modal="true"><button type="button" class="lp-px" data-act="kwx" aria-label="Fermer">×</button>${body}</div></div>`;
  }
  const rollBanner = () => view.roll && view.roll.char === view.char ? `<div class="lp-rollb" role="status"><div class="n">${esc(view.roll.big)}</div><div class="t"><b>${esc(view.roll.title)}</b>${view.roll.lines.map(l => `<span>${esc(l)}</span>`).join('')}</div><button type="button" data-act="rollx" aria-label="Fermer">×</button></div>` : '';

  /* ---------- etat ---------- */
  function fresh(c) { return { hp: c.hp, tmp: 0, slots: {}, pact: 0, res: {}, gold: 0, conc: null, prep: null, eq: null, items: [], used: {}, rev: 0 }; }
  function norm(c, s) {
    const o = Object.assign(fresh(c), s || {});
    o.slots = o.slots || {}; o.res = o.res || {}; o.used = o.used || {}; if (!Array.isArray(o.items)) o.items = [];
    if (!Array.isArray(o.eq)) o.eq = (c.eqDefault || []).slice();
    const lsn = c.spells.filter(x => x.lst).map(x => x.n);
    if (!o.gv) { const old = Array.isArray(s && s.prep) ? s.prep : []; o.prep = c.spells.filter(x => x.lst && x.pre).map(x => x.n).concat(old.filter(n => lsn.includes(n))); o.prep = o.prep.filter((n, i, a) => a.indexOf(n) === i); o.gv = 150; }
    if (!Array.isArray(o.prep)) o.prep = [];
    if (!o.seeded) { const seed = (c.items || []).map((it, i) => ({ id: 's' + i, n: it.n, qty: it.qty || 1, max: it.max || 0, used: it.used || 0, note: it.note || '' })); o.items = seed.concat(o.items); o.res = Object.assign({}, (c.init || {}).res || {}, o.res); o.seeded = 1; }
    if (!o.coins) o.coins = { pp: 0, gp: o.gold || 0, ist: 0, sp: 0, cp: 0 };
    permas(c).forEach(n => { if (!o.eq.includes(n)) o.eq.push(n); });
    return o;
  }
  const S = id => (ST[id] = norm(cfgOf(id), ST[id]));

  async function save(id, ev) {
    const st = S(id);
    const actor = view.fromDM ? 'dm' : 'player';
    try { localStorage.setItem(localKey(id), JSON.stringify(st)); } catch (e) { /* ignore */ }
    if (ev) { EV.unshift({ at: new Date().toISOString(), char_id: id, actor, kind: ev.kind || 'action', label: ev.label, payload: {} }); EV = EV.slice(0, 80); }
    render();
    if (!online) return;
    try {
      const { data, error } = await sb.rpc('lp_save', { p_char: id, p_state: st, p_event: ev ? { kind: ev.kind || 'action', label: ev.label } : null, p_actor: actor });
      if (error) throw error;
      st.rev = data;
    } catch (e) { toast('Sauvegarde impossible : ' + (e.message || e)); }
  }
  const say = (id, label, kind) => save(id, { label, kind });

  function toast(msg) {
    const t = root && root.querySelector('.lp-toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 3500);
  }

  /* ---------- connexion ---------- */
  function loadLib() {
    return new Promise((res, rej) => {
      if (window.supabase) return res();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      s.onload = res; s.onerror = () => rej(new Error('lib'));
      document.head.appendChild(s);
      setTimeout(() => rej(new Error('timeout')), 6000);
    });
  }
  async function connect() {
    try {
      await loadLib();
      sb = window.supabase.createClient(CFG.supabase.url, CFG.supabase.key, { auth: { persistSession: false } });
      const { data, error } = await sb.from('characters').select('*');
      if (error) throw error;
      data.forEach(r => { if (cfgOf(r.id)) ST[r.id] = norm(cfgOf(r.id), Object.assign({}, r.state, { rev: r.rev })); });
      const ev = await sb.from('events').select('*').order('at', { ascending: false }).limit(80);
      EV = ev.data || [];
      chan = sb.channel('lp-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, p => {
          const r = p.new; if (!r || !cfgOf(r.id)) return;
          if (ST[r.id] && ST[r.id].rev >= r.rev) return;
          ST[r.id] = norm(cfgOf(r.id), Object.assign({}, r.state, { rev: r.rev })); render();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, p => {
          const e = p.new; if (!e || EV.some(x => x.id && x.id === e.id)) return;
          if (EV.some(x => !x.id && x.label === e.label && x.char_id === e.char_id && Math.abs(new Date(x.at) - new Date(e.at)) < 6000)) return;
          EV.unshift(e); EV = EV.slice(0, 80); render();
        })
        .subscribe();
      online = true;
    } catch (e) { online = false; }
    CFG.chars.forEach(c => {
      if (!online || !ST[c.id]) { try { const l = JSON.parse(localStorage.getItem(localKey(c.id)) || 'null'); if (l && !online) ST[c.id] = norm(c, l); } catch (e) { /* ignore */ } }
      S(c.id);
    });
  }

  /* ---------- actions ---------- */
  function togglePip(id, kind, key, idx) {
    const c = cfgOf(id), st = S(id);
    if (kind === 'slot') {
      const u = used(st, key), spend = idx >= total(c, key) - u;
      st.slots[key] = Math.max(0, Math.min(total(c, key), u + (spend ? 1 : -1)));
      if (st.slots[key] === u) return;
      return say(id, `${spend ? 'Dépense' : 'Récupère'} un emplacement de niveau ${key} (reste ${total(c, key) - st.slots[key]}/${total(c, key)})`, 'slot');
    }
    if (kind === 'pact') {
      const n = c.pact.n, spend = idx >= n - st.pact, before = st.pact;
      st.pact = Math.max(0, Math.min(n, st.pact + (spend ? 1 : -1)));
      if (st.pact === before) return;
      return say(id, `${spend ? 'Dépense' : 'Récupère'} un emplacement de pacte (reste ${n - st.pact}/${n})`, 'slot');
    }
    return resDelta(id, key, idx >= resOf(c, key).max - (st.res[key] || 0) ? 1 : -1);
  }
  function resDelta(id, key, d) {
    const c = cfgOf(id), st = S(id), r = resOf(c, key), u = st.res[key] || 0;
    st.res[key] = Math.max(0, Math.min(r.max, u + d));
    if (st.res[key] === u) return;
    return say(id, `${d > 0 ? 'Utilise' : 'Récupère'} ${r.nom} (reste ${r.max - st.res[key]}/${r.max})`, 'res');
  }
  function hpAct(id, type, amt) {
    const c = cfgOf(id), st = S(id); amt = Math.max(0, Math.floor(+amt || 0)); if (!amt) return;
    if (type === 'dmg') {
      let rest = amt; const t = Math.min(st.tmp, rest); st.tmp -= t; rest -= t; st.hp = Math.max(0, st.hp - rest);
      return say(id, `Subit ${amt} dégâts (${st.hp}/${c.hp} PV${st.tmp ? ', ' + st.tmp + ' temp' : ''})`, 'hp');
    }
    if (type === 'heal') { st.hp = Math.min(c.hp, st.hp + amt); return say(id, `Récupère ${amt} PV (${st.hp}/${c.hp})`, 'hp'); }
    st.tmp = Math.max(st.tmp, amt); return say(id, `PV temporaires : ${st.tmp}`, 'hp');
  }
  function coinAct(id, key, val) {
    const st = S(id), v = Math.max(0, Math.floor(+val || 0)), old = st.coins[key] || 0; if (v === old) return;
    st.coins[key] = v; const nm = (coinsDef.find(x => x[0] === key) || [0, key])[1];
    return say(id, `${nm} : ${old} vers ${v}`, 'gold');
  }
  function roll(expr) {
    const m = /^(\d+)d(\d+)(?:\+(\d+))?$/.exec(expr || ''); if (!m) return 0;
    let t = +(m[3] || 0); for (let i = 0; i < +m[1]; i++) t += 1 + Math.floor(Math.random() * +m[2]); return t;
  }
  function rest(id, type) {
    const c = cfgOf(id), st = S(id), notes = [];
    c.resources.forEach(r => {
      const u = st.res[r.id] || 0;
      if (type === 'court') {
        if (r.reset === 'court') st.res[r.id] = 0;
        else if (r.reset === 'ws') st.res[r.id] = Math.max(0, u - 1);
      } else if (r.regen) {
        const g = roll(r.regen); st.res[r.id] = Math.max(0, u - g); if (u) notes.push(`${r.nom} +${Math.min(g, u)}`);
      } else st.res[r.id] = 0;
    });
    if (c.pact) st.pact = 0;
    st.items.forEach(it => { if (it.max && type === 'long') it.used = 0; });
    if (type === 'long') { st.slots = {}; st.hp = c.hp; st.tmp = 0; st.conc = null; st.used = {}; }
    view.confirm = null;
    return say(id, type === 'long' ? 'Repos long' + (notes.length ? ' (' + notes.join(', ') + ')' : '') : 'Repos court', 'rest');
  }

  function poolsFor(c, st, sp) {
    const out = [];
    if (sp.lim && st.used[sp.n]) return out;
    if (sp.cost) {
      const r = resOf(c, sp.cost.res), l = left(c, st, sp.cost.res);
      if (l >= sp.cost.n) out.push({ k: 'cost', s: `${sp.cost.n} charge${sp.cost.n > 1 ? 's' : ''}`, label: `${sp.cost.n} charge${sp.cost.n > 1 ? 's' : ''} : ${r.nom} (reste ${l})` });
      return out;
    }
    if (sp.res && left(c, st, sp.res) > 0) out.push({ k: 'free', s: 'Usage gratuit', label: 'Usage gratuit : ' + resOf(c, sp.res).nom });
    if (sp.alt && left(c, st, sp.alt.res) >= sp.alt.n) out.push({ k: 'alt', s: 'Ressource', label: 'Dépenser : ' + resOf(c, sp.alt.res).nom });
    if (sp.lv === 0) { if (!sp.res) out.push({ k: 'cantrip', s: 'Gratuit', label: 'Sort mineur (gratuit)' }); return out; }
    if (!sp.pactonly) Object.keys(c.slots).map(Number).sort((a, b) => a - b).forEach(lv => {
      const l = total(c, lv) - used(st, lv);
      if (lv >= sp.lv && l > 0) out.push({ k: String(lv), s: `Niveau ${lv} (${l} restant${l > 1 ? 's' : ''})`, label: `Emplacement niveau ${lv} (${l} restant${l > 1 ? 's' : ''})` });
    });
    if (c.pact && c.pact.lvl >= sp.lv && c.pact.n - st.pact > 0) { const l = c.pact.n - st.pact; out.push({ k: 'pact', s: `Pacte niveau ${c.pact.lvl} (${l} restant${l > 1 ? 's' : ''})`, label: `Pacte niveau ${c.pact.lvl} (${l} restant${l > 1 ? 's' : ''})` }); }
    return out;
  }
  function pickPool(c, st, sp) {
    const ps = poolsFor(c, st, sp), want = view.pool[sp.n];
    return { ps, cur: ps.find(p => p.k === want) || ps[0] };
  }
  function cast(id, sp, pool) {
    const c = cfgOf(id), st = S(id); let cost = '', lvl = sp.lv;
    if (pool === 'free') { st.res[sp.res] = (st.res[sp.res] || 0) + 1; cost = resOf(c, sp.res).nom; }
    else if (pool === 'alt') { st.res[sp.alt.res] = (st.res[sp.alt.res] || 0) + sp.alt.n; cost = resOf(c, sp.alt.res).nom; }
    else if (pool === 'cost') { st.res[sp.cost.res] = (st.res[sp.cost.res] || 0) + sp.cost.n; cost = `${sp.cost.n} charge${sp.cost.n > 1 ? 's' : ''} ${resOf(c, sp.cost.res).nom}`; }
    else if (pool === 'pact') { st.pact += 1; lvl = c.pact.lvl; cost = `pacte niveau ${lvl}`; }
    else if (pool !== 'cantrip') { st.slots[pool] = used(st, pool) + 1; lvl = +pool; cost = `emplacement niveau ${pool}`; }
    if (sp.lim) st.used[sp.n] = 1;
    let extra = '';
    if (sp.c) { if (st.conc && st.conc !== sp.n) extra = `, abandonne ${st.conc}`; st.conc = sp.n; }
    if (sp.thp) { const a = sp.thp.b + sp.thp.per * Math.max(0, lvl - sp.thp.base); if (a > st.tmp) st.tmp = a; extra += `, ${a} PV temporaires`; }
    if (sp.heal) {
      const h = sp.heal, n = h.n + h.pn * Math.max(0, lvl - h.base);
      let tot = h.b; for (let i = 0; i < n; i++) tot += 1 + Math.floor(Math.random() * h.d);
      view.heal = { char: id, amt: tot, name: sp.n }; extra += `, soin de ${tot} PV`;
    }
    return say(id, `Lance ${sp.n}${cost ? ' (' + cost + ')' : ''}${extra}${sp.c ? ', concentration' : ''}`, 'spell');
  }
  function toggleEq(id, name) {
    const st = S(id), c = cfgOf(id), on = st.eq.includes(name);
    if (permas(c).includes(name)) return toast('Équipée en permanence');
    if (!on && c.eqExcl && (c.weapons || []).some(w => w.n === name)) { const ws = (c.weapons || []).map(w => w.n); st.eq = st.eq.filter(x => !ws.includes(x) || permas(c).includes(x)); }
    st.eq = on ? st.eq.filter(x => x !== name) : st.eq.concat(name);
    return say(id, `${on ? 'Range' : 'Équipe'} ${name}`, 'eq');
  }
  function itemAct(id, a, d) {
    const st = S(id);
    if (a === 'add') {
      const q = x => (root.querySelector(x) || {}).value || '';
      const n = q('#lp-in-n').trim(); if (!n) return toast('Donne un nom à l\'objet');
      const max = Math.max(0, Math.floor(+q('#lp-in-c') || 0));
      st.items.push({ id: 'i' + Date.now().toString(36), n, qty: Math.max(1, Math.floor(+q('#lp-in-q') || 1)), max, used: 0 });
      ['#lp-in-n', '#lp-in-q', '#lp-in-c'].forEach(x => { const e = root.querySelector(x); if (e) e.value = ''; });
      return say(id, `Ajoute l'objet ${n}${max ? ' (' + max + ' charges)' : ''}`, 'item');
    }
    const it = st.items.find(x => x.id === d.id); if (!it) return;
    if (a === 'use') { if (it.max) { if (it.used >= it.max) return; it.used++; return say(id, `Utilise ${it.n} (${it.max - it.used}/${it.max})`, 'item'); } if (it.qty <= 0) return; it.qty--; return say(id, `Utilise ${it.n} (reste ${it.qty})`, 'item'); }
    if (a === 'qty') { it.qty = Math.max(0, it.qty + d.d); return say(id, `${it.n} : ${it.qty}`, 'item'); }
    if (a === 'chg') { it.used = Math.max(0, Math.min(it.max, it.used + d.d)); return say(id, `${it.n} : ${it.max - it.used}/${it.max} charges`, 'item'); }
    if (a === 'del') { st.items = st.items.filter(x => x.id !== d.id); return say(id, `Retire l'objet ${it.n}`, 'item'); }
  }

  /* ---------- rendu : briques ---------- */
  const pips = (n, u, kind, key, cls) => {
    let h = '';
    for (let i = 0; i < n; i++) h += `<button type="button" class="lp-pip ${cls || ''} ${i >= n - u ? 'used' : ''}" data-act="pip" data-kind="${kind}" data-key="${esc(key)}" data-idx="${i}" aria-label="${esc(key)} ${i >= n - u ? 'utilisé' : 'disponible'}"></button>`;
    return h;
  };
  const rpips = (n, u, cls) => { let h = ''; for (let i = 0; i < n; i++) h += `<span class="lp-pip ro ${cls || ''} ${i >= n - u ? 'used' : ''}"></span>`; return h; };

  function hpBar(c, st) {
    const p = Math.max(0, Math.min(100, st.hp / c.hp * 100));
    return `<div class="lp-hpbar ${p > 50 ? 'ok' : p > 25 ? 'mid' : 'low'}"><i style="width:${p}%"></i></div>`;
  }
  function tmpBar(c, st) {
    const t = Math.max(0, Math.min(100, st.tmp / Math.max(10, c.hp / 3) * 100));
    return `<div class="lp-tbar ${st.tmp ? 'on' : ''}"><i style="width:${t}%"></i></div>`;
  }
  function slotRows(c, st, ro) {
    let h = Object.keys(c.slots).sort((a, b) => a - b).map(l => `<div class="lp-row"><span class="lp-lv">Niv. ${l}</span><span class="lp-pips">${ro ? rpips(total(c, l), used(st, l)) : pips(total(c, l), used(st, l), 'slot', l)}</span></div>`).join('');
    if (c.pact) h += `<div class="lp-row"><span class="lp-lv pact">${im('pact')}Pacte ${c.pact.lvl}</span><span class="lp-pips">${ro ? rpips(c.pact.n, st.pact, 'pact') : pips(c.pact.n, st.pact, 'pact', 'pact', 'pact')}</span></div>`;
    return h;
  }
  function resRows(c, st, ro) {
    const rows = visRes(c, st).map(r => {
      const u = st.res[r.id] || 0, l = r.max - u;
      let ctl;
      if (r.max <= 5) ctl = ro ? rpips(r.max, u, 'res') : pips(r.max, u, 'res', r.id, 'res');
      else ctl = ro ? `<b class="lp-cnt">${l}/${r.max}</b>` : `<button type="button" class="lp-stp" data-act="resd" data-key="${esc(r.id)}" data-d="1" aria-label="Dépenser">−</button><b class="lp-cnt">${l}/${r.max}</b><button type="button" class="lp-stp" data-act="resd" data-key="${esc(r.id)}" data-d="-1" aria-label="Récupérer">+</button>`;
      return `<div class="lp-row res"><span class="lp-nm">${RIC[r.id] ? im(RIC[r.id]) : ''}${esc(r.nom)}${!ro && r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span><span class="lp-pips">${ctl}</span></div>`;
    });
    return rows.join('');
  }

  function costBadge(c, sp) {
    if (sp.cost) return `<span class="lp-cb ch">${sp.cost.n} charge${sp.cost.n > 1 ? 's' : ''}</span>`;
    if (sp.lv === 0 && !sp.res) return '<span class="lp-cb">Gratuit</span>';
    if (sp.lv === 0) return '<span class="lp-cb free">1 / jour</span>';
    return `<span class="lp-cb">Niv. ${sp.lv}</span>`;
  }
  function spellCard(c, st, sp) {
    const key = sp.n, conc = st.conc === key;
    const { ps, cur } = pickPool(c, st, sp), spent = ps.length === 0, limUsed = sp.lim && st.used[sp.n];
    const tags = [sp.c ? '<span class="lp-tag c">Concentration</span>' : '', sp.ritual ? '<span class="lp-tag">Rituel</span>' : '', (sp.lim || (sp.res && sp.lv)) ? '<span class="lp-tag day">1 / jour</span>' : '', sp.src ? `<span class="lp-tag src">${esc(sp.src)}</span>` : ''].join('');
    let src;
    if (spent) src = `<span class="lp-slotchip off">${limUsed ? 'Utilisé' : 'Aucune ressource'}</span>`;
    else if (ps.length > 1) src = `<label class="lp-slotsel"><span>Lancer avec</span><select class="lp-pool" data-sp="${esc(key)}" aria-label="Source du sort">${ps.map(p => `<option value="${esc(p.k)}" ${cur.k === p.k ? 'selected' : ''}>${esc(p.s)}</option>`).join('')}</select></label>`;
    else src = `<span class="lp-slotchip">${esc(cur.s)}</span>`;
    const btn = spent ? '<button type="button" class="lp-cast off" disabled>Lancer</button>' : `<button type="button" class="lp-cast" data-act="cast" data-key="${esc(key)}">Lancer</button>`;
    const jet = canJet(c, sp) ? `<button type="button" class="lp-jet" data-act="jetsp" data-key="${esc(key)}" title="Jet automatique" ${spent ? 'disabled' : ''}>Jet</button>` : '';
    let h = `<article class="lp-spell ${conc ? 'conc' : ''} ${spent ? 'spent' : ''}">
      <div class="lp-sh"><button type="button" class="lp-sname" data-act="gopen" data-key="${esc(key)}" data-tip="s|${esc(key)}"><span class="lp-tt">${ico(sp.t)}<b>${esc(sp.n)}</b></span>${sp.en ? `<small class="lp-en">${esc(sp.en)}</small>` : ''}<span class="lp-meta"><span>${esc(sp.t)}</span>${sp.p ? `<span>${esc(sp.p)}</span>` : ''}</span></button><span class="lp-spr">${src}<span class="lp-btns">${btn}${jet}</span></span></div>
      ${tags ? `<div class="lp-tags">${tags}</div>` : ''}`;
    if (limUsed) h += `<button type="button" class="lp-full" data-act="unspend" data-key="${esc(key)}">Restaurer ce sort</button>`;
    return h + '</article>';
  }
  function spellsPanel(c, st) {
    const q = view.q.trim().toLowerCase(), nrm = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), nq = nrm(q);
    const prepared = n => (st.prep || []).includes(n);
    let hidden = 0;
    const list = c.spells.filter(s => {
      if (!isEq(c, st, s.src)) { hidden++; return false; }
      if (s.lst && !prepared(s.n)) return false;
      if (view.act !== 'all' && s.t !== view.act) return false;
      return !nq || nrm(s.n + ' ' + (s.en || '') + ' ' + s.d + ' ' + (s.src || '')).includes(nq);
    });
    const groupOf = s => s.grp || (s.lv === 0 ? 'Sorts mineurs' : 'Niveau ' + s.lv);
    const order = [];
    c.spells.forEach(s => { const g = groupOf(s); if (!order.includes(g)) order.push(g); });
    order.sort((a, b) => { const k = g => /^Niveau (\d)/.test(g) ? +g.slice(7) : g === 'Sorts mineurs' ? 0 : 50 + order.indexOf(g); return k(a) - k(b); });
    const chips = ['all'].concat(ACTS).map(a => `<button type="button" class="lp-chip ${view.act === a ? 'on' : ''}" data-act="actf" data-v="${esc(a)}">${a === 'all' ? 'Tout' : esc(a)}</button>`).join('');
    return `<div class="lp-tools"><input type="search" id="lp-q" value="${esc(view.q)}" placeholder="Chercher un sort ou un pouvoir" aria-label="Chercher"><div class="lp-chips">${chips}</div>
      ${hidden ? `<p class="lp-note">${hidden} pouvoir${hidden > 1 ? 's' : ''} d'objet masqué${hidden > 1 ? 's' : ''} : objet non équipé (onglet Équipement).</p>` : ''}
      </div>
      ${order.map(g => { const ls = list.filter(s => groupOf(s) === g); return ls.length ? `<h4 class="lp-lvh">${esc(g)}<small>${ls.length}</small></h4><div class="lp-grid">${ls.map(s => spellCard(c, st, s)).join('')}</div>` : ''; }).join('') || '<p class="lp-empty">Aucun résultat.</p>'}`;
  }


  function grimPanel(c, st) {
    const nrm = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), nq = nrm(view.q.trim());
    const on = n => (st.prep || []).includes(n);
    const out = (c.lists || []).map(L => {
      const all = c.spells.filter(s => s.lst === L.id);
      const nC = all.filter(s => s.lv === 0 && on(s.n)).length, nL = all.filter(s => s.lv > 0 && on(s.n)).length;
      const cnt = (a, m) => `<b class="${m && a > m ? 'over' : a === m ? 'full' : ''}">${a}${m ? ' / ' + m : ''}</b>`;
      const lvls = []; all.forEach(s => { if (!lvls.includes(s.lv)) lvls.push(s.lv); }); lvls.sort((a, b) => a - b);
      const body = lvls.map(lv => {
        const ls = all.filter(s => s.lv === lv && (!nq || nrm(s.n + ' ' + (s.en || '')).includes(nq)));
        return ls.length ? `<h5 class="lp-gl">${lv === 0 ? 'Sorts mineurs' : 'Niveau ' + lv}<small>${ls.filter(s => on(s.n)).length} / ${ls.length}</small></h5><div class="lp-glist">${ls.map(s => `<div class="lp-grow ${on(s.n) ? 'on' : ''}"><button type="button" class="lp-gt" data-act="prep" data-key="${esc(s.n)}" aria-pressed="${on(s.n)}" aria-label="${on(s.n) ? 'Retirer' : 'Ajouter'} ${esc(s.n)}">${on(s.n) ? '★' : '☆'}</button><button type="button" class="lp-gn" data-act="gopen" data-key="${esc(s.n)}" data-tip="s|${esc(s.n)}"><b>${esc(s.n)}</b>${s.en ? `<small class="lp-en">${esc(s.en)}</small>` : ''}</button></div>`).join('')}</div>` : '';
      }).join('');
      return `<section class="lp-block lp-gsec"><div class="lp-bar"><h3>${esc(L.nom)}</h3><div class="lp-caps"><span>Mineurs ${cnt(nC, L.cant)}</span><span>${L.mode === 'known' ? 'Connus' : 'Préparés'} ${cnt(nL, L.max)}</span></div></div>${body || '<p class="lp-empty">Aucun résultat.</p>'}</section>`;
    }).join('');
    return `<div class="lp-tools"><input type="search" id="lp-q" value="${esc(view.q)}" placeholder="Chercher dans le grimoire" aria-label="Chercher"><p class="lp-note">Clique sur l'étoile pour préparer un sort, sur son nom pour lire le texte. Seuls les sorts cochés apparaissent dans Sorts et pouvoirs.</p></div>${out || '<p class="lp-empty">Pas de liste de sorts.</p>'}`;
  }
  function featsPanel(c) {
    const fs = c.feats || [], gs = []; fs.forEach(f => { if (!gs.includes(f.grp)) gs.push(f.grp); });
    return gs.map(g => `<h4 class="lp-lvh">${esc(g)}<small>${fs.filter(f => f.grp === g).length}</small></h4><div class="lp-grid">${fs.map((f, i) => f.grp === g ? `<article class="lp-spell lp-feat"><div class="lp-sh"><span class="lp-sname" data-tip="f|${i}"><span class="lp-tt">${ico(featType(f))}<b>${esc(f.n)}</b></span>${f.en ? `<small class="lp-en">${esc(f.en)}</small>` : ''}</span></div><p class="lp-desc">${rich(dcify(c, f.d))}</p></article>` : '').join('')}</div>`).join('') || '<p class="lp-empty">Aucune capacité.</p>';
  }
  function pwState(c, st, o) {
    if (o.sp) { const sp = c.spells.find(x => x.n === o.sp); if (sp) { const pk = pickPool(c, st, sp); return { kind: 'sp', sp, pk, spent: pk.ps.length === 0, txt: pk.ps.length ? (sp.lim || sp.res ? '1 / jour' : pk.cur.s) : (sp.lim && st.used[sp.n] ? 'Utilisé' : 'Aucune ressource') }; } }
    if (o.res) { const l = left(c, st, o.res), r = resOf(c, o.res); return { kind: 'res', spent: l < o.cost, txt: `${l}/${r.max} charges` }; }
    return null;
  }
  function equipPanel(c, st) {
    const card = w => {
      const fx = w.fixed || w.perma, on = fx || st.eq.includes(w.n), eqb = fx ? (w.perma ? '<span class="lp-eqb perma">Permanent</span>' : '') : `<span class="lp-eqb ${on ? 'on' : ''}">${on ? 'Équipé' : 'Équiper'}</span>`;
      const head = fx ? `<header><div class="lp-eqhead"><h4>${esc(w.n)}</h4>${eqb}</div>${w.arc ? `<span class="lp-arc">${esc(w.arc)}</span>` : ''}</header>` : `<header><button type="button" class="lp-eqhead" data-act="eq" data-key="${esc(w.n)}" aria-pressed="${on}"><h4>${esc(w.n)}</h4>${eqb}</button>${w.arc ? `<span class="lp-arc">${esc(w.arc)}</span>` : ''}</header>`;
      const stat = w.hit || w.dmg ? `<div class="lp-wstat">${w.hit ? `<button type="button" class="lp-roll" data-act="rhit" data-key="${esc(w.n)}" title="Lancer le jet d'attaque">${im('damage', 'sm')}<span>Toucher</span><b>${esc(w.hit)}</b></button>` : ''}${w.dmg ? `<button type="button" class="lp-roll" data-act="rdmg" data-key="${esc(w.n)}" title="Lancer les dégâts">${im('damage', 'sm')}<span>Dégâts</span><b>${esc(w.dmg)}</b></button>` : ''}</div>` : '';
      const pws = (w.pw || []).map((o, i) => {
        if (typeof o === 'string') return `<li>${esc(o)}</li>`;
        const ps = pwState(c, st, o), spent = ps && ps.spent;
        const btns = on && ps ? (ps.kind === 'sp' ? `<button type="button" class="lp-cast sm" data-act="cast" data-key="${esc(ps.sp.n)}" ${spent ? 'disabled' : ''}>Lancer</button>${canJet(c, ps.sp) ? `<button type="button" class="lp-jet sm" data-act="jetsp" data-key="${esc(ps.sp.n)}" ${spent ? 'disabled' : ''}>Jet</button>` : ''}` : `<button type="button" class="lp-cast sm" data-act="pwuse" data-key="${esc(w.n)}" data-i="${i}" ${spent ? 'disabled' : ''}>Utiliser</button>${o.r ? `<button type="button" class="lp-jet sm" data-act="rpw" data-key="${esc(w.n)}" data-i="${i}" ${spent ? 'disabled' : ''}>Jet</button>` : ''}`) : (o.r ? `<button type="button" class="lp-jet sm" data-act="rpw" data-key="${esc(w.n)}" data-i="${i}">Jet</button>` : '');
        return `<li class="lp-pwi ${spent ? 'spent' : ''}"><button type="button" class="lp-pw" data-act="pwx" data-key="${esc(w.n)}" data-i="${i}" data-tip="p|${esc(w.n)}|${i}">${ico(typeOfPw(o.a))}<span>${esc(o.n)}</span></button>${ps ? `<span class="lp-pst ${spent ? 'off' : ''}">${esc(ps.txt)}</span>` : ''}<span class="lp-btns">${btns}</span></li>`;
      }).join('');
      return `<article class="lp-weapon ${on ? 'on' : 'off'}">${head}${stat}<p>${rich(dcify(c, w.note))}</p>${pws ? `<ul class="lp-pwl">${pws}</ul>` : ''}</article>`;
    };
    const wl = c.weapons.slice().sort((a, b) => (b.perma ? 1 : 0) - (a.perma ? 1 : 0)), ne = eqNames(c, st).filter(n => c.weapons.some(w => w.n === n)).length;
    return `<h4 class="lp-lvh">Armes<small>${ne} équipée${ne > 1 ? 's' : ''}</small></h4><div class="lp-wgrid">${wl.map(card).join('')}</div>
      ${(c.gear || []).length ? `<h4 class="lp-lvh">Objets équipables</h4><div class="lp-wgrid">${c.gear.map(card).join('')}</div>` : ''}`;
  }
  function itemsPanel(c, st) {
    const nrm = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), nq = nrm(view.q.trim());
    const items = st.items.filter(it => !nq || nrm(it.n + ' ' + (it.note || '')).includes(nq)).map(it => {
      const cat = (c.items || []).find(x => x.n === it.n), l = it.max - it.used;
      const ctl = it.max ? `<button type="button" class="lp-stp" data-act="itchg" data-id="${esc(it.id)}" data-d="1" aria-label="Dépenser une charge">−</button><b class="lp-cnt">${l}/${it.max}</b><button type="button" class="lp-stp" data-act="itchg" data-id="${esc(it.id)}" data-d="-1" aria-label="Récupérer une charge">+</button>`
        : `<button type="button" class="lp-stp" data-act="itqty" data-id="${esc(it.id)}" data-d="-1" aria-label="Retirer un">−</button><b class="lp-cnt">x${it.qty}</b><button type="button" class="lp-stp" data-act="itqty" data-id="${esc(it.id)}" data-d="1" aria-label="Ajouter un">+</button>`;
      const use = `<button type="button" class="lp-cast sm" data-act="ituse" data-id="${esc(it.id)}" ${(it.max ? l <= 0 : it.qty <= 0) ? 'disabled' : ''}>Utiliser</button>`;
      const jet = cat && cat.roll ? `<button type="button" class="lp-jet sm" data-act="itjet" data-id="${esc(it.id)}" title="Jet automatique">Jet</button>` : '';
      return `<li class="lp-item ${(it.max ? l <= 0 : it.qty <= 0) ? 'spent' : ''}"><span class="lp-nm">${esc(it.n)}${it.note ? `<small class="nt">${esc(it.note)}</small>` : ''}</span><span class="lp-iq">${ctl}${use}${jet}<button type="button" class="lp-del" data-act="itdel" data-id="${esc(it.id)}" aria-label="Supprimer">×</button></span></li>`;
    }).join('');
    return `<div class="lp-tools"><input type="search" id="lp-q" value="${esc(view.q)}" placeholder="Chercher un objet" aria-label="Chercher"></div>
      <h4 class="lp-lvh">Objets et consommables<small>${st.items.length}</small></h4>
      <ul class="lp-items">${items || '<li class="lp-empty">Aucun objet.</li>'}</ul>
      <div class="lp-add"><input id="lp-in-n" type="text" placeholder="Nom de l'objet" aria-label="Nom"><input id="lp-in-q" type="number" min="1" inputmode="numeric" placeholder="Qté" aria-label="Quantité"><input id="lp-in-c" type="number" min="0" inputmode="numeric" placeholder="Charges" aria-label="Charges"><button type="button" data-act="itadd">Ajouter</button></div>`;
  }

  function actionsPanel(c, st) {
    const cols = { 'Action': [], 'Action bonus': [], 'Réaction': [] };
    const eqw = c.weapons.filter(w => (w.hit || w.dmg) && (w.perma || st.eq.includes(w.n)));
    eqw.forEach(w => cols['Action'].push(`<article class="lp-spell lp-act"><div class="lp-sh"><span class="lp-sname"><span class="lp-tt">${ico('Action')}<b>Attaque : ${esc(w.n)}</b></span><span class="lp-meta">${esc(w.hit)}<i class="gap"></i>${esc(w.dmg)}</span></span><span class="lp-btns">${w.hit ? `<button type="button" class="lp-cast" data-act="rhit" data-key="${esc(w.n)}">Toucher</button>` : ''}${w.dmg ? `<button type="button" class="lp-jet" data-act="rdmg" data-key="${esc(w.n)}">Dégâts</button>` : ''}</span></div></article>`));
    eqw.forEach(w => {
      if (c.spells.some(x => x.src === w.n)) return;
      (w.pw || []).forEach((o, i) => { if (typeof o === 'string') return; cols[typeOfPw(o.a)].push(`<article class="lp-spell lp-act"><div class="lp-sh"><button type="button" class="lp-sname" data-act="pwx" data-key="${esc(w.n)}" data-i="${i}" data-tip="p|${esc(w.n)}|${i}"><span class="lp-tt">${ico(typeOfPw(o.a))}<b>${esc(o.n)}</b></span><span class="lp-meta">${esc(w.n)}</span></button>${o.r ? `<span class="lp-btns"><button type="button" class="lp-jet" data-act="rpw" data-key="${esc(w.n)}" data-i="${i}">Jet</button></span>` : ''}</div></article>`); });
    });
    c.spells.forEach(s => {
      if (!isEq(c, st, s.src) || (s.lst && !(st.prep || []).includes(s.n))) return;
      if (cols[s.t]) cols[s.t].push(spellCard(c, st, s));
    });
    visRes(c, st).filter(r => r.a).forEach(r => { const l = r.max - (st.res[r.id] || 0), t = typeOfPw(r.a); cols[t].push(`<article class="lp-spell lp-act ${l <= 0 ? 'spent' : ''}"><div class="lp-sh"><span class="lp-sname"><span class="lp-tt">${ico(t)}<b>${esc(r.nom)}</b></span><span class="lp-meta"><span>${esc(r.sub || '')}</span></span></span><span class="lp-spr"><span class="lp-slotchip ${l <= 0 ? 'off' : ''}">${l}/${r.max}</span><span class="lp-btns"><button type="button" class="lp-cast" data-act="resd" data-key="${esc(r.id)}" data-d="1" ${l <= 0 ? 'disabled' : ''}>Utiliser</button></span></span></div></article>`); });
    (c.feats || []).forEach((f, i) => { const t = f.res ? '' : featType(f); if (t) cols[t].push(`<article class="lp-spell lp-act"><div class="lp-sh"><span class="lp-sname" data-tip="f|${i}"><span class="lp-tt">${ico(t)}<b>${esc(f.n)}</b></span><span class="lp-meta">${esc(f.grp || '')}</span></span></div></article>`); });
    return `<div class="lp-acols">${Object.keys(cols).map(k => `<section class="lp-acol"><h4 class="lp-lvh">${ico(k)}${esc(k)}<small>${cols[k].length}</small></h4><div class="lp-agrid">${cols[k].join('') || '<p class="lp-empty">Rien de disponible.</p>'}</div></section>`).join('')}</div>`;
  }
  function restBlock() {
    const cf = view.confirm;
    if (cf) return `<section class="lp-block rests"><p class="lp-cfq">${cf === 'long' ? 'Repos long : PV, emplacements et ressources restaurés, charges d\'aube relancées.' : 'Repos court : pacte, ressources de repos court et 1 Forme sauvage.'}</p><div class="lp-cfb"><button type="button" class="go" data-act="restgo" data-type="${cf}">Confirmer le repos ${cf === 'long' ? 'long' : 'court'}</button><button type="button" class="ghost" data-act="restno">Annuler</button></div></section>`;
    return '<section class="lp-block rests"><button type="button" data-act="rest" data-type="court">Repos court</button><button type="button" data-act="rest" data-type="long">Repos long</button></section>';
  }

  function playerView() {
    const c = cfgOf(view.char), st = S(c.id);
    const tab = view.tab || (c.id === 'harfang' ? 'sorts' : 'actions');
    const ac = acOf(c, st), sp = spdOf(c, st);
    const hb = view.heal && view.heal.char === c.id ? `<div class="lp-healb"><span>${im('heal')}${esc(view.heal.name)} : <b>${view.heal.amt}</b> PV de soin</span><button type="button" data-act="healapply">Me soigner</button><button type="button" class="ghost" data-act="healno">Autre cible</button></div>` : '';
    const tile = (v, l, ic, t) => `<div class="lp-tile" ${t ? `title="${esc(t)}"` : ''}><span>${SV[ic] || ''}${esc(l)}</span><b>${esc(v)}</b></div>`;
    const icOf = { 'Maîtrise': 'mai', 'Initiative': 'ini', 'Perc. passive': 'per' };
    const tabs = [['actions', 'Actions'], ['armes', 'Équipement'], ['sorts', 'Sorts et pouvoirs']].concat((c.lists || []).length ? [['grim', 'Grimoire']] : []).concat([['objets', 'Objets'], ['capa', 'Capacités']]);
    const cf = view.confirm;
    const rests = cf ? `<div class="lp-restc cf"><p>${cf === 'long' ? 'Repos long : PV, emplacements, ressources.' : 'Repos court : pacte et ressources de repos court.'}</p><div><button type="button" class="go" data-act="restgo" data-type="${cf}">Confirmer</button><button type="button" class="ghost" data-act="restno">Annuler</button></div></div>` : `<div class="lp-restc"><button type="button" data-act="rest" data-type="court">${im('rest-short')}Repos court</button><button type="button" data-act="rest" data-type="long">${im('rest-long')}Repos long</button></div>`;
    const pct = Math.max(0, Math.min(100, st.hp / c.hp * 100));
    return `<div class="lp-sheet"><aside class="lp-artcol"><img class="lp-portrait" src="${esc(c.portrait)}" alt="${esc(c.nom)}" decoding="async"></aside>
    <div class="lp-body">
      <header class="lp-top"><div class="lp-ident"><span class="lp-kicker">${view.fromDM ? 'Fiche ouverte par le MJ' : 'Liveplay'}</span><h1>${esc(c.nom)}</h1><p>${esc(c.classe)}${st.conc ? `<span class="lp-concpill" title="Concentration"><i></i>${esc(st.conc)}<button type="button" data-act="endconc" aria-label="Terminer la concentration">×</button></span>` : ''}</p></div>
        <div class="lp-hpc"><div class="lp-hpline"><span class="l">PV</span><b>${st.hp}</b><span>/ ${c.hp}</span></div>
          <div class="lp-hpbar ${pct > 50 ? 'ok' : pct > 25 ? 'mid' : 'low'}"><i style="width:${pct}%"></i></div>
          <div class="lp-tline"><span class="l">Temp</span><b>${st.tmp}</b>${tmpBar(c, st)}</div>
          <div class="lp-hpctl"><button type="button" class="dmg" data-act="hp" data-type="dmg">${im('damage')}Dégâts</button><input type="number" min="0" inputmode="numeric" id="lp-hp-amt" placeholder="0" aria-label="Montant"><button type="button" class="heal" data-act="hp" data-type="heal">${im('heal')}Soins</button><button type="button" class="tmp" data-act="hp" data-type="tmp">Temp</button></div></div>
        ${rests}</header>
      ${rollBanner()}${hb}
      <section class="lp-stats">
        <div class="lp-srow"><h3>Caractéristiques</h3><div class="lp-r6">${(c.abil || []).map(a => `<div class="lp-tile ab"><span>${esc(a[0])}</span><b>${esc(a[1])}</b><em>${esc(a[2])}</em></div>`).join('')}</div></div>
        <div class="lp-srow"><h3>Jets de sauvegarde</h3><div class="lp-r6">${(c.saves || []).map(a => `<div class="lp-tile sv ${a[2] ? 'p' : ''}"><span>${esc(a[0])}</span><b>${esc(a[1])}</b></div>`).join('')}</div></div>
        <div class="lp-srow"><h3>Bonus</h3><div class="lp-r7">${tile(ac.v, 'CA', 'ca', ac.parts.join(', '))}${tile(sp.v + ' ft', 'Vitesse', 'vit', sp.parts.join(', '))}${(c.bonus || []).map(b => tile(b[1], b[0], icOf[b[0]])).join('')}${tile(c.dc, 'DD sorts', 'dd')}${tile('+' + c.atk, 'Att. sort', 'att')}</div></div>
      </section>
      <div class="lp-coinbar"><span class="lp-cbt">Monnaies</span>${coinsDef.map(([k, n, ab]) => `<label class="lp-coin" title="${esc(n)}"><span>${ab}</span><input type="number" min="0" inputmode="numeric" data-coin="${k}" value="${(st.coins || {})[k] || 0}" aria-label="${esc(n)}"></label>`).join('')}</div>
      <section class="lp-block lp-resb"><h3>Emplacements</h3><div class="lp-slots">${slotRows(c, st, false)}</div><h3>Capacités</h3><div class="lp-rgrid">${resRows(c, st, false)}</div></section>
      <div class="lp-main"><div class="lp-tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" class="${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${n}</button>`).join('')}</div>
      ${tab === 'armes' ? equipPanel(c, st) : tab === 'capa' ? featsPanel(c) : tab === 'grim' ? grimPanel(c, st) : tab === 'objets' ? itemsPanel(c, st) : tab === 'actions' ? actionsPanel(c, st) : spellsPanel(c, st)}</div></div></div>`;
  }
  const ago = iso => { const s = Math.max(0, (Date.now() - new Date(iso)) / 1000); return s < 60 ? 'à l\'instant' : s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : Math.floor(s / 86400) + ' j'; };

  function dmView() {
    const cards = CFG.chars.map(c => {
      const st = S(c.id), eq = eqNames(c, st);
      return `<article class="lp-dmcard"><div class="lp-dmh"><img src="${esc(c.chibi)}" alt=""><div><h3>${esc(c.court)}</h3><p>${esc(c.classe)}</p></div>${st.conc ? `<span class="lp-cbadge" title="Concentration">${esc(st.conc)}</span>` : ''}</div>
        <div class="lp-hp sm"><b class="n">${st.hp}</b><span>/ ${c.hp}</span><span class="gold">${gpOf(st)} po</span></div>${hpBar(c, st)}
        <div class="lp-tmph sm"><span>PV temporaires</span><b>${st.tmp}</b></div>${tmpBar(c, st)}
        <p class="lp-eqline"><span>Équipé</span>${eq.length ? esc(eq.join(', ')) : 'rien'}</p>
        <div class="lp-dmrows">${slotRows(c, st, true)}${resRows(c, st, true)}</div>
        <a class="lp-open" href="#/live/${esc(c.id)}" data-act="opench" data-char="${esc(c.id)}">Ouvrir la fiche</a></article>`;
    }).join('');
    const evs = EV.filter(e => view.filterChar === 'all' || e.char_id === view.filterChar);
    return `<header class="lp-hero dm"><div class="lp-id"><span class="lp-kicker">Vue MJ</span><h1>Tour de contrôle</h1><p>${online ? 'Synchronisation en direct' : 'Hors ligne : seules les données de cet appareil sont visibles'}</p></div></header>
      <div class="lp-dmwrap"><div class="lp-dmgrid">${cards}</div>
      <section class="lp-block lp-log"><div class="lp-bar"><h3>Journal</h3><select id="lp-fc" aria-label="Filtrer par personnage"><option value="all">Tous</option>${CFG.chars.map(c => `<option value="${c.id}" ${view.filterChar === c.id ? 'selected' : ''}>${esc(c.court)}</option>`).join('')}</select></div>
      <ul>${evs.map(e => `<li class="${esc(e.kind)}"><span class="who">${esc((cfgOf(e.char_id) || {}).court || e.char_id)}${e.actor === 'dm' ? ' (MJ)' : ''}</span> ${esc(e.label)}<time>${ago(e.at)}</time></li>`).join('') || '<li class="lp-empty">Aucune action pour le moment.</li>'}</ul></section></div>`;
  }

  function pickView() {
    return `<header class="lp-hero dm"><div class="lp-id"><span class="lp-kicker">Thaldera Codex</span><h1>Liveplay</h1><p>Choisis une fiche dans le menu Liveplay, ou ici.</p></div></header>
      <div class="lp-gate">${CFG.chars.map(c => `<a class="lp-who" href="#/live/${esc(c.id)}"><img src="${esc(c.chibi)}" alt=""><span><b>${esc(c.court)}</b><small>${esc(c.classe)}</small></span></a>`).join('')}<a class="lp-who" href="#/live/dm"><span class="lp-dmico">MJ</span><span><b>Tour de contrôle</b><small>Vue d'ensemble de la table</small></span></a></div>`;
  }

  function render() {
    if (!root) return;
    const page = root.closest('.livepage'), top = page ? page.scrollTop : 0;
    const ae = document.activeElement, keep = ae && root.contains(ae) && ae.id ? { id: ae.id, v: ae.value, s: ae.selectionStart } : null;
    const vals = {}; ['lp-hp-amt', 'lp-in-n', 'lp-in-q', 'lp-in-c'].forEach(i => { const e = root.querySelector('#' + i); if (e) vals[i] = e.value; });
    const body = view.mode === 'dm' ? dmView() : view.mode === 'player' ? playerView() : pickView();
    root.innerHTML = `<a class="pn-back lp-back" href="#/">‹ Retour au Codex</a><span class="lp-state ${online ? 'on' : ''}">${online ? 'En direct' : 'Hors ligne'}</span>${body}${popup()}${popupX()}<div class="lp-tip" role="tooltip"></div><div class="lp-toast" role="status"></div>`;
    Object.keys(vals).forEach(i => { const e = root.querySelector('#' + i); if (e) e.value = vals[i]; });
    if (page) { page.scrollTop = top; root.style.setProperty('--lp-vh', page.clientHeight + 'px'); }
    if (keep) { const e = root.querySelector('#' + keep.id); if (e) { e.focus(); if (keep.s != null && e.setSelectionRange && e.type !== 'number') { try { e.setSelectionRange(keep.s, keep.s); } catch (x) { /* ignore */ } } } }
  }

  /* ---------- evenements ---------- */
  function go(sub) {
    if (!CFG || !root) return;
    sub = (sub || '').split('?')[0];
    const keepDM = view._dmOpen; view._dmOpen = false;
    view.fromDM = !!keepDM && sub !== 'dm' && sub !== '';
    view.cast = null; view.heal = null; view.confirm = null; view.open = null; view.q = ''; view.act = 'all';
    if (sub === 'dm') view.mode = 'dm';
    else if (cfgOf(sub)) { if (view.char !== sub) { view.tab = null; view.gopen = null; } view.mode = 'player'; view.char = sub; }
    else view.mode = 'pick';
    render();
    const page = root && root.closest('.livepage'); if (page) page.scrollTop = 0;
  }
  function onClick(e) {
    const b = e.target.closest('[data-act]'); if (!b || !root.contains(b)) return;
    const a = b.dataset.act, c = view.char;
    if (a === 'opench') { view._dmOpen = true; return; }
    if (a === 'kw') { view.pop = b.dataset.id; return render(); }
    if (a === 'kwx') { if (e.target.closest('.lp-pop') && !e.target.closest('.lp-px')) return; view.pop = null; view.popsp = null; view.poppw = null; return render(); }
    if (!c) return;
    if (a === 'pip') return togglePip(c, b.dataset.kind, b.dataset.key, +b.dataset.idx);
    if (a === 'resd') return resDelta(c, b.dataset.key, +b.dataset.d);
    if (a === 'hp') { const i = root.querySelector('#lp-hp-amt'); const v = i.value; i.value = ''; return hpAct(c, b.dataset.type, v); }
    if (a === 'rest') { view.confirm = b.dataset.type; return render(); }
    if (a === 'restno') { view.confirm = null; return render(); }
    if (a === 'restgo') return rest(c, b.dataset.type);
    if (a === 'endconc') { const st = S(c), n = st.conc; st.conc = null; return say(c, `Termine la concentration sur ${n}`, 'spell'); }
    if (a === 'tab') { view.tab = b.dataset.v; view.cast = null; return render(); }
    if (a === 'actf') { view.act = b.dataset.v; return render(); }
    if (a === 'gopen') { hideTip(); view.popsp = b.dataset.key; return render(); }
    if (a === 'pwx') { hideTip(); view.poppw = [b.dataset.key, +b.dataset.i]; return render(); }
    if (a === 'rollx') { view.roll = null; return render(); }
    if (a === 'jetsp') return jetSpell(c, cfgOf(c).spells.find(x => x.n === b.dataset.key));
    if (a === 'rhit') return jetWeapon(c, b.dataset.key, 'hit');
    if (a === 'rdmg') return jetWeapon(c, b.dataset.key, 'dmg');
    if (a === 'rpw') return jetPw(c, b.dataset.key, +b.dataset.i);
    if (a === 'pwuse') { const cf = cfgOf(c), w = cf.weapons.find(x => x.n === b.dataset.key), o = w.pw[+b.dataset.i], st = S(c); if (left(cf, st, o.res) < o.cost) return toast('Plus de charges'); st.res[o.res] = (st.res[o.res] || 0) + o.cost; return say(c, `Utilise ${w.n} : ${o.n} (${o.cost} charge${o.cost > 1 ? 's' : ''}, reste ${left(cf, st, o.res)})`, 'res'); }
    if (a === 'itjet') return jetItem(c, b.dataset.id);
    if (a === 'ituse') return itemAct(c, 'use', { id: b.dataset.id });
    if (a === 'open') { view.open = view.open === b.dataset.key ? null : b.dataset.key; return render(); }
    if (a === 'prep') {
      const st = S(c), k = b.dataset.key, cf = cfgOf(c), sp = cf.spells.find(y => y.n === k);
      if (st.prep.includes(k)) st.prep = st.prep.filter(x => x !== k);
      else {
        const L = (cf.lists || []).find(l => l.id === sp.lst), same = cf.spells.filter(y => y.lst === sp.lst && st.prep.includes(y.n) && (y.lv === 0) === (sp.lv === 0)).length, cap = sp.lv === 0 ? L.cant : L.max;
        if (cap && same >= cap) return toast(sp.lv === 0 ? `Maximum de ${cap} sorts mineurs atteint` : `Maximum de ${cap} sorts atteint pour cette liste`);
        st.prep = st.prep.concat(k);
      }
      return save(c, null);
    }
    if (a === 'cast') { const sp = cfgOf(c).spells.find(s => s.n === b.dataset.key), pk = pickPool(cfgOf(c), S(c), sp); if (!pk.cur) return toast('Plus de ressource disponible'); return cast(c, sp, pk.cur.k); }
    if (a === 'unspend') { const st = S(c); delete st.used[b.dataset.key]; return say(c, `Restaure ${b.dataset.key}`, 'spell'); }
    if (a === 'eq') return toggleEq(c, b.dataset.key);
    if (a === 'healapply') { const h = view.heal; view.heal = null; return hpAct(c, 'heal', h.amt); }
    if (a === 'healno') { view.heal = null; return render(); }
    if (a === 'itadd') return itemAct(c, 'add');
    if (a === 'itqty') return itemAct(c, 'qty', { id: b.dataset.id, d: +b.dataset.d });
    if (a === 'itchg') return itemAct(c, 'chg', { id: b.dataset.id, d: +b.dataset.d });
    if (a === 'itdel') return itemAct(c, 'del', { id: b.dataset.id });
  }
  function onInput(e) {
    if (e.type === 'change' && e.target.dataset && e.target.dataset.coin && view.char) return coinAct(view.char, e.target.dataset.coin, e.target.value);
    if (e.target.id === 'lp-q') { view.q = e.target.value; render(); }
    if (e.target.classList && e.target.classList.contains('lp-pool')) { view.pool[e.target.dataset.sp] = e.target.value; return render(); }
    if (e.target.id === 'lp-fc') { view.filterChar = e.target.value; render(); }
  }

  /* ---------- montage ---------- */
  async function mount(el, sub) {
    root = el;
    if (!CFG) CFG = await fetch('data/liveplay.json?v=' + (window.__VER || '')).then(r => r.json());
    if (!GL) { try { buildGlossary(await fetch('data/glossary.json?v=' + (window.__VER || '')).then(r => r.json())); } catch (err) { GL = {}; } }
    root.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); }); root.addEventListener('mouseout', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && !t.contains(e.relatedTarget)) hideTip(); }); root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onInput);
    go(sub);
    await connect();
    render();
    tick = setInterval(() => { if (view.mode === 'dm') render(); }, 30000);
  }
  function unmount() {
    clearInterval(tick);
    if (chan && sb) { try { sb.removeChannel(chan); } catch (e) { /* ignore */ } chan = null; }
    root = null;
  }
  window.Liveplay = { mount, unmount, go };
})();
