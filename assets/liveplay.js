/* Liveplay : fiches de table en direct (PV, emplacements, ressources, sorts, armes) et tour de controle du MJ.
   Etat partage via Supabase, acces libre en lecture et en ecriture (table de 4). Repli local si hors ligne. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const REST_LABEL = { court: 'repos court', long: 'repos long', aube: 'aube', ws: 'repos court (1), long (tout)' };
  const ACTS = ['Action', 'Action bonus', 'Réaction', 'Hors combat'];
  let CFG = null, root = null, sb = null, online = false, chan = null, tick = null;
  let ST = {}, EV = [];
  const view = { mode: 'pick', char: null, tab: null, q: '', act: 'all', showAll: false, open: null, cast: null, confirm: null, filterChar: 'all', fromDM: false };

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

  /* ---------- etat ---------- */
  function fresh(c) { return { hp: c.hp, tmp: 0, slots: {}, pact: 0, res: {}, gold: 0, conc: null, prep: null, rev: 0 }; }
  function norm(c, s) {
    const o = Object.assign(fresh(c), s || {});
    o.slots = o.slots || {}; o.res = o.res || {};
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
    if (type === 'long') { st.slots = {}; st.hp = c.hp; st.tmp = 0; st.conc = null; }
    view.confirm = null;
    return say(id, type === 'long' ? 'Repos long' + (notes.length ? ' (' + notes.join(', ') + ')' : '') : 'Repos court', 'rest');
  }

  function poolsFor(c, st, sp) {
    const out = [];
    if (sp.cost) {
      const r = resOf(c, sp.cost.res), l = left(c, st, sp.cost.res);
      if (l >= sp.cost.n) out.push({ k: 'cost', label: `${sp.cost.n} charge${sp.cost.n > 1 ? 's' : ''} : ${r.nom} (reste ${l})` });
      return out;
    }
    if (sp.res && left(c, st, sp.res) > 0) out.push({ k: 'free', label: 'Usage gratuit : ' + resOf(c, sp.res).nom });
    if (sp.alt && left(c, st, sp.alt.res) >= sp.alt.n) out.push({ k: 'alt', label: 'Dépenser : ' + resOf(c, sp.alt.res).nom });
    if (sp.lv === 0) { if (!sp.res) out.push({ k: 'cantrip', label: 'Sort mineur (gratuit)' }); return out; }
    if (!sp.pactonly) Object.keys(c.slots).map(Number).sort((a, b) => a - b).forEach(lv => {
      const l = total(c, lv) - used(st, lv);
      if (lv >= sp.lv && l > 0) out.push({ k: String(lv), label: `Emplacement niveau ${lv} (${l} restant${l > 1 ? 's' : ''})` });
    });
    if (c.pact && c.pact.lvl >= sp.lv && c.pact.n - st.pact > 0) { const l = c.pact.n - st.pact; out.push({ k: 'pact', label: `Pacte niveau ${c.pact.lvl} (${l} restant${l > 1 ? 's' : ''})` }); }
    return out;
  }
  function cast(id, sp, pool) {
    const c = cfgOf(id), st = S(id); let cost = '';
    if (pool === 'free') { st.res[sp.res] = (st.res[sp.res] || 0) + 1; cost = resOf(c, sp.res).nom; }
    else if (pool === 'alt') { st.res[sp.alt.res] = (st.res[sp.alt.res] || 0) + sp.alt.n; cost = resOf(c, sp.alt.res).nom; }
    else if (pool === 'cost') { st.res[sp.cost.res] = (st.res[sp.cost.res] || 0) + sp.cost.n; cost = `${sp.cost.n} charge${sp.cost.n > 1 ? 's' : ''} ${resOf(c, sp.cost.res).nom}`; }
    else if (pool === 'pact') { st.pact += 1; cost = `pacte niveau ${c.pact.lvl}`; }
    else if (pool !== 'cantrip') { st.slots[pool] = used(st, pool) + 1; cost = `emplacement niveau ${pool}`; }
    let extra = '';
    if (sp.c) { if (st.conc && st.conc !== sp.n) extra = `, abandonne ${st.conc}`; st.conc = sp.n; }
    view.cast = null;
    return say(id, `Lance ${sp.n}${cost ? ' (' + cost + ')' : ''}${extra}${sp.c ? ', concentration' : ''}`, 'spell');
  }

  /* ---------- rendu : briques ---------- */
  const pips = (n, u, kind, key, cls) => {
    let h = '';
    for (let i = 0; i < n; i++) h += `<button type="button" class="lp-pip ${cls || ''} ${i >= n - u ? 'used' : ''}" data-act="pip" data-kind="${kind}" data-key="${esc(key)}" data-idx="${i}" aria-label="${esc(key)} ${i >= n - u ? 'utilisé' : 'disponible'}"></button>`;
    return h;
  };
  const rpips = (n, u, cls) => { let h = ''; for (let i = 0; i < n; i++) h += `<span class="lp-pip ro ${cls || ''} ${i >= n - u ? 'used' : ''}"></span>`; return h; };

  function hpBar(c, st) {
    const p = Math.max(0, Math.min(100, st.hp / c.hp * 100)), t = Math.min(100 - p, st.tmp / c.hp * 100);
    return `<div class="lp-hpbar ${p > 50 ? 'ok' : p > 25 ? 'mid' : 'low'}"><i style="width:${p}%"></i><b style="width:${t}%"></b></div>`;
  }
  function slotRows(c, st, ro) {
    let h = Object.keys(c.slots).sort((a, b) => a - b).map(l => `<div class="lp-row"><span class="lp-lv">Niv. ${l}</span><span class="lp-pips">${ro ? rpips(total(c, l), used(st, l)) : pips(total(c, l), used(st, l), 'slot', l)}</span></div>`).join('');
    if (c.pact) h += `<div class="lp-row"><span class="lp-lv pact">Pacte ${c.pact.lvl}</span><span class="lp-pips">${ro ? rpips(c.pact.n, st.pact, 'pact') : pips(c.pact.n, st.pact, 'pact', 'pact', 'pact')}</span></div>`;
    return h;
  }
  function resRows(c, st, ro) {
    return c.resources.map(r => {
      const u = st.res[r.id] || 0, l = r.max - u;
      let ctl;
      if (r.max <= 5) ctl = ro ? rpips(r.max, u, 'res') : pips(r.max, u, 'res', r.id, 'res');
      else ctl = ro ? `<b class="lp-cnt">${l}/${r.max}</b>` : `<button type="button" class="lp-stp" data-act="resd" data-key="${esc(r.id)}" data-d="1" aria-label="Dépenser">−</button><b class="lp-cnt">${l}/${r.max}</b><button type="button" class="lp-stp" data-act="resd" data-key="${esc(r.id)}" data-d="-1" aria-label="Récupérer">+</button>`;
      return `<div class="lp-row res"><span class="lp-nm">${esc(r.nom)}${!ro && r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span><span class="lp-pips">${ctl}</span></div>`;
    }).join('');
  }

  function costBadge(c, sp) {
    if (sp.cost) return `<span class="lp-cb ch">${sp.cost.n} charge${sp.cost.n > 1 ? 's' : ''}</span>`;
    if (sp.lv === 0 && !sp.res) return '<span class="lp-cb">Gratuit</span>';
    if (sp.lv === 0) return '<span class="lp-cb free">1 / jour</span>';
    return `<span class="lp-cb">Niv. ${sp.lv}</span>`;
  }
  function spellCard(c, st, sp) {
    const key = sp.n, open = view.open === key, conc = st.conc === key, prep = (st.prep || []).includes(key);
    const pools = view.cast === key ? poolsFor(c, st, sp) : null;
    const tags = [sp.c ? '<span class="lp-tag c">Concentration</span>' : '', sp.ritual ? '<span class="lp-tag">Rituel</span>' : '', sp.save ? `<span class="lp-tag">Jet de ${esc(sp.save)}</span>` : '', sp.atk ? '<span class="lp-tag">Attaque de sort</span>' : '', sp.src ? `<span class="lp-tag src">${esc(sp.src)}</span>` : '', sp.res && sp.lv ? `<span class="lp-tag free">Gratuit 1 / jour</span>` : ''].join('');
    const star = c.prepMax && sp.cls && !sp.always && sp.lv > 0 ? `<button type="button" class="lp-prep ${prep ? 'on' : ''}" data-act="prep" data-key="${esc(key)}" title="Préparer" aria-pressed="${prep}">${prep ? '★' : '☆'}</button>` : '';
    let h = `<article class="lp-spell ${open ? 'open' : ''} ${conc ? 'conc' : ''} ${c.prepMax && sp.cls && sp.lv > 0 && !prep && !sp.always ? 'unprep' : ''}">
      <div class="lp-sh"><button type="button" class="lp-sname" data-act="open" data-key="${esc(key)}"><b>${esc(sp.n)}</b>${sp.en ? `<small class="lp-en">${esc(sp.en)}</small>` : ''}<span class="lp-meta">${esc(sp.t)} · ${esc(sp.p)}</span></button>${costBadge(c, sp)}${star}<button type="button" class="lp-cast" data-act="cast" data-key="${esc(key)}">Lancer</button></div>
      ${tags ? `<div class="lp-tags">${tags}</div>` : ''}`;
    if (open) h += `<p class="lp-desc">${rich(sp.d, sp.gid)}</p>${sp.gid ? `<button type="button" class="lp-full" data-act="kw" data-id="${esc(sp.gid)}">Texte officiel complet</button>` : ''}`;
    if (pools) h += `<div class="lp-pools">${pools.length ? pools.map(p => `<button type="button" data-act="castgo" data-key="${esc(key)}" data-pool="${esc(p.k)}">${esc(p.label)}</button>`).join('') : '<em>Aucune ressource disponible</em>'}<button type="button" class="ghost" data-act="castno">Annuler</button></div>`;
    return h + '</article>';
  }

  function spellsPanel(c, st) {
    const q = view.q.trim().toLowerCase(), nrm = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), nq = nrm(q);
    const prepared = n => (st.prep || []).includes(n);
    const list = c.spells.filter(s => {
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
      ${c.prepMax ? `<div class="lp-prepbar"><span>Préparés : <b>${nPrep}</b> / ${c.prepMax}</span><button type="button" class="lp-chip ${view.showAll ? 'on' : ''}" data-act="showall">Voir toute la liste de classe</button></div>` : ''}</div>
      ${order.map(g => { const ls = list.filter(s => groupOf(s) === g); return ls.length ? `<h4 class="lp-lvh">${esc(g)}<small>${ls.length}</small></h4><div class="lp-grid">${ls.map(s => spellCard(c, st, s)).join('')}</div>` : ''; }).join('') || '<p class="lp-empty">Aucun résultat.</p>'}`;
  }

  function featsPanel(c) {
    const fs = c.feats || [], gs = []; fs.forEach(f => { if (!gs.includes(f.grp)) gs.push(f.grp); });
    return gs.map(g => `<h4 class="lp-lvh">${esc(g)}<small>${fs.filter(f => f.grp === g).length}</small></h4><div class="lp-grid">${fs.filter(f => f.grp === g).map(f => `<article class="lp-spell lp-feat"><div class="lp-sh"><span class="lp-sname"><b>${esc(f.n)}</b>${f.en ? `<small class="lp-en">${esc(f.en)}</small>` : ''}</span></div><p class="lp-desc">${rich(f.d)}</p></article>`).join('')}</div>`).join('') || '<p class="lp-empty">Aucune capacité.</p>';
  }
  function weaponsPanel(c) {
    return `<div class="lp-wgrid">${c.weapons.map(w => `<article class="lp-weapon">
      <header><h4>${esc(w.n)}</h4>${w.arc ? `<span class="lp-arc">${esc(w.arc)}</span>` : ''}</header>
      ${w.hit || w.dmg ? `<div class="lp-wstat">${w.hit ? `<div><span>Toucher</span><b>${esc(w.hit)}</b></div>` : ''}${w.dmg ? `<div><span>Dégâts</span><b>${esc(w.dmg)}</b></div>` : ''}</div>` : ''}
      <p>${rich(w.note)}</p>${w.pw && w.pw.length ? `<ul>${w.pw.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</article>`).join('')}</div>`;
  }

  function restBlock() {
    const cf = view.confirm;
    if (cf) return `<section class="lp-block rests"><p class="lp-cfq">${cf === 'long' ? 'Repos long : PV, emplacements et ressources restaurés, charges d\'aube relancées.' : 'Repos court : pacte, ressources de repos court et 1 Forme sauvage.'}</p><div class="lp-cfb"><button type="button" class="go" data-act="restgo" data-type="${cf}">Confirmer le repos ${cf === 'long' ? 'long' : 'court'}</button><button type="button" class="ghost" data-act="restno">Annuler</button></div></section>`;
    return '<section class="lp-block rests"><button type="button" data-act="rest" data-type="court">Repos court</button><button type="button" data-act="rest" data-type="long">Repos long</button></section>';
  }

  function playerView() {
    const c = cfgOf(view.char), st = S(c.id);
    const tab = view.tab || (c.id === 'harfang' ? 'sorts' : 'armes');
    return `<header class="lp-hero"><div class="lp-art"><img class="lp-portrait" src="${esc(c.portrait)}" alt="${esc(c.nom)}" decoding="async"></div>
      <div class="lp-id"><span class="lp-kicker">${view.fromDM ? 'Fiche ouverte par le MJ' : 'Liveplay'}</span><h1>${esc(c.nom)}</h1><p>${esc(c.classe)}</p>
      <div class="lp-stats"><div><b>${c.ca}</b><span>CA</span></div><div><b>${c.dc}</b><span>DD sorts</span></div><div><b>+${c.atk}</b><span>Att. sort</span></div><div><b>${st.hp}</b><span>PV</span></div></div>
      ${st.conc ? `<div class="lp-conc"><span>Concentration : <b>${esc(st.conc)}</b></span><button type="button" data-act="endconc">Terminer</button></div>` : ''}</div></header>
    <div class="lp-cols"><aside class="lp-side">
      <section class="lp-block"><h3>Points de vie</h3><div class="lp-hp"><b class="n">${st.hp}</b><span>/ ${c.hp}</span>${st.tmp ? `<em>+${st.tmp} temp</em>` : ''}</div>${hpBar(c, st)}
        <div class="lp-hpctl"><button type="button" class="dmg" data-act="hp" data-type="dmg">Dégâts</button><input type="number" min="0" inputmode="numeric" id="lp-hp-amt" placeholder="0" aria-label="Montant"><button type="button" class="heal" data-act="hp" data-type="heal">Soins</button><button type="button" class="tmp" data-act="hp" data-type="tmp">PV temporaires</button></div></section>
      <section class="lp-block"><h3>Emplacements de sort</h3>${slotRows(c, st, false)}</section>
      <section class="lp-block"><h3>Ressources</h3>${resRows(c, st, false)}</section>
      <section class="lp-block"><h3>Or</h3><div class="lp-gold"><b>${st.gold}</b><span>po</span></div><div class="lp-hpctl g"><button type="button" data-act="gold" data-sign="-1">Dépenser</button><input type="number" min="0" inputmode="numeric" id="lp-gold-amt" placeholder="0" aria-label="Montant en or"><button type="button" data-act="gold" data-sign="1">Gagner</button></div></section>
      ${restBlock()}
    </aside><main class="lp-main"><div class="lp-tabs" role="tablist"><button type="button" role="tab" class="${tab === 'armes' ? 'on' : ''}" data-act="tab" data-v="armes">Armes</button><button type="button" role="tab" class="${tab === 'sorts' ? 'on' : ''}" data-act="tab" data-v="sorts">Sorts et pouvoirs</button><button type="button" role="tab" class="${tab === 'capa' ? 'on' : ''}" data-act="tab" data-v="capa">Capacités</button></div>
      ${tab === 'armes' ? weaponsPanel(c) : tab === 'capa' ? featsPanel(c) : spellsPanel(c, st)}</main></div>`;
  }

  const ago = iso => { const s = Math.max(0, (Date.now() - new Date(iso)) / 1000); return s < 60 ? 'à l\'instant' : s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : Math.floor(s / 86400) + ' j'; };

  function dmView() {
    const cards = CFG.chars.map(c => {
      const st = S(c.id);
      return `<article class="lp-dmcard"><div class="lp-dmh"><img src="${esc(c.chibi)}" alt=""><div><h3>${esc(c.court)}</h3><p>${esc(c.classe)}</p></div>${st.conc ? `<span class="lp-cbadge" title="Concentration">${esc(st.conc)}</span>` : ''}</div>
        <div class="lp-hp sm"><b class="n">${st.hp}</b><span>/ ${c.hp}</span>${st.tmp ? `<em>+${st.tmp}</em>` : ''}<span class="gold">${st.gold} po</span></div>${hpBar(c, st)}
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
    const vals = {}; ['lp-hp-amt', 'lp-gold-amt'].forEach(i => { const e = root.querySelector('#' + i); if (e) vals[i] = e.value; });
    const body = view.mode === 'dm' ? dmView() : view.mode === 'player' ? playerView() : pickView();
    root.innerHTML = `<a class="pn-back lp-back" href="#/">‹ Retour au Codex</a><span class="lp-state ${online ? 'on' : ''}">${online ? 'En direct' : 'Hors ligne'}</span>${body}${popup()}<div class="lp-toast" role="status"></div>`;
    Object.keys(vals).forEach(i => { const e = root.querySelector('#' + i); if (e) e.value = vals[i]; });
    if (page) page.scrollTop = top;
    if (keep) { const e = root.querySelector('#' + keep.id); if (e) { e.focus(); if (keep.s != null && e.setSelectionRange && e.type !== 'number') { try { e.setSelectionRange(keep.s, keep.s); } catch (x) { /* ignore */ } } } }
  }

  /* ---------- evenements ---------- */
  function go(sub) {
    if (!CFG || !root) return;
    sub = (sub || '').split('?')[0];
    const keepDM = view._dmOpen; view._dmOpen = false;
    view.fromDM = !!keepDM && sub !== 'dm' && sub !== '';
    view.cast = null; view.confirm = null; view.open = null; view.q = ''; view.act = 'all';
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
    if (a === 'hp') { const i = root.querySelector('#lp-hp-amt'); const v = i.value; i.value = ''; return hpAct(c, b.dataset.type, v); }
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
    if (a === 'cast') { view.cast = view.cast === b.dataset.key ? null : b.dataset.key; view.open = b.dataset.key; return render(); }
    if (a === 'castno') { view.cast = null; return render(); }
    if (a === 'castgo') return cast(c, cfgOf(c).spells.find(s => s.n === b.dataset.key), b.dataset.pool);
  }
  function onInput(e) {
    if (e.target.id === 'lp-q') { view.q = e.target.value; render(); }
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
