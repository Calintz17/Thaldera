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
assert.ok(theme.includes('.map-labels .rlab { pointer-events:auto;'), 'Region labels must remain interactive');
assert.ok(theme.includes('--atlas-motion'), 'Map labels must match zoom duration');
assert.ok(source.includes('class="map-labels"'), 'Screen-space map-label layer required');
assert.ok(source.includes('current-territory'), 'Selected region title must remain visible');
assert.ok(page.includes('arcane-theme.css?v=61'), 'Fantasy theme revision must load');
console.log('Atlas regression OK: city pins, label interaction, camera bounds, 783+ unique fiches.');
