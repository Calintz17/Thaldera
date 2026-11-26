/* Liveplay : fiches de table en direct (PV, emplacements, ressources, sorts, armes) et tour de controle du MJ.
   Etat partage via Supabase, acces libre en lecture et en ecriture (table de 4). Repli local si hors ligne. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* v158 : langage visuel HUD, indépendant des mécaniques. */
  const bg3 = k => `<span class="lp-bg3 i-${k}" aria-hidden="true"></span>`;
  const HUD = {
    fire:'<path d="M12 2c1 5-4 6-3 10 2-1 3-3 3-5 4 3 7 6 7 10a7 7 0 0 1-14 0c0-4 3-7 7-15Z"/><path d="M12 15c3 3 2 6 0 7-3-1-3-4 0-7Z"/>',
    cold:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M20 14l-4 1 1 4M4 14l4 1-1 4M20 10l-4-1 1-4"/>',
    lightning:'<path d="m14 2-9 12h7l-2 8 9-12h-7z"/>',
    necrotic:'<path d="M5 10a7 7 0 1 1 14 0c0 4-2 5-4 6v4H9v-4c-2-1-4-2-4-6Z"/><circle cx="9" cy="10" r="1.6"/><circle cx="15" cy="10" r="1.6"/><path d="M12 14v1m-1 5v-3m2 3v-3"/>',
    poison:'<path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/><path d="m9 13 6 5m0-5-6 5"/>',
    radiant:'<circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M19 5l-3 3m-8 8-3 3"/>',
    thunder:'<path d="M8 7a7 7 0 0 0 0 10m8-10a7 7 0 0 1 0 10M5 4a11 11 0 0 0 0 16M19 4a11 11 0 0 1 0 16"/><circle cx="12" cy="12" r="2"/>',
    acid:'<path d="M12 2c-3 6-7 10-7 14a7 7 0 0 0 14 0c0-4-4-8-7-14Z"/><path d="M8 17h3m2-4h2m-3 6h2"/>',
    force:'<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z"/><circle cx="12" cy="12" r="2"/>',
    psychic:'<path d="M4 12a8 8 0 1 1 8 8v-5h4v-3h-4V8H9v4z"/><path d="M2 5l3 2m15-4-2 3m4 5-3 1"/>',
    slashing:'<path d="m5 19 3-7L20 3l-9 12-6 4Zm-2 2 5-5m-3-3 6 6"/>',
    piercing:'<path d="m12 2 4 8-4 4-4-4 4-8Zm0 12v8M8 18h8"/>',
    bludgeoning:'<path d="m4 5 5-3 5 5-3 5-5-1Zm7 7 9 8-2 2-9-9"/>',
    magic:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/><path d="M4 4v4m-2-2h4m12 12v4m-2-2h4"/>',
    heal:'<path d="M12 21 3 12C-1 7 6 2 12 8c6-6 13-1 9 4Z"/><path d="M12 10v7m-3-3.5h6"/>',
    shield:'<path d="m12 2 8 3v7c0 5-5 8-8 10-3-2-8-5-8-10V5z"/><path d="M12 6v12M7 11h10"/>',
    nature:'<path d="M4 20C4 5 15 3 21 3c0 8-4 15-12 14m-5 3L17 7"/>',
    move:'<path d="M3 7h13l-4-4m4 4-4 4M2 13h19l-4 4m4-4-4-4M4 19h8"/>',
    target:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/>',
    die:'<path d="m12 2 9 6v9l-9 5-9-5V8zM12 2l-5 14h10L12 2ZM3 8l4 8 5 6 5-6 4-8M3 8h18"/>',
    use:'<path d="M8 13V5a2 2 0 0 1 4 0v5-2a2 2 0 0 1 4 0v3a2 2 0 0 1 4 0v5c0 4-3 6-7 6-3 0-5-2-7-5l-3-4c-1-2 1-4 3-2z"/>',
    book:'<path d="M3 4c4-1 7 0 9 3 2-3 5-4 9-3v15c-4-1-7 0-9 3-2-3-5-4-9-3zM12 7v15"/>',
    bag:'<path d="m8 7-2-5h12l-2 5c4 3 5 6 5 10 0 4-4 5-9 5s-9-1-9-5c0-4 1-7 5-10zM8 7h8"/>',
    person:'<circle cx="12" cy="6" r="4"/><path d="M3 22v-3a9 9 0 0 1 18 0v3z"/>',
    concentration:'<circle cx="12" cy="12" r="9"/><path d="M16 7a6 6 0 1 0 0 10"/>',
    ritual:'<circle cx="12" cy="12" r="9"/><path d="m12 5 6 11H6z"/>'
  };
  const hudLegacy = k => `<svg class="lp-hudsvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HUD[k] || HUD.magic}</svg>`;
  const hud = k => ['fire','cold','lightning','necrotic','poison','radiant','thunder','acid','force','psychic','slashing','piercing','bludgeoning','heal','move','target','concentration','ritual','bag'].includes(k) ? bg3(k) : k==='shield' ? bg3('save') : k==='book' ? bg3('spells') : k==='magic' ? bg3('spells') : '';
  const DMG = {feu:'fire',fire:'fire',froid:'cold',cold:'cold',foudre:'lightning',lightning:'lightning',necrotique:'necrotic',necrotic:'necrotic',poison:'poison',radiant:'radiant',radiants:'radiant',radiante:'radiant',radiantes:'radiant',tonnerre:'thunder',thunder:'thunder',acide:'acid',acid:'acid',force:'force',psychique:'psychic',psychic:'psychic',tranchant:'slashing',tranchants:'slashing',slashing:'slashing',percant:'piercing',percants:'piercing',perforant:'piercing',perforants:'piercing',piercing:'piercing',contondant:'bludgeoning',contondants:'bludgeoning',bludgeoning:'bludgeoning',arme:'slashing',weapon:'slashing'};
  const damageRx = () => /(\b\d+d\d+(?:\s*[+-]\s*\d+(?![\dd]))?|\b\d+)(\s+(?:(?:points?\s+de\s+)?dégâts?\s+(?:de\s+|d['’])?|damage\s+of\s+)?)(feu|fire|froid|cold|foudre|lightning|nécrotiques?|necrotic|poison|radiants?|radiantes?|tonnerre|thunder|acide|acid|force|psychiques?|psychic|tranchants?|slashing|perçants?|perforants?|piercing|contondants?|bludgeoning|arme|weapon)\b/giu;
  const damageKind = word => DMG[nrm0(word)] || DMG[nrm0(word).replace(/s$/, '')];
  function damageText(t) {
    const s = String(t == null ? '' : t); let h = '', p = 0;
    for (const m of s.matchAll(damageRx())) {
      const k = damageKind(m[3]); if (!k) continue;
      h += esc(s.slice(p,m.index)) + `<span class="lp-damage dmg-${k}">${esc(m[1]+m[2])}${hud(k)}${esc(m[3])}</span>`;
      p = m.index + m[0].length;
    }
    return h + esc(s.slice(p));
  }
  function damagePreview(t) {
    return [...String(t || '').matchAll(damageRx())].slice(0,2).map(m => damageText(m[0])).join(' <span class="lp-sep">/</span> ');
  }
  function spellGlyph(sp) {
    if (sp.heal) return 'heal';
    const e = nrm0((sp.en || '') + ' ' + sp.n);
    if (/misty step|dimension door|teleport|longstrider|jump|pas brumeux/.test(e)) return 'move';
    if (/shield|armor|armour|protection|ward|armure|bouclier/.test(e)) return 'shield';
    const m = damageRx().exec(sp.d || ''); if (m) return damageKind(m[3]) || 'magic';
    if (/heal|cure wounds|soin|healing/.test(e)) return 'heal';
    if (/plant|thorn|entangle|animal|nature|barkskin|growth|vine/.test(e)) return 'nature';
    return 'magic';
  }
  const tileIcon = k => `<span class="lp-tileico dmg-${k}">${hud(k)}</span>`;
  const cmdIcon = {Lancer:'magic',Utiliser:'use',Jet:'die',Toucher:'target',Dégâts:'slashing'};
  function iconCommand(html) {
    return String(html || '').replace(/<button\b([^>]*)>(Lancer|Utiliser|Jet|Toucher|Dégâts)<\/button>/g,(_,attrs,label)=>`<button${attrs.replace(/\s+title="[^"]*"/g,'')} title="${label}" aria-label="${label}">${esc(label)}</button>`);
  }
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
    if (!GX) return damageText(text);
    const hits = [];
    GX.forEach(({ re, arr }) => { re.lastIndex = 0; let m; while ((m = re.exec(text))) { const k = arr.findIndex((x, j) => m.groups['g' + j] != null); if (k < 0) continue; hits.push({ a: m.index, b: m.index + m[0].length, id: arr[k].id }); if (m[0].length === 0) re.lastIndex++; } });
    hits.sort((x, y) => x.a - y.a || (y.b - y.a) - (x.b - x.a));
    let out = '', pos = 0;
    for (const h of hits) {
      if (h.a < pos || h.id === selfId) continue;
      out += damageText(text.slice(pos, h.a)) + `<button type="button" class="lp-kw ${GL[h.id].kind}" data-act="kw" data-id="${esc(h.id)}" data-tip="k|${esc(h.id)}">${esc(text.slice(h.a, h.b))}</button>`;
      pos = h.b;
    }
    return out + damageText(text.slice(pos));
  }
  function popup() {
    const g = view.pop && GL && GL[view.pop]; if (!g) return '';
    const paras = t => String(t).split('\n').map(l => /^[•]/.test(l) ? `<p class="b">${rich(l, g.id)}</p>` : `<p>${rich(l, g.id)}</p>`).join('');
    const meta = g.kind === 'sort' ? `<p class="lp-pm">${g.lvl ? 'Niveau ' + g.lvl : 'Cantrip'}<i class="gap"></i>${esc(g.school)}<i class="gap"></i>${esc(g.cast)}<i class="gap"></i>Portée ${esc(g.range)}<i class="gap"></i>${esc(g.comp)}<i class="gap"></i>${esc(g.dur)}</p>` : '<p class="lp-pm">État</p>';
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
  const ico = t => ({'Action':bg3('action'),'Action bonus':bg3('bonus'),'Réaction':bg3('reaction')})[t] || '';
  const im = (n, cl) => `<img class="uic ${cl || ''}" src="img/ui/${n}.png" alt="" width="20" height="20" decoding="async">`;
  const RESET_NAME = { court: 'Repos court', long: 'Repos long', aube: 'À l\'aube', ws: 'Forme sauvage' };
  const ctl = (a, b, d, cl) => `<div class="lp-ctl ${cl || ''}"><div class="c1">${a || ''}</div><div class="c2">${iconCommand(b)}</div></div>`;
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
    if (ray) mult = +ray[1] + (sp.lv > 0 ? Math.max(0, lvl - sp.lv) : 0); if (dart) mult = +dart[1] + Math.max(0, lvl - sp.lv);
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
  const nl = t => damageText(t).replace(/\n/g, '<br>');
  function spellBody(c, sp, st) {
    const g = sp.gid && GL && GL[sp.gid];
    let h = `<h3>${esc(sp.n)}</h3>${sp.en ? `<span class="lp-en">${esc(sp.en)}</span>` : ''}<p class="lp-pm">${sp.lv ? 'Niveau ' + sp.lv : 'Cantrip'}<i class="gap"></i>${esc(sp.t)}${sp.p ? '<i class="gap"></i>' + esc(sp.p) : ''}${sp.c ? '<i class="gap"></i>Concentration' : ''}</p>`;
    h += `<p class="lp-originline">${esc(spellSource(c,sp))}</p>`;
    h += `<p>${nl(dcify(c, sp.d))}</p>`; if(sp.ruleSource||sp.duration)h+=`<p class="lp-pm">${esc([sp.ruleSource,sp.duration,sp.ritual?'Rituel (+10 min)':''].filter(Boolean).join(' / '))}</p>`;
    if (st && sp.lv >= 0) { const pk = pickPool(c, st, sp), lv = poolLvl(c, sp, pk.cur), x = spellDice(c, sp, lv); if (x && sp.lv > 0 && lv > sp.lv) h += `<p class="lp-hl">Au niveau ${lv} : ${diceStr(x)}</p>`; }
    return h;
  }
  function tipHtml(spec) {
    const [k, a, b] = spec.split('|'), c = view.char && cfgOf(view.char); let h = '';
    if (k === 'k' && GL && GL[a]) { const g = GL[a]; h = `<h3>${esc(g.fr)}</h3>${g.en ? `<span class="lp-en">${esc(g.en)}</span>` : ''}${String(g.text).split('\n').map(l => `<p>${nl(l)}</p>`).join('')}`; }
    else if (c && k === 's') { const sp = c.spells.find(x => x.n === a); if (sp) h = spellBody(c, sp, S(c.id)); }
    else if (c && k === 'p') { const w = c.weapons.find(x => x.n === a), o = w && w.pw[+b]; if (o) h = `<h3>${esc(o.n)}</h3><p class="lp-pm">${ico(typeOfPw(o.a))} ${esc(typeOfPw(o.a))}<i class="gap"></i>${esc(w.n)}</p><p>${nl(dcify(c, o.d))}</p>`; }
    else if (c && k === 'r') { const r = resOf(c, a); if (r) { const f = (c.feats || []).find(x => x.res === a), it = r.src && [].concat(c.weapons || [], c.gear || []).find(x => x.n === r.src); h = `<h3>${esc(r.nom)}</h3>${f && f.en ? `<span class="lp-en">${esc(f.en)}</span>` : ''}<p class="lp-pm">${r.a ? ico(typeOfPw(r.a)) + ' ' + esc(typeOfPw(r.a)) + '<i class="gap"></i>' : ''}${r.max} utilisation${r.max > 1 ? 's' : ''}<i class="gap"></i>${esc(REST_LABEL[r.reset] || r.reset)}${r.src ? '<i class="gap"></i>' + esc(r.src) : ''}</p><p>${nl(dcify(c, r.d || (f && f.d) || (it && it.note) || r.sub || ''))}</p>`; } }
    else if (c && k === 'w') { const w = c.weapons.find(x => x.n === a); if (w) h = `<h3>${esc(w.n)}</h3>${w.arc ? `<span class="lp-en">${esc(w.arc)}</span>` : ''}<p class="lp-pm">${w.hit ? 'Toucher '+esc(w.hit) : ''}${w.dmg ? ' / '+damageText(w.dmg) : ''}</p><p>${nl(dcify(c,w.note))}</p>`; }
    else if (c && k === 'f') { const f = (c.feats || [])[+a]; if (f) h = `<h3>${esc(f.n)}</h3>${f.en ? `<span class="lp-en">${esc(f.en)}</span>` : ''}<p>${nl(dcify(c, f.d))}</p>`; }
    return h;
  }
  function showTip(el) {
    const t = document.querySelector('body > .lp-tip') || root.querySelector('.lp-tip'); if (!t) return; const h = tipHtml(el.dataset.tip); if (!h) return hideTip();
    t.innerHTML = h; t.classList.add('on'); if(t.parentNode!==document.body)document.body.appendChild(t);
    const r = el.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    let x = Math.min(Math.max(8, r.left), vw - tw - 8), y = r.bottom + 8; if (y + th > vh - 8) y = Math.max(8, r.top - th - 8);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function hideTip() { const t = document.querySelector('body > .lp-tip') || (root && root.querySelector('.lp-tip')); if (t) t.classList.remove('on'); }
  function popupX() {
    const c = view.char && cfgOf(view.char); if (!c) return '';
    let body = '';
    if (view.popsp) { const sp = c.spells.find(x => x.n === view.popsp); if (sp) body = spellBody(c, sp, S(c.id)); }
    else if (view.popdetail) body = tipHtml(view.popdetail);
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
  const PREV = {}, HIST = {};
  const S = id => { ST[id] = norm(cfgOf(id), ST[id]); if (PREV[id] == null) PREV[id] = JSON.stringify(ST[id]); return ST[id]; };

  async function save(id, ev, noHist) {
    const st = S(id);
    if (!noHist && !(ev && (ev.kind === 'roll' || ev.kind === 'undo'))) {
      const cur = JSON.stringify(st);
      if (PREV[id] != null && PREV[id] !== cur) { (HIST[id] = HIST[id] || []).push({ snap: PREV[id], label: ev ? ev.label : 'Modification' }); if (HIST[id].length > 40) HIST[id].shift(); }
    }
    PREV[id] = JSON.stringify(st);
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
  function undo(id) {
    const h = HIST[id]; if (!h || !h.length) return toast('Rien à annuler');
    const last = h.pop(), rev = (ST[id] || {}).rev;
    ST[id] = norm(cfgOf(id), Object.assign(JSON.parse(last.snap), { rev }));
    return save(id, { label: 'Annulé : ' + last.label, kind: 'undo' }, true);
  }

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
      data.forEach(r => { if (cfgOf(r.id)) { ST[r.id] = norm(cfgOf(r.id), Object.assign({}, r.state, { rev: r.rev })); delete PREV[r.id]; } });
      const ev = await sb.from('events').select('*').order('at', { ascending: false }).limit(80);
      EV = ev.data || [];
      chan = sb.channel('lp-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, p => {
          const r = p.new; if (!r || !cfgOf(r.id)) return;
          if (ST[r.id] && ST[r.id].rev >= r.rev) return;
          ST[r.id] = norm(cfgOf(r.id), Object.assign({}, r.state, { rev: r.rev })); delete PREV[r.id]; render();
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
      const u = used(st, key), spend = idx < total(c, key) - u;
      st.slots[key] = Math.max(0, Math.min(total(c, key), u + (spend ? 1 : -1)));
      if (st.slots[key] === u) return;
      return say(id, `${spend ? 'Dépense' : 'Récupère'} un emplacement de niveau ${key} (reste ${total(c, key) - st.slots[key]}/${total(c, key)})`, 'slot');
    }
    if (kind === 'pact') {
      const n = c.pact.n, spend = idx < n - st.pact, before = st.pact;
      st.pact = Math.max(0, Math.min(n, st.pact + (spend ? 1 : -1)));
      if (st.pact === before) return;
      return say(id, `${spend ? 'Dépense' : 'Récupère'} un emplacement de pacte (reste ${n - st.pact}/${n})`, 'slot');
    }
    return resDelta(id, key, idx >= resOf(c, key).max - (st.res[key] || 0) ? -1 : 1);
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
    const rids = [].concat(sp.res || []);
    rids.forEach(id => { const r = resOf(c, id); if (r && left(c, st, id) > 0) out.push({ k: 'free:' + id, s: rids.length > 1 ? 'Gratuit : ' + (r.nom.match(/\(([^)]+)\)/) || [0, r.nom])[1] : 'Usage gratuit', label: 'Usage gratuit : ' + r.nom }); });
    if (sp.alt && left(c, st, sp.alt.res) >= sp.alt.n) out.push({ k: 'alt', s: 'Ressource', label: 'Dépenser : ' + resOf(c, sp.alt.res).nom });
    if (sp.lv === 0) { if (!sp.res) out.push({ k: 'cantrip', s: 'À volonté', label: 'Cantrip à volonté' }); return out; }
    if (!sp.pactonly) Object.keys(c.slots).map(Number).sort((a, b) => a - b).forEach(lv => {
      const l = total(c, lv) - used(st, lv);
      if (lv >= sp.lv && l > 0) out.push({ k: String(lv), s: `Niveau ${lv} (${l} restant${l > 1 ? 's' : ''})`, label: `Emplacement niveau ${lv} (${l} restant${l > 1 ? 's' : ''})` });
    });
    if (c.pact && c.pact.lvl >= sp.lv && c.pact.n - st.pact > 0) { const l = c.pact.n - st.pact; out.push({ k: 'pact', s: `Pacte niveau ${c.pact.lvl} (${l} restant${l > 1 ? 's' : ''})`, label: `Pacte niveau ${c.pact.lvl} (${l} restant${l > 1 ? 's' : ''})` }); }
    if (sp.ritual && !sp.src && !sp.lim && (!sp.lst || (st.prep||[]).includes(sp.n))) out.push({k:'ritual',s:'Rituel',label:'Rituel : +10 minutes, aucun emplacement'});
    return out;
  }
  function pickPool(c, st, sp) {
    const ps = poolsFor(c, st, sp), want = view.pool[sp.n];
    return { ps, cur: ps.find(p => p.k === want) || ps[0] };
  }
  function cast(id, sp, pool) {
    const c = cfgOf(id), st = S(id); let cost = '', lvl = sp.lv;
    if (/^free/.test(pool)) { const id = pool.split(':')[1] || [].concat(sp.res)[0]; st.res[id] = (st.res[id] || 0) + 1; cost = resOf(c, id).nom; }
    else if (pool === 'alt') { st.res[sp.alt.res] = (st.res[sp.alt.res] || 0) + sp.alt.n; cost = resOf(c, sp.alt.res).nom; }
    else if (pool === 'cost') { st.res[sp.cost.res] = (st.res[sp.cost.res] || 0) + sp.cost.n; cost = `${sp.cost.n} charge${sp.cost.n > 1 ? 's' : ''} ${resOf(c, sp.cost.res).nom}`; }
    else if (pool === 'pact') { st.pact += 1; lvl = c.pact.lvl; cost = `pacte niveau ${lvl}`; }
    else if (pool === 'ritual') cost = 'rituel, sans emplacement';
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
  const GLY = {
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="6.2" cy="18" r="3.3" fill="currentColor"/><circle cx="17.2" cy="15" r="3.3" fill="currentColor"/></svg>',
    die: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l9 5.2v10.6l-9 5.2-9-5.2V6.7z" fill="currentColor"/></svg>',
    paw: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><ellipse cx="5.5" cy="11" rx="2.3" ry="3"/><ellipse cx="9.5" cy="5.8" rx="2.3" ry="3"/><ellipse cx="14.5" cy="5.8" rx="2.3" ry="3"/><ellipse cx="18.5" cy="11" rx="2.3" ry="3"/><path d="M12 11c3.5 0 6 3.2 6 6 0 2.3-2 3.2-3.4 3-1.2-.2-1.6-.6-2.6-.6s-1.4.4-2.6.6c-1.4.2-3.4-.7-3.4-3 0-2.8 2.5-6 6-6z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 1.5L4.5 13.5h6.2l-1.4 9 9.2-12.5h-6.4z" fill="currentColor"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z" fill="currentColor"/></svg>',
    gem: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l8 10.5-8 10.5L4 12z" fill="currentColor"/></svg>'
  };
  const RGL = { bardic: 'note', sup: 'die', ws: 'paw' };
  const glyphOf = (c, r) => RGL[r.id] || (r.reset === 'aube' ? 'bolt' : (c.spells || []).some(q => [].concat(q.res || []).includes(r.id)) ? 'spark' : 'gem');
  const gpips = (c, r, u, ro) => {
    const g = glyphOf(c, r); let h = ''; const artwork = r.id==='bardic' ? bg3('bardic') : RIC[r.id] ? im(RIC[r.id], 'lp-resource-art') : '<span class="lp-neutralpip" aria-hidden="true"></span>';
    for (let i = 0; i < r.max; i++) { const us = i >= r.max - u; h += ro ? `<span class="lp-gp g-${g} ro ${us ? 'used' : ''}">${artwork}</span>` : `<button type="button" class="lp-gp g-${g} ${us ? 'used' : ''}" data-act="pip" data-kind="res" data-key="${esc(r.id)}" data-idx="${i}" aria-label="${esc(r.nom)} ${us ? 'utilisé' : 'disponible'}">${artwork}</button>`; }
    return h;
  };

  function hpBar(c, st) {
    const p = Math.max(0, Math.min(100, st.hp / c.hp * 100));
    return `<div class="lp-hpbar ${p > 50 ? 'ok' : p > 25 ? 'mid' : 'low'}"><i style="width:${p}%"></i></div>`;
  }
  function tmpBar(c, st) {
    const t = Math.max(0, Math.min(100, st.tmp / Math.max(10, c.hp / 3) * 100));
    return `<div class="lp-tbar ${st.tmp ? 'on' : ''}"><i style="width:${t}%"></i></div>`;
  }
  function resourceSource(c,r) {
    const feat=(c.feats||[]).find(f=>f.res===r.id||f.n===r.nom);
    const sources={bardic:'Barde',curse:'Hexblade',specter:'Hexblade : Spectre maudit',omen:'Signe de Mauvais Augure',misty:'Touché par les fées',feyhex:'Touché par les fées',drowff:'Magie drow',drowdk:'Magie drow',cartff:'Cartographe',carthw:'Cartographe',cartlo:'Cartographe',shsilent:'Touché par les ombres',shinvis:'Touché par les ombres',ws:'Druide',lstride:'Lignée elfique',pwt:'Lignée elfique'};
    return r.src||sources[r.id]||(feat&&feat.grp)||((r.nom.match(/\(([^)]+)\)/)||[])[1])||'Capacité du personnage';
  }
  function spellSource(c,sp) {
    const list=(c.lists||[]).find(l=>l.id===sp.lst);
    return [...new Set([sp.src,list&&list.nom,...[].concat(sp.res||[]).map(id=>resOf(c,id)).filter(Boolean).map(r=>resourceSource(c,r)),sp.cost&&resOf(c,sp.cost.res)&&resourceSource(c,resOf(c,sp.cost.res))].filter(Boolean))].join(' / ')||'Sort connu';
  }
  function resourceTitle(c,r) {
    return [r.nom,resourceSource(c,r),r.max+' utilisation'+(r.max>1?'s':'')+' / '+(REST_LABEL[r.reset]||r.reset||'recharge'),r.d||r.sub||''].filter(Boolean).join(' | ');
  }
  function slotRows(c, st, ro) {
    const groups=Object.keys(c.slots).sort((a,b)=>a-b).map(l=>({l,n:total(c,l),u:used(st,l),pact:false}));
    if(c.pact)groups.push({l:c.pact.lvl,n:c.pact.n,u:st.pact,pact:true});
    let html=groups.map(({l,n,u,pact})=>{
      const title=pact?'Pacte niveau '+l:'Emplacements niveau '+l;
      let gems='';
      for(let x=0;x<n;x++){
        const off=x>=n-u, cl='lp-gem '+(pact?'pact ':'')+(off?'used ':'')+(ro?'ro':'');
        gems+=ro?`<span class="${cl}" title="${title} : ${off?'utilisé':'disponible'}">${bg3(pact?'pact':'slot')}</span>`:`<button type="button" class="${cl}" data-act="pip" data-kind="${pact?'pact':'slot'}" data-key="${pact?'pact':l}" data-idx="${x}" title="${off?'Récupérer':'Dépenser'} : ${title}" aria-label="${off?'Récupérer':'Dépenser'} : ${title}">${bg3(pact?'pact':'slot')}</button>`;
      }
      return `<div class="lp-sg ${pact?'pactgroup':''}"><span class="lp-slotlevel">${pact?'Pacte '+l:'Niv. '+l}</span><span class="lp-slotgems">${gems}</span><small>${n-u}/${n}</small></div>`;
    }).join('');
    const bard=resOf(c,'bardic');
    if(bard)html+=`<div class="lp-sg lp-bardgroup" title="${esc(resourceTitle(c,bard))}"><span class="lp-slotlevel">Bardic</span><span class="lp-slotgems">${gpips(c,bard,st.res.bardic||0,ro)}</span><small>${bard.max-(st.res.bardic||0)}/${bard.max}</small></div>`;
    return html||'<span class="lp-none">Aucun emplacement</span>';
  }
  function resRows(c, st, ro, list) {
    return (list || visRes(c, st)).filter(r=>r.id!=='bardic').map(r => {
      const u = st.res[r.id] || 0, l = r.max - u;
      const ctl = r.id==='ws' ? gpips(c, r, u, ro) : ro ? `<b class="lp-cnt">${l}/${r.max}</b>` : `<button type="button" class="lp-stp" data-act="resd" data-key="${esc(r.id)}" data-d="1" aria-label="Dépenser">−</button><b class="lp-cnt">${l}/${r.max}</b><button type="button" class="lp-stp" data-act="resd" data-key="${esc(r.id)}" data-d="-1" aria-label="Récupérer">+</button>`;
      return `<div class="lp-row res ${l <= 0 ? 'spent' : ''}"><span class="lp-nm" title="${esc(resourceTitle(c,r))}" ${ro ? '' : `data-tip="r|${esc(r.id)}" data-act="detail" data-spec="r|${esc(r.id)}" role="button" tabindex="0"`}><b>${esc(r.nom)}</b><small class="lp-resourceorigin">${esc(resourceSource(c,r))} / ${r.max} par ${esc(REST_LABEL[r.reset]||r.reset||'recharge')}</small></span><span class="lp-pips">${ctl}</span></div>`;
    }).join('');
  }
  /* bandeau des objets equipes : une ligne par objet, bonus en texte, pouvoirs en pastilles */
  function equippedStrip(c, st) {
    const f = c.acfx || {}, sp = c.spd || {};
    const viaSp = c.spells.filter(q => q.res).reduce((a, q) => a.concat(q.res), []), viaCost = c.spells.filter(q => q.cost).map(q => q.cost.res);
    const chip = (tip, ico_, name, tag, attrs, off) => `<button type="button" class="lp-ic ${off ? 'off' : ''}" ${attrs} data-tip="${esc(tip)}" title="${esc(name)}" aria-label="${esc(name)}" ${off ? 'disabled' : ''}>${ico_}<span>${esc(name)}</span>${tag ? `<small>${esc(tag)}</small>` : ''}</button>`;
    const rows = eqNames(c, st).map(n => {
      const b = [];
      (f.add || []).filter(x => x[0] === n).forEach(x => b.push(`+${x[1]} CA`));
      (f.bloody || []).filter(x => x[0] === n).forEach(x => b.push(`+${x[1]} CA sous la moitié des PV`));
      (sp.add || []).filter(x => x[0] === n).forEach(x => b.push(`+${x[1]} ft de vitesse`));
      ((c.eqbon || {})[n] || []).forEach(t => b.push(t));
      const ch = [], pre = n.split(',')[0] + ', ', short = t => t.startsWith(pre) ? t.slice(pre.length) : t;
      const gi = g => '';
      c.resources.filter(r => r.src === n && !viaSp.includes(r.id) && !(r.max === 1 && viaCost.includes(r.id))).forEach(r => {
        const u = st.res[r.id] || 0, l = r.max - u;
        if (r.max > 1) ch.push(`<span class="lp-ires" data-tip="r|${esc(r.id)}"><span>${esc(/charges/i.test(r.nom) || r.nom === n || r.nom.startsWith(pre.trim()) && /Charges/i.test(r.sub || '') ? 'Charges' : r.nom.replace(n + ' : ', ''))}</span>${gpips(c, r, u, false)}</span>`);
        else ch.push(chip('r|' + r.id, `<i class="lp-gp g-${glyphOf(c, r)} ${l <= 0 ? 'used' : ''}">${GLY[glyphOf(c, r)]}</i>`, (r.nom === n ? (r.sub || 'Utiliser').split(',')[0] : r.nom.replace(n + ' : ', '')), '', `data-act="resd" data-key="${esc(r.id)}" data-d="1"`, l <= 0));
      });
      c.spells.filter(q => q.src === n).forEach(q => {
        const pk = pickPool(c, st, q), spent = pk.ps.length === 0;
        ch.push(chip('s|' + q.n, '', short(q.n), q.cost ? q.cost.n + (q.cost.n > 1 ? ' ch.' : ' ch.') : (q.res ? '1/j' : (q.lv ? 'Niv. ' + q.lv : '')), `data-act="cast" data-key="${esc(q.n)}"`, spent));
      });
      const w = c.weapons.find(x => x.n === n);
      (w && w.pw || []).forEach((o, i) => {
        if (typeof o === 'string' || o.sp) return;
        const ps = pwState(c, st, o), spent = ps && ps.spent;
        const act = ps && ps.kind === 'res' ? `data-act="pwuse" data-key="${esc(n)}" data-i="${i}"` : `data-act="pwx" data-key="${esc(n)}" data-i="${i}"`;
        ch.push(chip(`p|${n}|${i}`, gi('bolt'), short(o.n), ps && ps.kind === 'res' ? ps.txt : '', act, spent));
      });
      if (!b.length && !ch.length) return '';
      return `<div class="lp-eqrow"><div class="lp-eqh"><b>${esc(n)}</b>${b.length ? `<span>${b.map(damageText).join(' <span class="lp-sep">/</span> ')}</span>` : ''}</div>${ch.length ? `<div class="lp-ics">${ch.join('')}</div>` : ''}</div>`;
    }).join('');
    return rows;
  }

  function costBadge(c, sp) {
    if (sp.cost) return `<span class="lp-cb ch">${sp.cost.n} charge${sp.cost.n > 1 ? 's' : ''}</span>`;
    if (sp.lv === 0 && !sp.res) return '<span class="lp-cb">Gratuit</span>';
    if (sp.lv === 0) return '<span class="lp-cb free">1 / jour</span>';
    return `<span class="lp-cb">Niv. ${sp.lv}</span>`;
  }
  function cardTags(t,ritual,conc,active){
    return `<span class="lp-cardtype" aria-label="${esc(t)}"><span class="lp-tagconc" title="${active?'Concentration active':'Concentration requise'}">${conc?bg3('concentration'):''}</span><span class="lp-tagrit" title="Rituel">${ritual?bg3('ritual'):''}</span><span class="lp-tagact" title="${esc(t)}">${ico(t)}</span></span>`;
  }
  function resetCaption(r){return r?REST_LABEL[r.reset]||r.reset||'Recharge':'Recharge';}
  function spellCard(c,st,sp,inAction) {
    const key=sp.n,conc=st.conc===key,notEquipped=!isEq(c,st,sp.src),unprepared=sp.lst&&!(st.prep||[]).includes(key);
    const inactive=notEquipped||unprepared,{ps,cur}=pickPool(c,st,sp),spent=inactive||!ps.length,limUsed=sp.lim&&st.used[key],origin=spellSource(c,sp);
    const tags=cardTags(sp.t,sp.ritual,sp.c,conc);
    const poolLabel=p=>{
      if(p.k==='pact')return 'Pacte '+c.pact.lvl;
      if(/^\d+$/.test(p.k))return 'Niv. '+p.k;
      if(p.k==='cantrip')return 'À volonté';
      if(p.k==='ritual')return 'Rituel';
      if(p.k.startsWith('free:')){const r=resOf(c,p.k.slice(5));return r&&r.max===1&&r.reset==='long'?'1/day':r?`${left(c,st,r.id)}/${r.max}`:p.s;}
      return p.s;
    };
    const reason=notEquipped?'Non équipé':unprepared?'Non préparé':!ps.length?'Épuisé':'';
    const slotPools=ps.filter(p=>p.k==='pact'||/^\d+$/.test(p.k)),special=ps.filter(p=>p.k!=='pact'&&!/^\d+$/.test(p.k));
    let src='',extra='';
    if(spent)src=`<span class="lp-slotchip off">${reason}</span>`;
    else if(slotPools.length>1||slotPools.length&&special.length){
      src=`<select class="lp-pool" data-sp="${esc(key)}" aria-label="Emplacement ou source" title="${esc(cur.label||cur.s)}">${ps.map(p=>`<option value="${esc(p.k)}" ${p.k===cur.k?'selected':''}>${esc(poolLabel(p))}${p.k.startsWith('free:')?' / '+esc(resourceSource(c,resOf(c,p.k.slice(5)))):''}</option>`).join('')}</select>`;
    }else if(sp.cost){
      const r=resOf(c,sp.cost.res);
      src=`<span class="lp-slotchip" title="${esc(resetCaption(r))}">${sp.cost.n} ch. / ${left(c,st,r.id)}</span>`;
      extra=resetCaption(r);
    }else if(ps.length>1){
      src=`<div class="lp-poolchoices">${ps.map(p=>`<button type="button" class="lp-poolpick ${p.k===cur.k?'on':''}" data-act="poolpick" data-key="${esc(key)}" data-pool="${esc(p.k)}" title="${esc(p.label||p.s)}" aria-pressed="${p.k===cur.k}">${esc(poolLabel(p))}</button>`).join('')}</div>`;
    }else src=`<span class="lp-slotchip" title="${esc(cur.label||cur.s)}">${esc(poolLabel(cur))}</span>`;
    if(cur?.k?.startsWith('free:'))extra=resetCaption(resOf(c,cur.k.slice(5)));
    if(sp.cost&&!extra)extra=resetCaption(resOf(c,sp.cost.res));
    if(cur?.k==='ritual')extra='+10 min, hors combat';
    let btn=limUsed&&!inactive?`<button type="button" class="lp-cast lp-reset" data-act="unspend" data-key="${esc(key)}" title="Restaurer ce sort">Restaurer</button>`:`<button type="button" class="lp-cast" data-act="cast" data-key="${esc(key)}" ${spent?'disabled':''}>Lancer</button>`;
    if(!inAction){
      src=`<span class="lp-slotchip ${inactive?'off':''}">${notEquipped?'Non équipé':unprepared?'Non préparé':sp.lst?'Préparé':'Permanent'}</span>`;
      btn=sp.lst?`<button type="button" class="lp-cast lp-prepbtn ${unprepared?'':'selected'}" data-act="prep" data-key="${esc(key)}" aria-pressed="${!unprepared}">${unprepared?'Équiper':'Retirer'}</button>`:'';
      extra='';
    }
    return `<article class="lp-spell lp-hudcard lp-spellplain ${conc?'conc':''} ${inAction&&spent?'spent':''} ${inactive?'lp-inactive':''}" data-level="${sp.lv}">
      <button type="button" class="lp-sname" data-act="gopen" data-key="${esc(key)}" data-tip="s|${esc(key)}" aria-label="Détails : ${esc(key)}" title="${esc(origin+' | '+sp.d)}"><span class="lp-cardtitle"><b title="${esc(sp.n)}">${esc(sp.n)}</b>${sp.en?`<small class="lp-en">${esc(sp.en)}</small>`:''}</span>${tags}</button>
      <div class="lp-combatmeta"><span class="lp-range" title="${esc(sp.p||'')}">${bg3('target')}${esc(sp.p||'')}</span><span class="lp-dmgpreview">${damagePreview(sp.d)}</span></div>
      <div class="lp-spellorigin" title="${esc(origin+' / '+(sp.ruleSource||''))}">${esc(origin)}${extra?' / '+esc(extra):''}</div>${ctl(src,btn,'')}</article>`;
  }
  function actionFilters(q, act, includeOut) {
    return `<div class="lp-hudfilters"><input type="search" id="lp-q" value="${esc(q)}" placeholder="Rechercher" aria-label="Rechercher"><div class="lp-chips" aria-label="Filtrer par type d'action">${['all'].concat(includeOut?ACTS:ACTS.slice(0,3)).map(a=>`<button type="button" class="lp-chip ${act===a?'on':''}" data-act="actf" data-v="${esc(a)}" aria-pressed="${act===a}">${ico(a)}${a==='all'?'Tout':esc(a)}</button>`).join('')}</div></div>`;
  }
  const hudLegend = () => `<div class="lp-hudlegend"><span>${hud('magic')} Lancer</span><span>${hud('use')} Utiliser</span><span>${hud('target')} Toucher</span><span>${hud('slashing')} Dégâts</span><span>${hud('die')} Jet</span></div>`;
  function spellsPanel(c,st){
    const nq=nrm0(view.q.trim()),list=c.spells.filter(s=>(view.act==='all'||s.t===view.act)&&(!nq||nrm0(s.n+' '+(s.en||'')+' '+s.d+' '+spellSource(c,s)).includes(nq)));
    const levels=[...new Set(list.map(s=>s.lv))].sort((a,b)=>a-b);
    const available=s=>isEq(c,st,s.src)&&(!s.lst||(st.prep||[]).includes(s.n));
    const counters=(c.lists||[]).map(l=>{const selected=c.spells.filter(s=>s.lst===l.id&&(st.prep||[]).includes(s.n));return `<span><b>${esc(l.nom)}</b> : ${selected.filter(s=>s.lv===0).length}${l.cant?'/'+l.cant:''} cantrips / ${selected.filter(s=>s.lv>0).length}${l.max?'/'+l.max:''} sorts</span>`;}).join('');
    return `<div class="lp-loadoutsummary">${counters}</div>${actionFilters(view.q,view.act,true)}${levels.map(lv=>{
      const ls=list.filter(s=>s.lv===lv).sort((a,b)=>Number(available(b))-Number(available(a))||a.n.localeCompare(b.n,'fr'));
      return `<h4 class="lp-lvh">${lv===0?'Cantrips':'Niveau '+lv}</h4><div class="lp-grid lp-hotgrid lp-spellgrid">${ls.map(s=>spellCard(c,st,s,false)).join('')}</div>`;
    }).join('')||'<p class="lp-empty">Aucun résultat.</p>'}`;
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
        return ls.length ? `<h5 class="lp-gl">${lv === 0 ? 'Cantrips' : 'Niveau ' + lv}<small>${ls.filter(s => on(s.n)).length} / ${ls.length}</small></h5><div class="lp-glist">${ls.map(s => `<div class="lp-grow ${on(s.n) ? 'on' : ''}"><button type="button" class="lp-gt" data-act="prep" data-key="${esc(s.n)}" aria-pressed="${on(s.n)}" aria-label="${on(s.n) ? 'Retirer' : 'Ajouter'} ${esc(s.n)}">${on(s.n) ? '★' : '☆'}</button><button type="button" class="lp-gn" data-act="gopen" data-key="${esc(s.n)}" data-tip="s|${esc(s.n)}"><b>${esc(s.n)}</b>${s.en ? `<small class="lp-en">${esc(s.en)}</small>` : ''}</button></div>`).join('')}</div>` : '';
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
    if (o.res) { const l = left(c, st, o.res), r = resOf(c, o.res); return { kind: 'res', spent: l < o.cost, txt: r.max > 1 ? `${l}/${r.max} charges` : (l ? 'Disponible' : 'Utilisé') }; }
    return null;
  }
  function rarityOf(o) {
    const t=nrm0([o&&o.rarity,o&&o.rarete,o&&o.note,o&&o.d].filter(Boolean).join(' '));
    if(/\b(legendaire|legendary)\b/.test(t))return 'legendary';
    if(/\b(tres rare|very rare)\b/.test(t))return 'veryrare';
    if(/\b(peu commun|uncommon|peu commune)\b/.test(t))return 'uncommon';
    if(/\b(rare)\b/.test(t))return 'rare';
    if(/\b(commun|common|commune)\b/.test(t))return 'common';
    return 'unknown';
  }
  function equipPanel(c, st) {
    const card = w => {
      const fx = w.fixed || w.perma, on = fx || st.eq.includes(w.n);
      const hd = `<span class="lp-eqname"><h4>${esc(w.n)}</h4>${w.arc ? `<em>${esc(w.arc)}</em>` : ''}</span><span class="lp-eqst">${w.perma ? 'Permanent' : on ? 'Équipé' : 'Non équipé'}</span>`;
      const stat = w.hit || w.dmg ? `<p class="lp-wst">${w.hit ? `<b>${esc(w.hit)}</b>` : ''}${w.hit && w.dmg ? '<i></i>' : ''}${w.dmg ? `<b>${damageText(w.dmg)}</b>` : ''}</p>` : '';
      const sps = c.spells.filter(q => q.src === w.n).map(q => `<span class="lp-pwc" data-tip="s|${esc(q.n)}">${esc(q.n.replace(w.n.split(',')[0] + ', ', ''))}</span>`);
      const pws = (w.pw || []).map((o, i) => typeof o === 'string' ? '' : o.sp ? '' : `<span class="lp-pwc b" data-tip="p|${esc(w.n)}|${i}">${GLY.bolt}${esc(o.n)}</span>`).filter(Boolean);
      const body = `${hd.replace(/^/, '')}`;
      const inner = `<div class="lp-eqtop">${hd}</div>${stat}<p class="lp-wnote" title="${esc(w.note||'')}">${rich(dcify(c, w.note))}</p>${sps.length || pws.length ? `<div class="lp-pwcs">${sps.concat(pws).join('')}</div>` : ''}`;
      return fx ? `<article class="lp-weapon on fx rarity-${rarityOf(w)}">${inner}</article>` : `<div role="button" tabindex="0" class="lp-weapon ${on ? 'on' : 'off'} rarity-${rarityOf(w)}" data-act="eq" data-key="${esc(w.n)}" aria-pressed="${on}">${inner}</div>`;
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
      const jet = '';
      return `<li class="lp-item rarity-${rarityOf(cat||it)} ${(it.max ? l <= 0 : it.qty <= 0) ? 'spent' : ''}"><span class="lp-nm">${esc(it.n)}${(cat && cat.d) || it.note ? `<small class="nt">${esc((cat && cat.d) || it.note)}</small>` : ''}</span><span class="lp-iq">${ctl}${use}${jet}<button type="button" class="lp-del" data-act="itdel" data-id="${esc(it.id)}" aria-label="Supprimer">×</button></span></li>`;
    }).join('');
    return `<div class="lp-tools"><input type="search" id="lp-q" value="${esc(view.q)}" placeholder="Chercher un objet" aria-label="Chercher"></div>
      <h4 class="lp-lvh">Objets et consommables<small>${st.items.length}</small></h4>
      <ul class="lp-items">${items || '<li class="lp-empty">Aucun objet.</li>'}</ul>
      <div class="lp-add"><input id="lp-in-n" type="text" placeholder="Nom de l'objet" aria-label="Nom"><input id="lp-in-q" type="number" min="1" inputmode="numeric" placeholder="Qté" aria-label="Quantité"><input id="lp-in-c" type="number" min="0" inputmode="numeric" placeholder="Charges" aria-label="Charges"><button type="button" data-act="itadd">Ajouter</button></div>`;
  }

  function actionsPanel(c, st) {
    const cols={'Action':[],'Action bonus':[],'Réaction':[],'Hors combat':[]}, q=nrm0(view.q.trim()), filter=view.act==='Hors combat'?'all':view.act;
    const add=(t,html,search,group=-1,off=false)=>{if(cols[t] && (!q||nrm0(search).includes(q))) cols[t].push({html,group,off});};
    const head=(t,name,en,attrs,k)=>`<button type="button" class="lp-sname" ${attrs||''}><span class="lp-cardtitle"><b title="${esc(name)}">${esc(name)}</b>${en?`<small class="lp-en">${esc(en)}</small>`:''}</span>${cardTags(t,false,false,false)}</button>`;
    const card=(t,name,en,attrs,meta,ctrl,cls,k)=>`<article class="lp-spell lp-act lp-hudcard lp-spellplain ${cls||''}">${head(t,name,en,attrs,k||'magic')}<div class="lp-mrow">${meta}</div>${ctrl}</article>`;
    const eqw=c.weapons.filter(w=>w.fixed||w.perma||st.eq.includes(w.n));
    eqw.filter(w=>w.hit||w.dmg).forEach(w=>{
      const m=damageRx().exec(w.dmg||''), k=m?damageKind(m[3]):'slashing';
      add('Action',card('Action',w.n,'Attaque',`data-act="detail" data-spec="w|${esc(w.n)}" data-tip="w|${esc(w.n)}"`,`<span class="lp-meta">${w.hit?`<span title="Bonus au toucher">${hud('target')} ${esc(w.hit)}</span>`:''}<span>${damageText(w.dmg)}</span></span>`,'','',k),w.n+' attaque '+w.dmg);
    });
    const linked=new Set();
    eqw.forEach(w=>(w.pw||[]).forEach((o,i)=>{
      if(typeof o==='string'||o.sp)return;
      if(o.res) linked.add(o.res);
      const ps=pwState(c,st,o),spent=ps&&ps.spent,t=typeOfPw(o.a),m=damageRx().exec(o.d||'');
      const main=ps&&ps.kind==='res'?`<button type="button" class="lp-cast" data-act="pwuse" data-key="${esc(w.n)}" data-i="${i}" ${spent?'disabled':''}>Utiliser</button>`:'';
      const jet=o.r?`<button type="button" class="lp-jet" data-act="rpw" data-key="${esc(w.n)}" data-i="${i}" ${spent?'disabled':''}>Jet</button>`:'';
      const chip=ps?`<span class="lp-slotchip ${spent?'off':''}">${esc(ps.txt)}</span>`:'';
      add(t,card(t,o.n,'',`data-act="pwx" data-key="${esc(w.n)}" data-i="${i}" data-tip="p|${esc(w.n)}|${i}"`,`<span class="lp-meta">${esc(w.n)} ${damagePreview(o.d)}</span>`,(chip||main||jet)?ctl(chip,main,jet):'',spent?'spent':'',m?damageKind(m[3]):'magic'),o.n+' '+w.n+' '+o.d);
    }));
    c.spells.forEach(s=>{
      if(!isEq(c,st,s.src)||(s.lst&&!(st.prep||[]).includes(s.n)))return;
      if(cols[s.t]) {
        if(isEq(c,st,s.src)) [].concat(s.res||[]).forEach(r=>linked.add(r)); /* Les pools alternatifs restent aussi des actions autonomes (ex. Forme sauvage). */
        add(s.t,spellCard(c,st,s,true),s.n+' '+(s.en||'')+' '+s.d,s.lv,!isEq(c,st,s.src));
      }
    });
    visRes(c,st).filter(r=>r.a&&!linked.has(r.id)).forEach(r=>{
      const l=r.max-(st.res[r.id]||0),t=typeOfPw(r.a),spec='r|'+r.id;
      add(t,card(t,r.nom,'',`data-act="detail" data-spec="${esc(spec)}" data-tip="${esc(spec)}"`,`<span class="lp-meta">${esc(r.src||RESET_NAME[r.reset]||'')}</span>`,ctl(r.id==='ws'?`<span class="lp-wsinline">${gpips(c,r,st.res[r.id]||0,false)}</span>`:`<span class="lp-slotchip ${l<=0?'off':''}">${l}/${r.max}</span>`,`<button type="button" class="lp-cast" data-act="resd" data-key="${esc(r.id)}" data-d="1" ${l<=0?'disabled':''}>Utiliser</button>`,''),l<=0?'spent':'','magic'),r.nom+' '+(r.sub||''));
    });
    (c.feats||[]).forEach((f,i)=>{
      const t=f.res||/pacte de la lame|pact of the blade/i.test(f.n+' '+(f.en||''))?'':(f.act!=null?f.act:featType(f)), spec='f|'+i;
      if(t) add(t,card(t,f.n,f.en,`data-act="detail" data-spec="${spec}" data-tip="${spec}"`,`<span class="lp-meta">${esc(f.grp||'')}</span>`,'','','book'),f.n+' '+(f.en||'')+' '+f.d);
    });
    const groups=rows=>[...new Set(rows.map(r=>r.group))].sort((a,b)=>a-b).map(g=>`<section class="lp-actiongroup"><h5>${g===-1?'Armes et capacités':g===0?'Cantrips':'Niveau '+g}</h5><div class="lp-agrid">${rows.filter(r=>r.group===g).map(r=>r.html).join('')}</div></section>`).join('');
    return `<div class="lp-hudfilters lp-actionsearch"><input type="search" id="lp-q" value="${esc(view.q)}" placeholder="Rechercher une action" aria-label="Rechercher une action"></div><div class="lp-acols">${Object.keys(cols).filter(k=>k!=='Hors combat').map(k=>{
      const rows=cols[k],on=rows.filter(r=>!r.off),off=rows.filter(r=>r.off);
      return `<section class="lp-acol ${k==='Action'?'lp-acol-main':''}"><h4 class="lp-lvh">${ico(k)}${esc(k)}</h4>${groups(on)||'<p class="lp-empty">Aucune action.</p>'}${off.length?`<details class="lp-unavailable" ${q?'open':''}><summary>Non équipés (${off.length})</summary>${groups(off)}</details>`:''}</section>`;
    }).join('')}</div>${cols['Hors combat'].length?`<details class="lp-ooc"><summary>Hors combat et rituels (${cols['Hors combat'].length})</summary>${groups(cols['Hors combat'])}</details>`:''}`;
  }
  function restBlock() {
    const cf = view.confirm;
    if (cf) return `<section class="lp-block rests"><p class="lp-cfq">${cf === 'long' ? 'Repos long : PV, emplacements et ressources restaurés, charges d\'aube relancées.' : 'Repos court : pacte, ressources de repos court et 1 Forme sauvage.'}</p><div class="lp-cfb"><button type="button" class="go" data-act="restgo" data-type="${cf}">Confirmer le repos ${cf === 'long' ? 'long' : 'court'}</button><button type="button" class="ghost" data-act="restno">Annuler</button></div></section>`;
    return '<section class="lp-block rests"><button type="button" data-act="rest" data-type="court">Repos court</button><button type="button" data-act="rest" data-type="long">Repos long</button></section>';
  }

  function playerView() {
    const c = cfgOf(view.char), st = S(c.id);
    const tab = view.tab==='grim'?'sorts':view.tab||'actions';
    const ac = acOf(c, st), sp = spdOf(c, st);
    const hb = view.heal && view.heal.char === c.id ? `<div class="lp-healb"><span>${im('heal')}${esc(view.heal.name)} : <b>${view.heal.amt}</b> PV de soin</span><button type="button" data-act="healapply">Me soigner</button><button type="button" class="ghost" data-act="healno">Autre cible</button></div>` : '';
    const tile = (v, l, ic, t) => `<div class="lp-tile" ${t ? `title="${esc(t)}"` : ''}><span>${({ca:bg3('save'),vit:bg3('move'),ini:bg3('initiative'),att:bg3('target'),mai:bg3('experience'),dd:bg3('save')})[ic] || ''}${esc(l)}</span><b>${esc(v)}</b></div>`;
    const icOf = { 'Maîtrise': 'mai', 'Initiative': 'ini', 'Perc. passive': 'per' };
    const tabs = [['actions', 'Actions'], ['sorts', 'Sorts'], ['armes', 'Équipement'], ['objets', 'Objets'], ['capa', 'Capacités'], ['fiche', 'Fiche']];
    const tabIcons = {actions:'slashing',sorts:'magic',armes:'shield',grim:'book',objets:'bag',capa:'force',fiche:'person'};
    const cf = view.confirm;
    const rests = cf ? `<div class="lp-restc cf"><p>${cf === 'long' ? 'Repos long : PV, emplacements, ressources.' : 'Repos court : pacte et ressources de repos court.'}</p><div><button type="button" class="go" data-act="restgo" data-type="${cf}">Confirmer</button><button type="button" class="ghost" data-act="restno">Annuler</button></div></div>` : `<div class="lp-restc"><button type="button" data-act="rest" data-type="court">${bg3('rest')}Repos court</button><button type="button" data-act="rest" data-type="long">${im('rest-long')}Repos long</button></div>`;
    const hl = HIST[c.id] || [], lastH = hl[hl.length - 1];
    const undoBtn = `<button type="button" class="lp-undo" data-act="undo" ${lastH ? '' : 'disabled'} title="${lastH ? 'Annuler : ' + esc(lastH.label) : 'Rien à annuler'}"><span class="u">↶ Annuler</span><small>${lastH ? esc(lastH.label) : 'aucune action'}</small></button>`;
    const pct = Math.max(0, Math.min(100, st.hp / c.hp * 100));
    return `<div class="lp-sheet"><aside class="lp-artcol"><img class="lp-portrait" src="${esc(c.portrait)}" alt="${esc(c.nom)}" decoding="async"></aside>
    <div class="lp-body">
      <header class="lp-top"><div class="lp-ident"><span class="lp-kicker">${view.fromDM ? 'Fiche ouverte par le MJ' : 'Liveplay'}</span><h1>${esc(c.nom)}</h1><p>${esc(c.classe)}${st.conc ? `<span class="lp-concpill" title="Concentration">${bg3('concentration')}${esc(st.conc)}<button type="button" data-act="endconc" aria-label="Terminer la concentration">×</button></span>` : ''}</p></div>
        <div class="lp-hpc"><div class="lp-hpline"><span class="l">PV</span><b>${st.hp}</b><span>/ ${c.hp}</span></div>
          <div class="lp-hpbar ${pct > 50 ? 'ok' : pct > 25 ? 'mid' : 'low'}"><i style="width:${pct}%"></i></div>
          <div class="lp-tline"><span class="l">${bg3('temp')}Temp</span><b>${st.tmp}</b>${tmpBar(c, st)}</div>
          <div class="lp-hpctl"><button type="button" class="dmg" data-act="hp" data-type="dmg">${bg3('slashing')}Dégâts</button><input type="number" min="0" inputmode="numeric" id="lp-hp-amt" placeholder="0" aria-label="Montant"><button type="button" class="heal" data-act="hp" data-type="heal">${bg3('heal')}Soins</button><button type="button" class="tmp" data-act="hp" data-type="tmp">${bg3('temp')}Temp</button></div></div>
        ${rests}${undoBtn}</header>
      ${rollBanner()}${hb}
      <section class="lp-stats lp-primary">
        <div class="lp-srow"><h3>Bonus</h3><div class="lp-r7">${tile(ac.v, 'CA', 'ca', ac.parts.join(', '))}${tile(sp.v + ' ft', 'Vitesse', 'vit', sp.parts.join(', '))}${(c.bonus || []).map(b => tile(b[1], b[0], icOf[b[0]])).join('')}${tile(c.dc, 'DD sorts', 'dd')}${tile('+' + c.atk, 'Att. sort', 'att')}</div></div>
      </section>
      <section class="lp-block lp-resb"><div class="lp-resourcehead"><h3>Ressources de combat</h3><button type="button" class="lp-goldquick" data-act="tab" data-v="fiche" title="Modifier les monnaies">${gpOf(st)} po</button></div><div class="lp-slots">${slotRows(c, st, false)}</div><div class="lp-rgrid">${resRows(c, st, false, visRes(c, st).filter(r => !r.src))}</div>${(() => { const e = equippedStrip(c, st); return e ? `<button type="button" class="lp-eq-toggle" data-act="eqfold" aria-expanded="${!!view.eqOpen}">Objets équipés <span>${view.eqOpen?'−':'+'}</span></button>${view.eqOpen?`<div class="lp-eqrows">${e}</div>`:''}` : ''; })()}</section>
      <div class="lp-main"><div class="lp-tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" class="${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}" aria-selected="${tab === k}"><span>${n}</span></button>`).join('')}</div>
      ${tab === 'fiche' ? `      <section class="lp-stats">
        <div class="lp-srow"><h3>Caractéristiques</h3><div class="lp-r6">${(c.abil || []).map(a => `<div class="lp-tile ab"><span>${esc(a[0])}</span><b>${esc(a[1])}</b><em>${esc(a[2])}</em></div>`).join('')}</div></div>
        <div class="lp-srow"><h3>Jets de sauvegarde</h3><div class="lp-r6">${(c.saves || []).map(a => `<div class="lp-tile sv ${a[2] ? 'p' : ''}"><span>${esc(a[0])}</span><b>${esc(a[1])}</b></div>`).join('')}</div></div>
      </section>

      <section class="lp-block lp-skills"><h3>Compétences<small>Modificateurs de compétence${c.reliable ? ' (Talent fiable : 10 minimum sur les maîtrisées)' : ''}</small></h3><div class="lp-sk6">${(c.skills || []).map((k, i) => `<div class="lp-sk ${k[3] || 'n'}" title="${esc(k[0])} (${k[1]})${k[3] === 'E' ? ', expertise' : k[3] === 'P' ? ', maîtrise' : k[3] === 'H' ? ', demi-maîtrise' : ''}"><i class="pm"></i><span>${esc(k[0])}<em>${k[1]}</em></span><b>${signed(k[2])}</b></div>`).join('')}</div></section>
      <div class="lp-coinbar"><span class="lp-cbt">Monnaies</span>${coinsDef.map(([k, n, ab]) => `<label class="lp-coin" data-k="${k}" title="${esc(n)}"><span>${ab}</span><input type="number" min="0" inputmode="numeric" data-coin="${k}" value="${(st.coins || {})[k] || 0}" aria-label="${esc(n)}"></label>`).join('')}</div>
` : tab === 'armes' ? equipPanel(c, st) : tab === 'capa' ? featsPanel(c) : tab === 'objets' ? itemsPanel(c, st) : tab === 'actions' ? actionsPanel(c, st) : spellsPanel(c, st)}</div></div></div>`;
  }
  const ago = iso => { const s = Math.max(0, (Date.now() - new Date(iso)) / 1000); return s < 60 ? 'à l\'instant' : s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : Math.floor(s / 86400) + ' j'; };

  function dmView() {
    const cards = CFG.chars.map(c => {
      const st = S(c.id), eq = eqNames(c, st);
      return `<article class="lp-dmcard"><div class="lp-dmh"><img src="${esc(c.chibi)}" alt=""><div><h3>${esc(c.court)}</h3><p>${esc(c.classe)}</p></div>${st.conc ? `<span class="lp-cbadge" title="Concentration">${esc(st.conc)}</span>` : ''}</div>
        <div class="lp-hp sm"><b class="n">${st.hp}</b><span>/ ${c.hp}</span><span class="gold">${gpOf(st)} po</span></div>${hpBar(c, st)}
        <div class="lp-tmph sm"><span>PV temporaires</span><b>${st.tmp}</b></div>${tmpBar(c, st)}
        <p class="lp-eqline"><span>Équipé</span>${eq.length ? esc(eq.join(', ')) : 'rien'}</p>
        <div class="lp-dmslots">${slotRows(c, st, true)}</div><div class="lp-dmrows">${resRows(c, st, true)}</div>
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
    hideTip();
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
    view.pop = null; view.popsp = null; view.poppw = null; view.popdetail = null;
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
    if (a === 'kwx') { if (e.target.closest('.lp-pop') && !e.target.closest('.lp-px')) return; view.pop = null; view.popsp = null; view.poppw = null; view.popdetail = null; return render(); }
    if (!c) return;
    if (a === 'pip') return togglePip(c, b.dataset.kind, b.dataset.key, +b.dataset.idx);
    if (a === 'resd') return resDelta(c, b.dataset.key, +b.dataset.d);
    if (a === 'hp') { const i = root.querySelector('#lp-hp-amt'); const v = i.value; i.value = ''; return hpAct(c, b.dataset.type, v); }
    if (a === 'rest') { view.confirm = b.dataset.type; return render(); }
    if (a === 'restno') { view.confirm = null; return render(); }
    if (a === 'restgo') return rest(c, b.dataset.type);
    if (a === 'endconc') { const st = S(c), n = st.conc; st.conc = null; return say(c, `Termine la concentration sur ${n}`, 'spell'); }
    if (a === 'eqfold') { view.eqOpen=!view.eqOpen; return render(); }
    if (a === 'tab') { view.tab = b.dataset.v; view.cast = null; view.q = ''; view.act = 'all'; return render(); }
    if (a === 'poolpick') { view.pool[b.dataset.key]=b.dataset.pool; return render(); }
    if (a === 'actf') { view.act = b.dataset.v; return render(); }
    if (a === 'detail') { hideTip(); view.popsp = null; view.poppw = null; view.popdetail = b.dataset.spec; return render(); }
    if (a === 'gopen') { hideTip(); view.popsp = b.dataset.key; return render(); }
    if (a === 'pwx') { hideTip(); view.poppw = [b.dataset.key, +b.dataset.i]; return render(); }
    if (a === 'rollx') { view.roll = null; return render(); }
    if (a === 'jetsp') return jetSpell(c, cfgOf(c).spells.find(x => x.n === b.dataset.key));
    if (a === 'undo') return undo(c);
    if (a === 'rsk') { const cf = cfgOf(c), k = cf.skills[+b.dataset.i], r = rd(20), eff = cf.reliable && /[PE]/.test(k[3]) && r < 10 ? 10 : r, tot = eff + k[2]; return showRoll(c, k[0] + ' (' + k[1] + ')', [`d20 ${r}${eff !== r ? ' → 10 (Talent fiable)' : ''} ${signed(k[2])}`], `${k[0]} : ${tot}`, tot); }
    if (a === 'rhit') return jetWeapon(c, b.dataset.key, 'hit');
    if (a === 'rdmg') return jetWeapon(c, b.dataset.key, 'dmg');
    if (a === 'rpw') return jetPw(c, b.dataset.key, +b.dataset.i);
    if (a === 'pwuse') { const cf = cfgOf(c), w = cf.weapons.find(x => x.n === b.dataset.key), o = w.pw[+b.dataset.i], st = S(c); if (left(cf, st, o.res) < o.cost) return toast('Plus de charges'); st.res[o.res] = (st.res[o.res] || 0) + o.cost; return say(c, `Utilise ${w.n} : ${o.n} (${o.cost} charge${o.cost > 1 ? 's' : ''}, reste ${left(cf, st, o.res)})`, 'res'); }
    if (a === 'itjet') return jetItem(c, b.dataset.id);
    if (a === 'ituse') return itemAct(c, 'use', { id: b.dataset.id });
    if (a === 'open') { view.open = view.open === b.dataset.key ? null : b.dataset.key; return render(); }
    if (a === 'prep') {
      const st = S(c), k = b.dataset.key, cf = cfgOf(c), sp = cf.spells.find(y => y.n === k);
      if (!sp||!sp.lst) return;
      if (st.prep.includes(k)) st.prep = st.prep.filter(x => x !== k);
      else {
        const L = (cf.lists || []).find(l => l.id === sp.lst), same = cf.spells.filter(y => y.lst === sp.lst && st.prep.includes(y.n) && (y.lv === 0) === (sp.lv === 0)).length, cap = sp.lv === 0 ? L.cant : L.max;
        if (cap && same >= cap) return toast(sp.lv === 0 ? `Maximum de ${cap} cantrips atteint` : `Maximum de ${cap} sorts atteint pour cette liste`);
        st.prep = st.prep.concat(k);
      }
      return save(c, null);
    }
    if (a === 'cast') { const sp = cfgOf(c).spells.find(s => s.n === b.dataset.key); if(!sp||!isEq(cfgOf(c),S(c),sp.src)||(sp.lst&&!(S(c).prep||[]).includes(sp.n))) return toast('Sort indisponible'); const pk = pickPool(cfgOf(c), S(c), sp); if (!pk.cur) return toast('Plus de ressource disponible'); return cast(c, sp, pk.cur.k); }
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
    root.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); }); root.addEventListener('mouseout', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && !t.contains(e.relatedTarget)) hideTip(); }); root.addEventListener('focusin', e=>{const t=e.target.closest&&e.target.closest('[data-tip]');if(t)showTip(t);}); root.addEventListener('focusout',hideTip); root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onInput);
    go(sub);
    await connect();
    render();
    tick = setInterval(() => { if (view.mode === 'dm') render(); }, 30000);
  }
  function unmount() {
    const detachedTip=document.querySelector('body > .lp-tip'); if(detachedTip)detachedTip.remove();
    clearInterval(tick);
    if (chan && sb) { try { sb.removeChannel(chan); } catch (e) { /* ignore */ } chan = null; }
    root = null;
  }
  window.Liveplay = { mount, unmount, go };
})();
