/* Liveplay : tableau de bord des joueurs et tour de controle du MJ.
   Etat partage via Supabase (lecture ouverte, ecriture par code). Repli local si hors ligne. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const REST_LABEL = { court: 'repos court', long: 'repos long', aube: 'aube' };
  let CFG = null, root = null, sb = null, online = false, chan = null;
  let ST = {};            // etat par personnage
  let EV = [];            // journal
  let view = { mode: 'gate', char: null, role: null, q: '', prepOnly: false, open: null, cast: null, filterChar: 'all' };
  let LV = 'lp_v1';

  const codeKey = id => 'lp_code_' + id;
  const getCode = id => { try { return localStorage.getItem(codeKey(id)) || ''; } catch (e) { return ''; } };
  const setCode = (id, v) => { try { localStorage.setItem(codeKey(id), v); } catch (e) { /* ignore */ } };
  const localKey = id => 'lp_state_' + id;

  /* ---------- etat ---------- */
  const cfgOf = id => CFG.chars.find(c => c.id === id);
  function fresh(c) { return { hp: c.hp, tmp: 0, slots: {}, pact: 0, res: {}, gold: 0, conc: null, prep: [], rev: 0 }; }
  function norm(c, s) {
    const b = fresh(c), o = Object.assign(b, s || {});
    o.slots = o.slots || {}; o.res = o.res || {}; o.prep = o.prep || [];
    return o;
  }
  const S = id => (ST[id] = norm(cfgOf(id), ST[id]));

  async function save(id, ev) {
    const st = S(id);
    try { localStorage.setItem(localKey(id), JSON.stringify(st)); } catch (e) { /* ignore */ }
    const entry = ev ? { at: new Date().toISOString(), char_id: id, actor: view.role === 'dm' ? 'dm' : 'player', kind: ev.kind || 'action', label: ev.label, payload: {} } : null;
    if (entry) { EV.unshift(entry); EV = EV.slice(0, 80); }
    render();
    if (!online) return;
    try {
      const { data, error } = await sb.rpc('lp_save', { p_char: id, p_code: getCode(view.role === 'dm' ? 'dm' : id), p_state: st, p_event: ev ? { kind: ev.kind || 'action', label: ev.label, payload: {} } : null });
      if (error) throw error;
      st.rev = data;
    } catch (e) { toast('Sauvegarde impossible : ' + (e.message || e)); }
  }

  function toast(msg) {
    const t = root && root.querySelector('.lp-toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 3500);
  }

  /* ---------- connexion Supabase ---------- */
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
      data.forEach(r => { ST[r.id] = norm(cfgOf(r.id) || { hp: 1 }, Object.assign({}, r.state, { rev: r.rev })); });
      const ev = await sb.from('events').select('*').order('at', { ascending: false }).limit(80);
      EV = ev.data || [];
      chan = sb.channel('lp-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, p => {
          const r = p.new; if (!r || !cfgOf(r.id)) return;
          if ((ST[r.id] && ST[r.id].rev >= r.rev)) return;
          ST[r.id] = norm(cfgOf(r.id), Object.assign({}, r.state, { rev: r.rev })); render();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, p => {
          const e = p.new; if (!e || EV.some(x => x.id && x.id === e.id)) return;
          if (EV.some(x => !x.id && x.label === e.label && x.char_id === e.char_id && Math.abs(new Date(x.at) - new Date(e.at)) < 5000)) return;
          EV.unshift(e); EV = EV.slice(0, 80); render();
        })
        .subscribe();
      online = true;
    } catch (e) { online = false; }
    CFG.chars.forEach(c => {
      if (!ST[c.id] || !ST[c.id].rev) {
        try { const l = JSON.parse(localStorage.getItem(localKey(c.id)) || 'null'); if (l && !online) ST[c.id] = norm(c, l); } catch (e) { /* ignore */ }
      }
      S(c.id);
    });
  }

  /* ---------- actions ---------- */
  const total = (c, lv) => c.slots[lv] || 0;
  const used = (st, lv) => st.slots[lv] || 0;
  function say(id, label, kind) { return save(id, { label, kind }); }

  function togglePip(id, kind, key, idx) {
    const c = cfgOf(id), st = S(id);
    if (kind === 'slot') {
      const u = used(st, key), spend = idx >= total(c, key) - u;
      st.slots[key] = Math.max(0, Math.min(total(c, key), u + (spend ? 1 : -1)));
      if (st.slots[key] === u) return;
      return say(id, `${spend ? 'Dépense' : 'Récupère'} un emplacement de niveau ${key} (reste ${total(c, key) - st.slots[key]}/${total(c, key)})`, 'slot');
    }
    if (kind === 'pact') {
      const n = c.pact.n, spend = idx >= n - st.pact;
      const before = st.pact;
      st.pact = Math.max(0, Math.min(n, st.pact + (spend ? 1 : -1)));
      if (st.pact === before) return;
      return say(id, `${spend ? 'Dépense' : 'Récupère'} un emplacement de pacte (reste ${n - st.pact}/${n})`, 'slot');
    }
    const r = c.resources.find(x => x.id === key), u = st.res[key] || 0, spend = idx >= r.max - u;
    st.res[key] = Math.max(0, Math.min(r.max, u + (spend ? 1 : -1)));
    if (st.res[key] === u) return;
    return say(id, `${spend ? 'Utilise' : 'Récupère'} ${r.nom} (reste ${r.max - st.res[key]}/${r.max})`, 'res');
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

  function rest(id, type) {
    const c = cfgOf(id), st = S(id);
    c.resources.forEach(r => {
      if (type === 'long' ? true : r.reset === 'court') st.res[r.id] = 0;
    });
    if (c.pact) st.pact = 0;
    if (type === 'long') { st.slots = {}; st.hp = c.hp; st.tmp = 0; st.conc = null; }
    return say(id, type === 'long' ? 'Repos long : ressources et PV restaurés' : 'Repos court : pacte et ressources de repos court restaurés', 'rest');
  }

  function cast(id, spell, pool) {
    const c = cfgOf(id), st = S(id);
    let cost = '';
    if (pool === 'free') { st.res[spell.res] = (st.res[spell.res] || 0) + 1; const r = c.resources.find(x => x.id === spell.res); cost = `ressource ${r.nom}`; }
    else if (pool === 'pact') { st.pact += 1; cost = `emplacement de pacte (niveau ${c.pact.lvl})`; }
    else if (pool !== 'cantrip') { st.slots[pool] = used(st, pool) + 1; cost = `emplacement de niveau ${pool}`; }
    let extra = '';
    if (spell.c) { if (st.conc && st.conc !== spell.n) extra = `, abandonne ${st.conc}`; st.conc = spell.n; }
    view.cast = null;
    return say(id, `Lance ${spell.n}${cost ? ' (' + cost + ')' : ''}${extra}${spell.c ? ', concentration' : ''}`, 'spell');
  }

  function poolsFor(c, st, spell) {
    const out = [];
    if (spell.lv === 0) return [{ k: 'cantrip', label: 'Sort mineur (gratuit)' }];
    if (spell.res && (st.res[spell.res] || 0) < (c.resources.find(x => x.id === spell.res) || { max: 0 }).max) out.push({ k: 'free', label: 'Gratuit : ' + c.resources.find(x => x.id === spell.res).nom });
    if (!spell.pactonly) Object.keys(c.slots).map(Number).sort((a, b) => a - b).forEach(lv => {
      if (lv >= spell.lv && total(c, lv) - used(st, lv) > 0) out.push({ k: String(lv), label: `Emplacement niveau ${lv} (${total(c, lv) - used(st, lv)} restant${total(c, lv) - used(st, lv) > 1 ? 's' : ''})` });
    });
    if (c.pact && c.pact.lvl >= spell.lv && c.pact.n - st.pact > 0) out.push({ k: 'pact', label: `Pacte niveau ${c.pact.lvl} (${c.pact.n - st.pact} restant${c.pact.n - st.pact > 1 ? 's' : ''})` });
    return out;
  }

  /* ---------- rendu ---------- */
  const pips = (n, usedN, kind, key, cls) => {
    let h = '';
    for (let i = 0; i < n; i++) h += `<button type="button" class="lp-pip ${cls || ''} ${i >= n - usedN ? 'used' : ''}" data-act="pip" data-kind="${kind}" data-key="${esc(key)}" data-idx="${i}" aria-label="${esc(kind)} ${esc(key)}, ${i >= n - usedN ? 'utilisé' : 'disponible'}"></button>`;
    return h;
  };
  const rpips = (n, usedN, cls) => { let h = ''; for (let i = 0; i < n; i++) h += `<span class="lp-pip ro ${cls || ''} ${i >= n - usedN ? 'used' : ''}"></span>`; return h; };

  function hpBar(c, st) {
    const p = Math.max(0, Math.min(100, st.hp / c.hp * 100)), t = Math.min(100 - p, st.tmp / c.hp * 100);
    const tone = p > 50 ? 'ok' : p > 25 ? 'mid' : 'low';
    return `<div class="lp-hpbar ${tone}"><i style="width:${p}%"></i><b style="width:${t}%"></b></div>`;
  }

  function slotRows(c, st, ro) {
    const lv = Object.keys(c.slots).sort((a, b) => a - b);
    let h = lv.map(l => `<div class="lp-row"><span class="lp-lv">Niv. ${l}</span><span class="lp-pips">${ro ? rpips(total(c, l), used(st, l)) : pips(total(c, l), used(st, l), 'slot', l)}</span></div>`).join('');
    if (c.pact) h += `<div class="lp-row"><span class="lp-lv pact">Pacte ${c.pact.lvl}</span><span class="lp-pips">${ro ? rpips(c.pact.n, st.pact, 'pact') : pips(c.pact.n, st.pact, 'pact', 'pact', 'pact')}</span></div>`;
    return h;
  }
  function resRows(c, st, ro) {
    return c.resources.map(r => `<div class="lp-row res"><span class="lp-nm">${esc(r.nom)}<small>${REST_LABEL[r.reset]}</small></span><span class="lp-pips">${ro ? rpips(r.max, st.res[r.id] || 0, 'res') : pips(r.max, st.res[r.id] || 0, 'res', r.id, 'res')}</span></div>`).join('');
  }

  function spellCard(c, st, sp) {
    const key = sp.n, open = view.open === key, prep = st.prep.includes(key), conc = st.conc === key;
    const pools = view.cast === key ? poolsFor(c, st, sp) : null;
    const tag = sp.src ? `<span class="lp-src">${esc(sp.src)}</span>` : '';
    let h = `<article class="lp-spell ${open ? 'open' : ''} ${conc ? 'conc' : ''}">
      <div class="lp-sh"><button type="button" class="lp-sname" data-act="open" data-key="${esc(key)}"><b>${esc(sp.n)}</b>${tag}<span class="lp-meta">${esc(sp.t)} · ${esc(sp.p)}${sp.c ? ' · Concentration' : ''}</span></button>
      <button type="button" class="lp-prep ${prep ? 'on' : ''}" data-act="prep" data-key="${esc(key)}" title="Préparer pour la journée" aria-pressed="${prep}">${prep ? '★' : '☆'}</button>
      <button type="button" class="lp-cast" data-act="cast" data-key="${esc(key)}">Lancer</button></div>`;
    if (open) h += `<p class="lp-desc">${esc(sp.d)}</p>`;
    if (pools) h += `<div class="lp-pools">${pools.length ? pools.map(p => `<button type="button" data-act="castgo" data-key="${esc(key)}" data-pool="${esc(p.k)}">${esc(p.label)}</button>`).join('') : '<em>Aucun emplacement disponible</em>'}<button type="button" class="ghost" data-act="castno">Annuler</button></div>`;
    return h + '</article>';
  }

  function spellsPanel(c, st) {
    if (!c.spells.length) return `<section class="lp-block"><h3>Grimoire</h3><p class="lp-empty">Le grimoire de ${esc(c.court)} sera ajouté prochainement. Les emplacements et les ressources fonctionnent déjà.</p></section>`;
    const q = view.q.trim().toLowerCase();
    const list = c.spells.filter(s => (!q || (s.n + ' ' + (s.src || '')).toLowerCase().includes(q)) && (!view.prepOnly || st.prep.includes(s.n) || s.lv === 0));
    const lvls = [...new Set(list.map(s => s.lv))].sort((a, b) => a - b);
    return `<section class="lp-block"><div class="lp-bar"><h3>Grimoire</h3><input type="search" id="lp-q" value="${esc(view.q)}" placeholder="Chercher un sort ou une arme" aria-label="Chercher"><label class="lp-chk"><input type="checkbox" id="lp-prep" ${view.prepOnly ? 'checked' : ''}> Préparés du jour</label></div>
      ${lvls.map(l => `<h4 class="lp-lvh">${l === 0 ? 'Sorts mineurs' : 'Niveau ' + l}</h4><div class="lp-grid">${list.filter(s => s.lv === l).map(s => spellCard(c, st, s)).join('')}</div>`).join('') || '<p class="lp-empty">Aucun résultat.</p>'}</section>`;
  }

  function playerView() {
    const c = cfgOf(view.char), st = S(c.id);
    return `<div class="lp-hero"><img class="lp-portrait" src="${esc(c.portrait)}" alt="${esc(c.nom)}" decoding="async">
      <div class="lp-id"><span class="lp-kicker">${view.role === 'dm' ? 'Vue MJ' : 'Liveplay'}</span><h1>${esc(c.nom)}</h1><p>${esc(c.classe)} · CA ${c.ca}</p>
      ${st.conc ? `<div class="lp-conc"><span>Concentration : <b>${esc(st.conc)}</b></span><button type="button" data-act="endconc">Terminer</button></div>` : ''}</div></div>
    <div class="lp-cols"><aside class="lp-side">
      <section class="lp-block"><h3>Points de vie</h3><div class="lp-hp"><b class="n">${st.hp}</b><span>/ ${c.hp}</span>${st.tmp ? `<em>+${st.tmp} temp</em>` : ''}</div>${hpBar(c, st)}
        <div class="lp-hpctl"><button type="button" class="dmg" data-act="hp" data-type="dmg">Dégâts</button><input type="number" min="0" inputmode="numeric" id="lp-hp-amt" placeholder="0" aria-label="Montant"><button type="button" class="heal" data-act="hp" data-type="heal">Soins</button><button type="button" class="tmp" data-act="hp" data-type="tmp">PV temp</button></div></section>
      <section class="lp-block"><h3>Emplacements de sort</h3>${slotRows(c, st, false)}</section>
      <section class="lp-block"><h3>Ressources</h3>${resRows(c, st, false)}</section>
      <section class="lp-block"><h3>Or</h3><div class="lp-gold"><b>${st.gold}</b><span>po</span></div><div class="lp-hpctl g"><button type="button" data-act="gold" data-sign="-1">Dépenser</button><input type="number" min="0" inputmode="numeric" id="lp-gold-amt" placeholder="0" aria-label="Montant en or"><button type="button" data-act="gold" data-sign="1">Gagner</button></div></section>
      <section class="lp-block rests"><button type="button" data-act="rest" data-type="court">Repos court</button><button type="button" data-act="rest" data-type="long">Repos long</button></section>
    </aside><div class="lp-main">${spellsPanel(c, st)}</div></div>`;
  }

  const ago = iso => { const s = Math.max(0, (Date.now() - new Date(iso)) / 1000); return s < 60 ? 'à l\'instant' : s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : Math.floor(s / 86400) + ' j'; };

  function dmView() {
    const cards = CFG.chars.map(c => {
      const st = S(c.id);
      return `<article class="lp-dmcard"><div class="lp-dmh"><img src="${esc(c.chibi)}" alt=""><div><h3>${esc(c.court)}</h3><p>${esc(c.classe)}</p></div>${st.conc ? `<span class="lp-cbadge" title="Concentration">${esc(st.conc)}</span>` : ''}</div>
        <div class="lp-hp sm"><b class="n">${st.hp}</b><span>/ ${c.hp}</span>${st.tmp ? `<em>+${st.tmp}</em>` : ''}<span class="gold">${st.gold} po</span></div>${hpBar(c, st)}
        <div class="lp-dmrows">${slotRows(c, st, true)}${resRows(c, st, true)}</div>
        <button type="button" class="lp-open" data-act="opench" data-char="${esc(c.id)}">Ouvrir la fiche</button></article>`;
    }).join('');
    const evs = EV.filter(e => view.filterChar === 'all' || e.char_id === view.filterChar);
    return `<div class="lp-hero dm"><div class="lp-id"><span class="lp-kicker">Vue MJ</span><h1>Tour de contrôle</h1><p>${online ? 'Synchronisation en direct' : 'Hors ligne : seules les données de cet appareil sont visibles'}</p></div></div>
      <div class="lp-dmwrap"><div class="lp-dmgrid">${cards}</div>
      <section class="lp-block lp-log"><div class="lp-bar"><h3>Journal</h3><select id="lp-fc" aria-label="Filtrer par personnage"><option value="all">Tous</option>${CFG.chars.map(c => `<option value="${c.id}" ${view.filterChar === c.id ? 'selected' : ''}>${esc(c.court)}</option>`).join('')}</select></div>
      <ul>${evs.map(e => `<li class="${esc(e.kind)}"><span class="who">${esc((cfgOf(e.char_id) || {}).court || e.char_id)}${e.actor === 'dm' ? ' (MJ)' : ''}</span> ${esc(e.label)}<time>${ago(e.at)}</time></li>`).join('') || '<li class="lp-empty">Aucune action pour le moment.</li>'}</ul></section></div>`;
  }

  function gateView() {
    return `<div class="lp-hero dm"><div class="lp-id"><span class="lp-kicker">Thaldera Codex</span><h1>Liveplay</h1><p>Choisis ton personnage pour suivre tes emplacements, tes PV et tes sorts en combat.</p></div></div>
      <div class="lp-gate">${CFG.chars.map(c => `<button type="button" class="lp-who" data-act="login" data-char="${esc(c.id)}"><img src="${esc(c.portrait)}" alt="" decoding="async"><span><b>${esc(c.court)}</b><small>${esc(c.classe)}</small></span></button>`).join('')}
      <button type="button" class="lp-who dm" data-act="login" data-char="dm"><span class="lp-dmico">MJ</span><span><b>Tour de contrôle</b><small>Réservé au MJ</small></span></button></div>
      ${view.ask ? `<form class="lp-ask" id="lp-form"><label for="lp-code">Code de ${view.ask === 'dm' ? 'la table' : esc(cfgOf(view.ask).court)}</label><input id="lp-code" type="password" autocomplete="off" autofocus><button type="submit">Entrer</button><button type="button" class="ghost" data-act="askno">Annuler</button><p class="lp-err">${esc(view.err || '')}</p></form>` : ''}`;
  }

  function render() {
    if (!root) return;
    const page = root.closest('.livepage'); const top = page ? page.scrollTop : 0;
    const body = view.mode === 'gate' ? gateView() : view.mode === 'dm' ? dmView() : playerView();
    const nav = view.mode === 'gate' ? '' : `<nav class="lp-nav"><button type="button" data-act="logout">Changer de personnage</button>${view.role === 'dm' && view.mode === 'player' ? '<button type="button" data-act="todm">Retour tour de contrôle</button>' : ''}<span class="lp-state ${online ? 'on' : ''}">${online ? 'En direct' : 'Hors ligne'}</span></nav>`;
    root.innerHTML = `<a class="pn-back lp-back" href="#/">‹ Retour au Codex</a>${nav}${body}<div class="lp-toast" role="status"></div>`;
    if (page) page.scrollTop = top;
    const q = root.querySelector('#lp-q'); if (q && view._focusQ) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    const code = root.querySelector('#lp-code'); if (code) code.focus();
  }

  /* ---------- evenements ---------- */
  async function tryLogin(id, code) {
    if (!code) return;
    let role = 'none';
    if (online) {
      try { const { data, error } = await sb.rpc('lp_check', { p_char: id === 'dm' ? 'dm' : id, p_code: code }); if (error) throw error; role = data; } catch (e) { role = 'none'; }
    } else role = 'local';
    const want = id === 'dm' ? 'dm' : 'player';
    if (role === 'local' || role === want || (role === 'dm' && id !== 'dm')) {
      if (role === 'dm' || id === 'dm') { setCode('dm', code); view.role = 'dm'; } else { setCode(id, code); view.role = 'player'; }
      view.ask = null; view.err = '';
      if (id === 'dm') { view.mode = 'dm'; } else { view.mode = 'player'; view.char = id; }
      try { sessionStorage.setItem('lp_last', id); } catch (e) { /* ignore */ }
      render();
    } else { view.err = 'Code incorrect.'; render(); }
  }

  function onClick(e) {
    const b = e.target.closest('[data-act]'); if (!b || !root.contains(b)) return;
    const a = b.dataset.act, c = view.char;
    view._focusQ = false;
    if (a === 'login') {
      const id = b.dataset.char, saved = getCode(id === 'dm' ? 'dm' : id);
      if (saved) return tryLogin(id, saved).then(() => { if (view.mode === 'gate') { view.ask = id; render(); } });
      view.ask = id; view.err = ''; return render();
    }
    if (a === 'askno') { view.ask = null; return render(); }
    if (a === 'logout') { view.mode = 'gate'; view.char = null; view.role = null; view.ask = null; return render(); }
    if (a === 'todm') { view.mode = 'dm'; return render(); }
    if (a === 'opench') { view.mode = 'player'; view.char = b.dataset.char; return render(); }
    if (!c) return;
    if (a === 'pip') return togglePip(c, b.dataset.kind, b.dataset.key, +b.dataset.idx);
    if (a === 'hp') { const i = root.querySelector('#lp-hp-amt'); const v = i.value; i.value = ''; return hpAct(c, b.dataset.type, v); }
    if (a === 'gold') { const i = root.querySelector('#lp-gold-amt'); const v = i.value; i.value = ''; return goldAct(c, +b.dataset.sign, v); }
    if (a === 'rest') { if (confirm(b.dataset.type === 'long' ? 'Repos long : tout est restauré. Confirmer ?' : 'Repos court. Confirmer ?')) return rest(c, b.dataset.type); return; }
    if (a === 'endconc') { const st = S(c), n = st.conc; st.conc = null; return say(c, `Termine la concentration sur ${n}`, 'spell'); }
    if (a === 'open') { view.open = view.open === b.dataset.key ? null : b.dataset.key; return render(); }
    if (a === 'prep') { const st = S(c), k = b.dataset.key; st.prep = st.prep.includes(k) ? st.prep.filter(x => x !== k) : st.prep.concat(k); return save(c, null); }
    if (a === 'cast') { view.cast = view.cast === b.dataset.key ? null : b.dataset.key; view.open = b.dataset.key; return render(); }
    if (a === 'castno') { view.cast = null; return render(); }
    if (a === 'castgo') { const sp = cfgOf(c).spells.find(s => s.n === b.dataset.key); return cast(c, sp, b.dataset.pool); }
  }
  function onInput(e) {
    if (e.target.id === 'lp-q') { view.q = e.target.value; view._focusQ = true; render(); }
    if (e.target.id === 'lp-prep') { view.prepOnly = e.target.checked; view._focusQ = false; render(); }
    if (e.target.id === 'lp-fc') { view.filterChar = e.target.value; render(); }
  }
  function onSubmit(e) {
    if (e.target.id !== 'lp-form') return;
    e.preventDefault(); tryLogin(view.ask, root.querySelector('#lp-code').value.trim());
  }

  /* ---------- montage ---------- */
  let tick = null;
  async function mount(el) {
    root = el;
    if (!CFG) CFG = await fetch('data/liveplay.json?v=' + (window.__VER || '')).then(r => r.json());
    root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onInput); root.addEventListener('submit', onSubmit);
    render();
    await connect();
    render();
    tick = setInterval(() => { if (view.mode === 'dm') render(); }, 30000);
  }
  function unmount() {
    clearInterval(tick);
    if (chan && sb) { try { sb.removeChannel(chan); } catch (e) { /* ignore */ } chan = null; }
    root = null; view.ask = null;
  }
  window.Liveplay = { mount, unmount };
})();
