'use strict';
// Source-asset and integration gates. Visual comparison with the author's SVG
// remains a separate acceptance task; do not confuse source files with gameplay.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(ROOT,p));
const json=(p)=>JSON.parse(read(p));
const registry=json('maps/registry.json');
const catalog=json('games/catalog.json');
const counters=json('assets/official-counters/source-manifest.json');
const hash=crypto.createHash('sha256').update(read('assets/official-counters/source-counters.svg')).digest('hex');
assert.equal(hash,counters.source_sha256,'Counter SVG original changed without manifest update');
assert(read('core/official_counter_templates.js').toString().includes('source-counters.svg'));
const app=read('app.js').toString();
assert.match(app,/WargameCounterVisuals\.layer\(/,'Playable generic app no longer renders SVG counter assets');
assert.match(app,/WargameTerrainAdapter\.nativeBoard\(/,'Playable generic app no longer uses shared map adapter');
assert.match(app,/HexTerrainTiles\.svgMap\(/,'Playable generic app no longer uses shared renderer');
const legacy=read('legacy/ui.js').toString();
assert.match(legacy,/WargameCounterVisuals/,'B4M legacy UI must retain official vector counter component');
const expected={
  arduous:'maps/source/user-svg/arduous-map-temp(3).svg',
  leningrad:'maps/source/user-svg/leningrad-main.svg',
  kiev:'maps/source/user-svg/kiev-map-temp(5).svg',
  'kiev-odessa':'maps/source/user-svg/kiev-odessa-main.svg'
};
for(const [id,src] of Object.entries(expected)){
  const record=registry.maps.find(m=>m.id===id);
  assert(record,`Missing historical map registration ${id}`);
  assert(fs.statSync(path.join(ROOT,src)).size>1000,`Missing author SVG source ${src}`);
  const exportPath=`exports/${id}.svg`;
  const exported=read(exportPath).toString();
  assert(exported.startsWith('<svg')||exported.includes('<svg'),`No engine-generated SVG export: ${id}`);
  assert(exported.includes('data-layer='),`Export lacks engine feature layers ${id}`);
  if(id==='kiev-odessa'){
    assert.equal(record.standalone,false,'Odessa must never be standalone');
    assert.equal(record.compose.base,'kiev');
    assert.equal(record.compose.extension,'odessa-extension.json');
    assert.equal(record.kind,'composite-extension-visual');
  } else {
    assert.equal(record.kind,'visual-transcription');
    assert(json(`maps/${id}.json`).cells.length>50);
  }
  assert(!catalog.games.some(g=>g.directory===id),`${id} incorrectly advertised as rules-complete playable scenario`);
}
assert(catalog.games.some(g=>g.directory==='battle-for-moscow'));
console.log('PASS original user SVG counters, 4 authored historical map source files, layered SVG exports, composed Kiev/Odessa, renderer integration, and truthful playable-game catalog');
