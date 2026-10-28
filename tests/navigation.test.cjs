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
assert.ok(page.includes('arcane-theme.css?v=64'), 'Atlas theme version must match');
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
assert.equal(by['bourre-piff']?.redirige,'bourpif','Bourpif identity must be consolidated');
assert.equal(by['gran-brijit'].lieu,'manoir-des-ligaments','Gran Brijit must live in canonical manor');
assert.equal(by['nolbrim'].lieu,'manoir-des-ligaments','Nolbrim must live in canonical manor');
assert.equal(by.ink.parent,'agran','Ink must be indexed from Agran');
assert.ok(['auberge-d-agran','brakka','cap-cornes','roshen-buru'].every(id=>by.ink.lieux.includes(id)),'Ink journey must be preserved');
assert.ok(by.ink.galerie.length>=4,'Ink journey must display multiple landscape stages');
console.log('Atlas regression OK: 783+ fiches, context return, merged manor, Ink journey, bright atlas dots, session drawer.');
