/* Every public document is an existing player prop, never a speculative lore summary. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const index = JSON.parse(fs.readFileSync(path.join(root, 'data/index.json'), 'utf8'));
const entities = index.fichiers.flatMap(p => JSON.parse(fs.readFileSync(path.join(root, 'data', p), 'utf8')));
const entityIds = new Set(entities.map(e => e.id));
const docs = JSON.parse(fs.readFileSync(path.join(root, 'data/documents.json'), 'utf8')).documents;
const ids = new Set();
assert.equal(docs[0].id, 'vesper-agent', 'First documented prop must follow the Vesper chapter');
assert.deepEqual(docs.map(d=>d.ordre), docs.map((d,i)=>i+1), 'Document order must be chronological and stable');
const roshen = docs.filter(d=>d.region==='Roshen Buru');
assert.equal(roshen.at(-1).id,'roshen-parchemin-psa84','PSA-84 belongs at the end of Roshen Buru');
assert.equal(roshen.at(-2).id,'roshen-lettre-brodek','Brodek letter precedes PSA-84');
assert.equal(roshen.findIndex(d=>d.id==='roshen-lettre-konya')+1,roshen.findIndex(d=>d.id==='roshen-menace-inconnue'),'Konya and Ayano letters belong together');
const augustus = docs.findIndex(d=>d.id==='ile-moines-journal-augustus');
const septim = docs.findIndex(d=>d.id==='ile-moines-journal-septim');
const berger = docs.findIndex(d=>d.id==='ile-moines-lettre-berger');
assert.ok(augustus<septim&&septim<berger,'Monks Island documents must follow story order');

const pageRefs = new Set();
assert.equal(docs.length, 44, 'All 44 discovered document collections must be indexed');
for (const d of docs) {
  assert.ok(d.id && !ids.has(d.id), 'Unique stable document ID: ' + d.id);
  ids.add(d.id);
  assert.ok(d.titre && d.decouverte && d.region && d.description, 'Metadata missing: ' + d.id);
  assert.ok(d.pages.length >= 1, 'Missing pages: ' + d.id);
  for (const p of d.pages) {
    assert.ok(!pageRefs.has(p), 'Document page assigned twice: ' + p);
    pageRefs.add(p);
    assert.ok(p.startsWith('img/props/') && fs.existsSync(path.join(root,p)), 'Missing original prop: ' + p);
  }
  for (const link of d.liens) {
    assert.ok(entityIds.has(link.id), 'Document linked to nonexistent NPC/place: ' + d.id + ' -> ' + link.id);
    assert.ok(link.texte.length > 15, 'Empty narrative context: ' + d.id);
  }
  const displayed = [d.titre,d.decouverte,d.description,...d.liens.map(x=>x.texte)].join(' ');
  assert.ok(!/prouve que|coupable|assassin(e|é)|manipul(e|é)|détourn(e|é)|trahison confirmée/i.test(displayed),
    'Document preview would reveal an interpretation before reading: ' + d.id);
}
const props = fs.readdirSync(path.join(root, 'img/props')).filter(p=>p.endsWith('.webp'));
assert.equal(props.length, 57, 'The repository contains 57 source pages');
assert.equal(pageRefs.size, props.length, 'Every source page should appear exactly once');
const multi = docs.filter(d=>d.pages.length>1);
assert.ok(multi.length>=4, 'Multipage documents must remain intact');
for (const name of ['roshen-rapport-uramei','agran-astariel-journal','port-registres-titan','khazad-donjon']) {
  assert.ok(ids.has(name), 'Expected multipage document missing: '+name);
}
const html=fs.readFileSync(path.join(root, 'index.html'),'utf8');
const js=fs.readFileSync(path.join(root, 'assets/app.js'),'utf8');
const css=fs.readFileSync(path.join(root, 'assets/documents.css'),'utf8');
assert.ok(html.includes('id="dbtn"')&&html.includes('id="dlog"'),'Document header/dock missing');
assert.ok(html.includes('assets/documents.css?v='),'Document CSS not loaded');
assert.ok(js.includes("id.startsWith('documents/')"),'Deep-link document routing missing');
assert.ok(js.includes("DOC_LINKS[e.id]"),'Narrative hyperlinks to documents missing');
assert.ok(js.includes("docPage(p, d, i)"),'Stacked multipage reader missing');
assert.ok(!js.includes("'<span class=\"doc-kicker\">Archives du groupe</span>'"),'Redundant archive header must stay removed');
assert.ok(css.includes('overflow-x:hidden')&&css.includes('width:100%'),'Responsive vertical-only reader constraints missing');
console.log('Documents OK: 44 filesets, 57 readable sources, 0 broken links, 4+ multipage sections.');
