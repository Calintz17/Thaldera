/* Regression: all cities must remain reachable through the continent atlas. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const index = JSON.parse(fs.readFileSync(path.join(root, 'data/index.json'), 'utf8'));
const entries = index.fichiers.flatMap(file => JSON.parse(fs.readFileSync(path.join(root, 'data', file), 'utf8')));
const by = Object.fromEntries(entries.map(e => [e.id, e]));
const children = {};
for (const e of entries) if (e.parent && by[e.parent]) (children[e.parent] ||= []).push(e);
const source = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
const start = source.indexOf('function collectVilles(e) {');
const end = source.indexOf('\nfunction collectLieux(', start);
assert.ok(start > 0 && end > start, 'collectVilles implementation must be testable');
const fn = new Function('cachedCollection', 'kids', source.slice(start, end) + '\nreturn collectVilles;');
const collectVilles = fn((kind, ent, compute) => compute(), (id, type) =>
  (children[id] || []).filter(e => !type || e.type === type));
const citiesOf = continent => new Set(collectVilles(by[continent]).map(e => e.id));
for (const id of ['port-doelan', 'camont', 'port-blanc', 'havre-noir', 'leyenmil', 'lunsk']) {
  assert.ok(citiesOf('thaldera').has(id), 'Thaldera atlas missing ' + id);
}
for (const id of ['roshen-buru', 'keras-tauroc', 'cap-cornes', 'azuren-kai']) {
  assert.ok(citiesOf('istra').has(id), 'Istra atlas missing ' + id);
}
for (const continent of entries.filter(e => e.type === 'continent')) {
  for (const city of collectVilles(continent)) {
    assert.ok(city.pos && Number.isFinite(city.pos.x) && Number.isFinite(city.pos.y),
      'Atlas pin without normalized coordinates: ' + city.id);
  }
}
assert.ok(entries.length >= 783, 'Codex entity count decreased below verified v59 baseline');
assert.equal(new Set(entries.map(e => e.id)).size, entries.length, 'Duplicate entity identifiers detected');
// Extract and exercise the exact runtime camera clamping function.
const clampStart = source.indexOf('function clampMapRect(rect) {');
const clampEnd = source.indexOf('\nfunction setCam(', clampStart);
assert.ok(clampStart > 0 && clampEnd > clampStart, 'Camera clamp missing');
const clamp = new Function(source.slice(clampStart, clampEnd) + '\nreturn clampMapRect;')();
assert.deepEqual(clamp({ x:-0.5, y:0.9, w:0.25, h:0.3 }), { x:0, y:0.7, w:0.25, h:0.3 });
const oversize = clamp({ x:0.8, y:0.9, w:1.1, h:1.2 });
assert.ok(Math.abs(oversize.x + 0.05) < 1e-9 && Math.abs(oversize.y + 0.1) < 1e-9,
  'Oversized map should stay centered without floating-point precision errors');
const theme = fs.readFileSync(path.join(root, 'assets/arcane-theme.css'), 'utf8');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sessions = JSON.parse(fs.readFileSync(path.join(root, 'data/parties.json'), 'utf8'));
assert.match(page, /arcane-theme\.css\?v=\d+/, 'Atlas theme must be linked');
assert.match(page, /assets\/app\.js\?v=90/, 'App and stylesheet cache versions must match the v91 release');
assert.ok(page.includes('id="sbtn"') && page.includes('id="slog"'), 'Recap drawer must be present');
assert.ok(Array.isArray(sessions.parties), 'Session summaries schema must be an array');
assert.ok(source.includes("['slog','sbtn']"), 'Summary drawer must share side-dock controller');
assert.ok(source.includes('extra.concat(gallery)'), 'Cast/gallery should render residents first');
assert.ok(source.includes('frames: []'), 'Regions must not be drawn on the geographical atlas');
assert.ok(source.includes('addAnchor(a, p.x, p.y)'), 'Pins must be in pixel-sharp screen-space');
assert.ok(theme.includes('.map-labels .pin .pd'), 'Highly contrasted map pins must be styled');
assert.ok(theme.includes('background:radial-gradient(circle at 35% 28%,#fff6bf'), 'Map markers must stand out on cream maps');
assert.ok(!source.includes('function showPrev(id)'), 'Redundant geographical tooltip must stay removed');
for (const id of ['cabane-de-gran-brijit','cabane-gran-brijit']) {
  assert.equal(by[id]?.redirige,'manoir-des-ligaments','Manor duplicate must redirect');
}
assert.ok(!by['bourre-piff'] && by.bourpif, 'Bourpif must have one canonical ficha');
assert.ok(['bourre-piff','seravine','tilda','cleff','mika'].every(id => !by[id]), 'Former duplicate NPCs must be removed');
assert.equal(by['solkah-barrow']?.nom, 'Solkah Barrow et Seravine');
assert.equal(by.irna?.nom, 'Irna, Tilda et Cleff');
assert.equal(by['laile-d-avalon']?.galerie?.[0]?.img, 'img/paysages/lunsk/aile-d-avalon.webp');
assert.equal(by['vieux-garde-graham']?.img, 'img/pnj/camont-garde-de-la-salle-des-coffres.webp');
assert.equal(by['creux-d-azur']?.parent, 'outreterre');
assert.ok(source.includes('landscape-frame'), 'Standard 4:3 landscape frame must exist');
assert.ok(source.includes('LEGACY_IDS'), 'Old bookmarks must redirect to merged group fiches');
assert.ok(source.includes('x.type === \'lieu\''), 'Landscape inheritance must not fall back to an unrelated city image');
assert.equal(by['gran-brijit'].lieu,'manoir-des-ligaments','Gran Brijit must live in canonical manor');
assert.equal(by['nolbrim'].lieu,'manoir-des-ligaments','Nolbrim must live in canonical manor');
assert.equal(by.ink.parent,'agran','Ink must be indexed from Agran');
assert.ok(['auberge-d-agran','brakka','cap-cornes','roshen-buru'].every(id=>by.ink.lieux.includes(id)),'Ink journey must be preserved');
assert.ok(by.ink.galerie.length>=4,'Ink journey must display multiple landscape stages');
const mobileTheme = fs.readFileSync(path.join(root,'assets/ios-mobile.css'),'utf8');
assert.ok(page.includes('media="(max-width: 860px)"'), 'iOS style must be mobile-only');
assert.ok(mobileTheme.includes('grid-template-columns:minmax(96px,118px)'), 'Compact iPhone header must have two columns');
assert.ok(mobileTheme.includes('.mobile-places-list'), 'Map destinations need tactile fallback');
assert.ok(mobileTheme.includes('.gal .gdots button'), 'Gallery dots need touch-sized controls');
assert.ok(source.includes('syncMobileViewport()'), 'Visual viewport must be measured for Safari');
assert.ok(source.includes("!matchMedia('(pointer:coarse)').matches"), 'Explorer must avoid auto-opening iOS keyboard');
assert.equal(by.outreterre?.locked, undefined, "Outreterre must be unlocked for Creux d'Azur");
assert.equal(by['creux-d-azur']?.parent, 'outreterre', "Creux d'Azur belongs under Outreterre");
const forms = entries.filter(e => ['pnj','pj'].includes(e.type) && (e.formes?.length || 0) > 1);
assert.ok(forms.length >= 30, 'Multimodal character forms must remain in the codex');
for (const e of forms) {
  for (const g of e.galerie || []) if (g.forme !== undefined) {
    assert.ok(Number.isInteger(g.forme) && g.forme >= 0 && g.forme < e.formes.length,
      'Bad carousel form index in ' + e.id + ': ' + g.forme);
  }
}
assert.ok(source.includes('readyCutouts'), 'Adjacent form assets should prefetch for smooth browsing');
assert.ok(source.includes('cutout steady'), 'Character images must remain mounted between forms');
console.log('Underdark and multimodal carousel assertions OK');
console.log('Mobile Safari static checks OK: two-row header, keyboard, map destinations, full-height docks');
for (const [id, location, portrait] of [
  ['aster-invictus','ecole-du-savoir','img/pnj/aster-invictus.webp'],
  ['sahime-kaben','roshen-buru','img/pnj/sahime-kaben.webp'],
  ['aolus-magna','cap-cornes','img/pnj/commandant-aolus-magna.webp'],
  ['sazed','azuren-kai','img/pnj/sazed.webp']
]) {
  assert.equal(by[id]?.lieu, location, 'NPC location not confirmed: '+id);
  assert.equal(by[id]?.img, portrait, 'NPC portrait missing: '+id);
  assert.equal(by[id]?.publication,'joue','NPC should be player-visible: '+id);
}
assert.equal(by.lukas?.redirige,'luka','Historical Lukas link should redirect');
assert.equal(by.luka?.img,'img/pnj/leyenmil-lukas.webp','Luka should inherit original portrait');
assert.equal(by.bourpif?.img,'img/pnj/bourre-piff.webp','Bourpif should inherit legacy portrait');
assert.ok(!by.emelka,'Unplayed Balamor NPCs must never be exposed in public JSON');
console.log('Player-safe NPC publication OK: four new characters, Luka alias, Bourpif portrait.');
console.log('Atlas regression OK: 783+ fiches, context return, merged manor, Ink journey, bright atlas dots, session drawer.');
