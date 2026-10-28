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
assert.equal(entries.length, 783, 'Unexpected codex entity count: investigate data changes');
console.log('Atlas regression OK: Port Doëlan, faction cities, Istra regional cities; 783 fiches.');
