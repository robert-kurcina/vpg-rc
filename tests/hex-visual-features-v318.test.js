const assert=require('node:assert/strict');
const T=require('../core/terrain_tiles');
const V=require('../core/hex_visual_features');
for(const name of ['arduous','kiev','leningrad','odessa-extension']){
 const map=name==='odessa-extension'?require('../maps/composer').compose(require('../maps/kiev.json'),require('../maps/odessa-extension.json')):require('../maps/'+name+'.json');const out=V.normalize(map);
 assert.equal(out.hexCount,map.cells.length);
 assert.equal(out.semantics,'visual-only');
 for(const id of Object.keys(out.hexes)){
  const h=V.hex(out,id);assert.deepEqual(Object.keys(h.sides),T.DIRS);
  for(const d of T.DIRS){const s=V.side(out,id,d);assert.equal(V.shared(out,id,d).key,s.edgeKey);assert.equal(s.midpoint.length,2);assert.equal(s.endpoints.length,2);
   if(s.neighbor&&out.hexes[s.neighbor]){
    const back=V.side(out,s.neighbor,T.OPP[d]);assert.equal(back.neighbor,id);assert.equal(back.edgeKey,s.edgeKey);
    assert.equal(s.railStubs.length,back.railStubs.length);
   }
   assert.equal(s.movementAuthorized,undefined);assert.equal(V.shared(out,id,d).movementAuthorized,undefined);
  }
 }
 const rail=(map.hexCenterRailConnections||[]).length;
 assert.equal(out.railLinksMapped,rail,name+' adjacent links');
 console.log(name, 'hexes',out.hexCount,'rail',rail,'sides',Object.keys(out.edges).length);
}
// One source vector may connect multiple hex pairs; entries produce center-to-side stubs in each hex.
const base=require('../maps/arduous.json');const src=base.hexCenterRailConnections.slice(0,2);
const sample=structuredClone(base);sample.hexCenterRailConnections=src.map(x=>({...x,sourceSvgIds:['one-continuous-svg-path']}));
const result=V.normalize(sample);assert.equal(result.railLinksMapped,2);
assert.equal(Object.values(result.hexes).flatMap(h=>Object.values(h.sides)).flatMap(s=>s.railStubs).length,4);
// Conflict and malformed inputs fail closed without modifying source.
assert.throws(()=>V.normalize({...base,cells:[base.cells[0],base.cells[0]]}),/duplicate cell/);
assert.equal(V.hex(V.normalize(base),'nonexistent'),null);
console.log('hex-visual-features: PASS');
