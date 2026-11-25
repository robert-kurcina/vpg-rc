const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const load=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const roster=load('maps/roster-overlays/kiev-odessa.json'),cfg=load(roster.counterConfig),registry=load('maps/registry.json');
const entry=registry.maps.find(m=>m.id==='kiev-odessa');
assert.equal(entry.unitRosterOverlay,'roster-overlays/kiev-odessa.json');
assert.equal(entry.standalone,false);
assert.equal(entry.compose.base,'kiev');
assert.equal(roster.units.length,8);
assert.equal(new Set(roster.units.map(u=>u.id)).size,8);
assert.equal(roster.units.filter(u=>u.art.singleSided).length,3);
for(const u of roster.units){
 const d=cfg.playableDesignRegistry.find(d=>d.designKey===u.designKey);assert.ok(d);
 assert.equal(u.id,`kiev-odessa/${d.designKey}`);assert.equal(u.historicalUnitId,null);
 assert.equal(u.art.displayFaceId,d.displayFaceId);assert.equal(u.art.alternateFaceId,d.alternateFaceId);
 assert.equal(u.art.singleSided,d.isSingleSided);
 for(const f of [u.art.displayFaceId,u.art.alternateFaceId].filter(Boolean))assert.ok([...cfg.faces.front,...cfg.faces.back].some(x=>x.faceId===f));
 assert.equal(u.status,'declarative-roster-not-executable');
}
for(const key of ['soviet-black-sea-fleet','soviet-coastal-army'])assert.equal(roster.units.find(x=>x.designKey===key).initial.hex,'1513');
assert.equal(roster.units.find(x=>x.designKey==='romanian-air-support').initial.turn,2);
assert.equal(roster.reinforcements[0].turn,2);
assert.equal(roster.setupConstraints.sovietRearCavalry.candidateHexes.length,7);
assert.equal(roster.setupConstraints.sovietFrontCavalry.groupIncludes.cavalry,1);
assert.equal(roster.setupConstraints.romanianGround.units.length,3);
assert.equal(roster.setupConstraints.romanianGround.count,4);
assert.equal(roster.setupConstraints.romanianGround.status,'source-reconciled-base-plus-expansion; pending-executable-placement');
assert.ok(!roster.units.some(x=>x.initial.fixedHex && x.initial.kind==='pool'));
console.log('PASS: eight Odessa design-based scenario IDs, exact face references, source-supported setup constraints, unbound gameplay');
