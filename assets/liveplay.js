/* Liveplay : fiches de table en direct (PV, emplacements, ressources, sorts, armes) et tour de controle du MJ.
   Etat partage via Supabase, acces libre en lecture et en ecriture (table de 4). Repli local si hors ligne. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const REST_LABEL = { court: 'repos court', long: 'repos long', aube: 'aube', ws: 'repos court (1), long (tout)' };
  const ACTS = ['Action', 'Action bonus', 'Réaction', 'Hors combat'];
  let CFG = null, root = null, sb = null, online = false, chan = null, tick = null;
  let ST = {}, EV = [];
  const view = { mode: 'pick', char: null, tab: null, q: '', act: 'all', showAll: false, open: null, cast: null, confirm: null, filterChar: 'all', fromDM: false, pool: {}, heal: null };

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
      out += esc(text.slice(pos, h.a)) + `<button type="button" class="lp-kw ${GL[h.id].kind}" data-act="kw" data-id="${esc(h.id)}">${esc(text.slice(h.a, h.b))}</button>`;
      pos = h.b;
    }
    return out + esc(text.slice(pos));
  }
  function popup() {
    const g = view.pop && GL && GL[view.pop]; if (!g) return '';
    const paras = t => String(t).split('\n').map(l => /^[•]/.test(l) ? `<p class="b">${rich(l, g.id)}</p>` : `<p>${rich(l, g.id)}</p>`).join('');
    const meta = g.kind === 'sort' ? `<p class="lp-pm">${g.lvl ? 'Niveau ' + g.lvl : 'Sort mineur'} · ${esc(g.school)} · ${esc(g.cast)} · Portée ${esc(g.range)} · ${esc(g.comp)} · ${esc(g.dur)}</p>` : '<p class="lp-pm">État</p>';
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
  const isEq = (c, st, name) => !name || !equipables(c).includes(name) || (st.eq || []).includes(name);
  const visRes = (c, st) => c.resources.filter(r => isEq(c, st, r.src));
  const eqNames = (c, st) => (st.eq || []).filter(n => equipables(c).includes(n));

  /* ---------- etat ---------- */
  function fresh(c) { return { hp: c.hp, tmp: 0, slots: {}, pact: 0, res: {}, gold: 0, conc: null, prep: null, eq: null, items: [], used: {}, rev: 0 }; }
  function norm(c, s) {
    const o = Object.assign(fresh(c), s || {});
    o.slots = o.slots || {}; o.res = o.res || {}; o.used = o.used || {}; if (!Array.isArray(o.items)) o.items = [];
    if (!Array.isArray(o.eq)) o.eq = (c.eqDefault || []).slice();
    if (c.prepMax && !Array.isArray(o.prep)) o.prep = c.spells.filter(x => x.pre).map(x => x.n);
    if (!Array.isArray(o.prep)) o.prep = [];
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
  function goldAct(id, sign, amt) {
    const st = S(id); amt = Math.max(0, Math.floor(+amt || 0)); if (!amt) return;
    st.gold = Math.max(0, st.gold + sign * amt);
    return say(id, `${sign > 0 ? 'Gagne' : 'Dépense'} ${amt} po (total ${st.gold})`, 'gold');
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
      if (lv >= sp.lv && l > 0) out.push({ k: String(lv), s: `Niv. ${lv} (${l})`, label: `Emplacement niveau ${lv} (${l} restant${l > 1 ? 's' : ''})` });
    });
    if (c.pact && c.pact.lvl >= sp.lv && c.pact.n - st.pact > 0) { const l = c.pact.n - st.pact; out.push({ k: 'pact', s: `Pacte ${c.pact.lvl} (${l})`, label: `Pacte niveau ${c.pact.lvl} (${l} restant${l > 1 ? 's' : ''})` }); }
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
    if (c.pact) h += `<div class="lp-row"><span class="lp-lv pact">Pacte ${c.pact.lvl}</span><span class="lp-pips">${ro ? rpips(c.pact.n, st.pact, 'pact') : pips(c.pact.n, st.pact, 'pact', 'pact', 'pact')}</span></div>`;
    return h;
  }
  function resRows(c, st, ro) {
    const rows = visRes(c, st).map(r => {
      const u = st.res[r.id] || 0, l = r.max - u;
      let ctl;
      if (r.max <= 5) ctl = ro ? rpips(r.max, u, 'res') : pips(r.max, u, 'res', r.id, 'res');
      else ctl = ro ? `<b class="lp-cnt">${l}/${r.max}</b>` : `<button type="button" class="lp-stp" data-act="resd" data-key="${esc(r.id)}" data-d="1" aria-label="Dépenser">−</button><b class="lp-cnt">${l}/${r.max}</b><button type="button" class="lp-stp" data-act="resd" data-key="${esc(r.id)}" data-d="-1" aria-label="Récupérer">+</button>`;
      return `<div class="lp-row res"><span class="lp-nm">${esc(r.nom)}${!ro && r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span><span class="lp-pips">${ctl}</span></div>`;
    });
    st.items.filter(it => it.max).forEach(it => {
      const l = it.max - it.used;
      const ctl = ro ? `<b class="lp-cnt">${l}/${it.max}</b>` : `<button type="button" class="lp-stp" data-act="itchg" data-id="${esc(it.id)}" data-d="1" aria-label="Dépenser">−</button><b class="lp-cnt">${l}/${it.max}</b><button type="button" class="lp-stp" data-act="itchg" data-id="${esc(it.id)}" data-d="-1" aria-label="Récupérer">+</button>`;
      rows.push(`<div class="lp-row res"><span class="lp-nm">${esc(it.n)}${!ro ? '<small>Objet, charges</small>' : ''}</span><span class="lp-pips">${ctl}</span></div>`);
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
    const key = sp.n, open = view.open === key, conc = st.conc === key, prep = (st.prep || []).includes(key);
    const { ps, cur } = pickPool(c, st, sp), spent = ps.length === 0, limUsed = sp.lim && st.used[sp.n];
    const tags = [sp.c ? '<span class="lp-tag c">Concentration</span>' : '', sp.ritual ? '<span class="lp-tag">Rituel</span>' : '', sp.save ? `<span class="lp-tag">Jet de ${esc(sp.save)}</span>` : '', sp.atk ? '<span class="lp-tag">Attaque de sort</span>' : '', sp.lim ? '<span class="lp-tag free">1 / repos long</span>' : '', sp.src ? `<span class="lp-tag src">${esc(sp.src)}</span>` : '', sp.res && sp.lv ? `<span class="lp-tag free">Gratuit 1 / jour</span>` : ''].join('');
    const star = c.prepMax && sp.cls && !sp.always && sp.lv > 0 ? `<button type="button" class="lp-prep ${prep ? 'on' : ''}" data-act="prep" data-key="${esc(key)}" title="Préparer" aria-pressed="${prep}">${prep ? '★' : '☆'}</button>` : '';
    const sel = ps.length > 1 ? `<select class="lp-pool" data-sp="${esc(key)}" aria-label="Source du sort">${ps.map(p => `<option value="${esc(p.k)}" ${cur.k === p.k ? 'selected' : ''}>${esc(p.s)}</option>`).join('')}</select>` : '';
    const btn = spent ? `<button type="button" class="lp-cast off" disabled>${limUsed ? 'Lancé' : 'Épuisé'}</button>` : `<button type="button" class="lp-cast" data-act="cast" data-key="${esc(key)}">Lancer</button>`;
    let h = `<article class="lp-spell ${open ? 'open' : ''} ${conc ? 'conc' : ''} ${spent ? 'spent' : ''} ${c.prepMax && sp.cls && sp.lv > 0 && !prep && !sp.always ? 'unprep' : ''}">
      <div class="lp-sh"><button type="button" class="lp-sname" data-act="open" data-key="${esc(key)}"><b>${esc(sp.n)}</b>${sp.en ? `<small class="lp-en">${esc(sp.en)}</small>` : ''}<span class="lp-meta">${esc(sp.t)} · ${esc(sp.p)}</span></button>${costBadge(c, sp)}${star}${sel}${btn}</div>
      ${tags ? `<div class="lp-tags">${tags}</div>` : ''}`;
    if (open) h += `<p class="lp-desc">${rich(sp.d, sp.gid)}</p>${sp.gid ? `<button type="button" class="lp-full" data-act="kw" data-id="${esc(sp.gid)}">Texte officiel complet</button>` : ''}`;
    if (limUsed) h += `<button type="button" class="lp-full" data-act="unspend" data-key="${esc(key)}">Restaurer ce sort</button>`;
    return h + '</article>';
  }

  function spellsPanel(c, st) {
    const q = view.q.trim().toLowerCase(), nrm = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), nq = nrm(q);
    const prepared = n => (st.prep || []).includes(n);
    let hidden = 0;
    const list = c.spells.filter(s => {
      if (!isEq(c, st, s.src)) { hidden++; return false; }
      if (c.prepMax && s.cls && s.lv > 0 && !s.always && !view.showAll && !prepared(s.n)) return false;
      if (view.act !== 'all' && s.t !== view.act) return false;
      return !nq || nrm(s.n + ' ' + (s.en || '') + ' ' + s.d + ' ' + (s.src || '')).includes(nq);
    });
    const groupOf = s => s.grp || (s.lv === 0 ? 'Sorts mineurs' : 'Niveau ' + s.lv);
    const order = [];
    c.spells.forEach(s => { const g = groupOf(s); if (!order.includes(g)) order.push(g); });
    order.sort((a, b) => { const k = g => /^Niveau (\d)/.test(g) ? +g.slice(7) : g === 'Sorts mineurs' ? 0 : 50 + order.indexOf(g); return k(a) - k(b); });
    const nPrep = (st.prep || []).filter(n => { const s = c.spells.find(x => x.n === n); return s && !s.always; }).length;
    const chips = ['all'].concat(ACTS).map(a => `<button type="button" class="lp-chip ${view.act === a ? 'on' : ''}" data-act="actf" data-v="${esc(a)}">${a === 'all' ? 'Tout' : esc(a)}</button>`).join('');
    return `<div class="lp-tools"><input type="search" id="lp-q" value="${esc(view.q)}" placeholder="Chercher un sort ou un pouvoir" aria-label="Chercher"><div class="lp-chips">${chips}</div>
      ${hidden ? `<p class="lp-note">${hidden} pouvoir${hidden > 1 ? 's' : ''} d'objet masqué${hidden > 1 ? 's' : ''} : objet non équipé (onglet Équipement).</p>` : ''}
      ${c.prepMax ? `<div class="lp-prepbar"><span>Préparés : <b>${nPrep}</b> / ${c.prepMax}</span><button type="button" class="lp-chip ${view.showAll ? 'on' : ''}" data-act="showall">Voir toute la liste de classe</button></div>` : ''}</div>
      ${order.map(g => { const ls = list.filter(s => groupOf(s) === g); return ls.length ? `<h4 class="lp-lvh">${esc(g)}<small>${ls.length}</small></h4><div class="lp-grid">${ls.map(s => spellCard(c, st, s)).join('')}</div>` : ''; }).join('') || '<p class="lp-empty">Aucun résultat.</p>'}`;
  }

  function featsPanel(c) {
    const fs = c.feats || [], gs = []; fs.forEach(f => { if (!gs.includes(f.grp)) gs.push(f.grp); });
    return gs.map(g => `<h4 class="lp-lvh">${esc(g)}<small>${fs.filter(f => f.grp === g).length}</small></h4><div class="lp-grid">${fs.filter(f => f.grp === g).map(f => `<article class="lp-spell lp-feat"><div class="lp-sh"><span class="lp-sname"><b>${esc(f.n)}</b>${f.en ? `<small class="lp-en">${esc(f.en)}</small>` : ''}</span></div><p class="lp-desc">${rich(f.d)}</p></article>`).join('')}</div>`).join('') || '<p class="lp-empty">Aucune capacité.</p>';
  }
  function equipPanel(c, st) {
    const card = (w, isGear) => {
      const fx = w.fixed, on = fx || st.eq.includes(w.n);
      return `<article class="lp-weapon ${on ? 'on' : 'off'}">
      <header><h4>${esc(w.n)}</h4>${w.arc ? `<span class="lp-arc">${esc(w.arc)}</span>` : ''}${fx ? '' : `<button type="button" class="lp-eqb ${on ? 'on' : ''}" data-act="eq" data-key="${esc(w.n)}" aria-pressed="${on}">${on ? 'Équipé' : 'Équiper'}</button>`}</header>
      ${w.hit || w.dmg ? `<div class="lp-wstat">${w.hit ? `<div><span>Toucher</span><b>${esc(w.hit)}</b></div>` : ''}${w.dmg ? `<div><span>Dégâts</span><b>${esc(w.dmg)}</b></div>` : ''}</div>` : ''}
      <p>${rich(w.note)}</p>${w.pw && w.pw.length ? `<ul>${w.pw.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</article>`;
    };
    const wl = c.weapons.slice().sort((a, b) => (b.fixed || st.eq.includes(b.n) ? 1 : 0) - (a.fixed || st.eq.includes(a.n) ? 1 : 0));
    const items = st.items.map(it => `<li class="lp-item"><span class="lp-nm">${esc(it.n)}${it.max ? `<small>${it.max - it.used}/${it.max} charges</small>` : ''}</span>
      <span class="lp-iq">${it.max ? `<button type="button" class="lp-stp" data-act="itchg" data-id="${esc(it.id)}" data-d="1" aria-label="Dépenser une charge">−</button><b class="lp-cnt">${it.max - it.used}/${it.max}</b><button type="button" class="lp-stp" data-act="itchg" data-id="${esc(it.id)}" data-d="-1" aria-label="Récupérer une charge">+</button>`
        : `<button type="button" class="lp-stp" data-act="itqty" data-id="${esc(it.id)}" data-d="-1" aria-label="Retirer un">−</button><b class="lp-cnt">x${it.qty}</b><button type="button" class="lp-stp" data-act="itqty" data-id="${esc(it.id)}" data-d="1" aria-label="Ajouter un">+</button>`}
      <button type="button" class="lp-del" data-act="itdel" data-id="${esc(it.id)}" aria-label="Supprimer">×</button></span></li>`).join('');
    return `<h4 class="lp-lvh">Armes<small>${eqNames(c, st).filter(n => c.weapons.some(w => w.n === n)).length} équipée${eqNames(c, st).length > 1 ? 's' : ''}</small></h4><div class="lp-wgrid">${wl.map(w => card(w)).join('')}</div>
      ${(c.gear || []).length ? `<h4 class="lp-lvh">Objets équipables</h4><div class="lp-wgrid">${c.gear.map(g => card(g)).join('')}</div>` : ''}
      <h4 class="lp-lvh">Objets et consommables<small>${st.items.length}</small></h4>
      <ul class="lp-items">${items || '<li class="lp-empty">Aucun objet. Ajoute une potion, un parchemin ou un objet à charges.</li>'}</ul>
      <div class="lp-add"><input id="lp-in-n" type="text" placeholder="Nom de l'objet" aria-label="Nom"><input id="lp-in-q" type="number" min="1" inputmode="numeric" placeholder="Qté" aria-label="Quantité"><input id="lp-in-c" type="number" min="0" inputmode="numeric" placeholder="Charges" aria-label="Charges"><button type="button" data-act="itadd">Ajouter</button></div>`;
  }

  function restBlock() {
    const cf = view.confirm;
    if (cf) return `<section class="lp-block rests"><p class="lp-cfq">${cf === 'long' ? 'Repos long : PV, emplacements et ressources restaurés, charges d\'aube relancées.' : 'Repos court : pacte, ressources de repos court et 1 Forme sauvage.'}</p><div class="lp-cfb"><button type="button" class="go" data-act="restgo" data-type="${cf}">Confirmer le repos ${cf === 'long' ? 'long' : 'court'}</button><button type="button" class="ghost" data-act="restno">Annuler</button></div></section>`;
    return '<section class="lp-block rests"><button type="button" data-act="rest" data-type="court">Repos court</button><button type="button" data-act="rest" data-type="long">Repos long</button></section>';
  }

  function playerView() {
    const c = cfgOf(view.char), st = S(c.id);
    const tab = view.tab || (c.id === 'harfang' ? 'sorts' : 'armes');
    const hb = view.heal && view.heal.char === c.id ? `<div class="lp-healb"><span>${esc(view.heal.name)} : <b>${view.heal.amt}</b> PV de soin</span><button type="button" data-act="healapply">Me soigner</button><button type="button" class="ghost" data-act="healno">Autre cible</button></div>` : '';
    const stat = (v, l) => `<div class="lp-tile"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
    return `<div class="lp-sheet"><aside class="lp-artcol"><img class="lp-portrait" src="${esc(c.portrait)}" alt="${esc(c.nom)}" decoding="async"></aside>
    <div class="lp-body">
      <header class="lp-head"><span class="lp-kicker">${view.fromDM ? 'Fiche ouverte par le MJ' : 'Liveplay'}</span><h1>${esc(c.nom)}</h1><p>${esc(c.classe)}</p>
        ${st.conc ? `<div class="lp-conc"><span>Concentration : <b>${esc(st.conc)}</b></span><button type="button" data-act="endconc">Terminer</button></div>` : ''}</header>
      <div class="lp-dash"><div class="lp-colL">
        <section class="lp-block"><h3>Caractéristiques</h3><div class="lp-abil">${(c.abil || []).map(a => `<div class="lp-tile ab"><span>${esc(a[0])}</span><b>${esc(a[2])}</b><small>${a[1]}</small></div>`).join('')}</div></section>
        <section class="lp-block"><h3>Bonus</h3><div class="lp-bon">${stat(c.ca, 'CA')}${stat(c.dc, 'DD sorts')}${stat('+' + c.atk, 'Att. sort')}${(c.bonus || []).map(b => stat(b[1], b[0])).join('')}</div></section>
        <section class="lp-block"><h3>Jets de sauvegarde</h3><div class="lp-saves">${(c.saves || []).map(a => `<div class="${a[2] ? 'p' : ''}"><i></i><span>${esc(a[0])}</span><b>${esc(a[1])}</b></div>`).join('')}</div></section>
      </div><div class="lp-colR">
        <section class="lp-block lp-hpblock"><h3>Points de vie</h3><div class="lp-hp"><b class="n">${st.hp}</b><span>/ ${c.hp}</span></div>${hpBar(c, st)}
          <div class="lp-hpctl"><button type="button" class="dmg" data-act="hp" data-type="dmg">Dégâts</button><input type="number" min="0" inputmode="numeric" id="lp-hp-amt" placeholder="0" aria-label="Montant"><button type="button" class="heal" data-act="hp" data-type="heal">Soins</button></div>${hb}
          <div class="lp-tmpblock"><div class="lp-tmph"><span>PV temporaires</span><b>${st.tmp}</b></div>${tmpBar(c, st)}
          <div class="lp-hpctl t"><input type="number" min="0" inputmode="numeric" id="lp-tmp-amt" placeholder="0" aria-label="PV temporaires"><button type="button" class="tmp" data-act="hp" data-type="tmp">Définir</button></div></div></section>
        ${restBlock()}
        <section class="lp-block"><h3>Ressources</h3>${slotRows(c, st, false)}${resRows(c, st, false)}</section>
        <section class="lp-block"><h3>Or</h3><div class="lp-gold"><b>${st.gold}</b><span>po</span></div><div class="lp-hpctl g"><button type="button" data-act="gold" data-sign="-1">Dépenser</button><input type="number" min="0" inputmode="numeric" id="lp-gold-amt" placeholder="0" aria-label="Montant en or"><button type="button" data-act="gold" data-sign="1">Gagner</button></div></section>
      </div></div>
      <div class="lp-main"><div class="lp-tabs" role="tablist"><button type="button" role="tab" class="${tab === 'armes' ? 'on' : ''}" data-act="tab" data-v="armes">Équipement</button><button type="button" role="tab" class="${tab === 'sorts' ? 'on' : ''}" data-act="tab" data-v="sorts">Sorts et pouvoirs</button><button type="button" role="tab" class="${tab === 'capa' ? 'on' : ''}" data-act="tab" data-v="capa">Capacités</button></div>
      ${tab === 'armes' ? equipPanel(c, st) : tab === 'capa' ? featsPanel(c) : spellsPanel(c, st)}</div></div></div>`;
  }

  const ago = iso => { const s = Math.max(0, (Date.now() - new Date(iso)) / 1000); return s < 60 ? 'à l\'instant' : s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : Math.floor(s / 86400) + ' j'; };

  function dmView() {
    const cards = CFG.chars.map(c => {
      const st = S(c.id), eq = eqNames(c, st);
      return `<article class="lp-dmcard"><div class="lp-dmh"><img src="${esc(c.chibi)}" alt=""><div><h3>${esc(c.court)}</h3><p>${esc(c.classe)}</p></div>${st.conc ? `<span class="lp-cbadge" title="Concentration">${esc(st.conc)}</span>` : ''}</div>
        <div class="lp-hp sm"><b class="n">${st.hp}</b><span>/ ${c.hp}</span><span class="gold">${st.gold} po</span></div>${hpBar(c, st)}
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
    const vals = {}; ['lp-hp-amt', 'lp-tmp-amt', 'lp-gold-amt', 'lp-in-n', 'lp-in-q', 'lp-in-c'].forEach(i => { const e = root.querySelector('#' + i); if (e) vals[i] = e.value; });
    const body = view.mode === 'dm' ? dmView() : view.mode === 'player' ? playerView() : pickView();
    root.innerHTML = `<a class="pn-back lp-back" href="#/">‹ Retour au Codex</a><span class="lp-state ${online ? 'on' : ''}">${online ? 'En direct' : 'Hors ligne'}</span>${body}${popup()}<div class="lp-toast" role="status"></div>`;
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
    else if (cfgOf(sub)) { if (view.char !== sub) { view.tab = null; view.showAll = false; } view.mode = 'player'; view.char = sub; }
    else view.mode = 'pick';
    render();
    const page = root && root.closest('.livepage'); if (page) page.scrollTop = 0;
  }
  function onClick(e) {
    const b = e.target.closest('[data-act]'); if (!b || !root.contains(b)) return;
    const a = b.dataset.act, c = view.char;
    if (a === 'opench') { view._dmOpen = true; return; }
    if (a === 'kw') { view.pop = b.dataset.id; return render(); }
    if (a === 'kwx') { if (e.target.closest('.lp-pop') && !e.target.closest('.lp-px')) return; view.pop = null; return render(); }
    if (!c) return;
    if (a === 'pip') return togglePip(c, b.dataset.kind, b.dataset.key, +b.dataset.idx);
    if (a === 'resd') return resDelta(c, b.dataset.key, +b.dataset.d);
    if (a === 'hp') { const i = root.querySelector(b.dataset.type === 'tmp' ? '#lp-tmp-amt' : '#lp-hp-amt'); const v = i.value; i.value = ''; return hpAct(c, b.dataset.type, v); }
    if (a === 'gold') { const i = root.querySelector('#lp-gold-amt'); const v = i.value; i.value = ''; return goldAct(c, +b.dataset.sign, v); }
    if (a === 'rest') { view.confirm = b.dataset.type; return render(); }
    if (a === 'restno') { view.confirm = null; return render(); }
    if (a === 'restgo') return rest(c, b.dataset.type);
    if (a === 'endconc') { const st = S(c), n = st.conc; st.conc = null; return say(c, `Termine la concentration sur ${n}`, 'spell'); }
    if (a === 'tab') { view.tab = b.dataset.v; view.cast = null; return render(); }
    if (a === 'actf') { view.act = b.dataset.v; return render(); }
    if (a === 'showall') { view.showAll = !view.showAll; return render(); }
    if (a === 'open') { view.open = view.open === b.dataset.key ? null : b.dataset.key; return render(); }
    if (a === 'prep') {
      const st = S(c), k = b.dataset.key, cf = cfgOf(c);
      if (st.prep.includes(k)) st.prep = st.prep.filter(x => x !== k);
      else {
        const n = st.prep.filter(x => { const s = cf.spells.find(y => y.n === x); return s && !s.always; }).length;
        if (n >= cf.prepMax) return toast(`Maximum de ${cf.prepMax} sorts préparés atteint`);
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
    if (e.target.id === 'lp-q') { view.q = e.target.value; render(); }
    if (e.target.classList && e.target.classList.contains('lp-pool')) { view.pool[e.target.dataset.sp] = e.target.value; return render(); }
    if (e.target.id === 'lp-fc') { view.filterChar = e.target.value; render(); }
  }

  /* ---------- montage ---------- */
  async function mount(el, sub) {
    root = el;
    if (!CFG) CFG = await fetch('data/liveplay.json?v=' + (window.__VER || '')).then(r => r.json());
    if (!GL) { try { buildGlossary(await fetch('data/glossary.json?v=' + (window.__VER || '')).then(r => r.json())); } catch (err) { GL = {}; } }
    root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onInput);
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
