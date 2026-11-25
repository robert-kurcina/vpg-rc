'use strict';
/* Checkpoint 202: user-directed map corrections, source records remain immutable. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const base=require('../maps/kiev.json');
const ext=require('../maps/odessa-extension.json');
const compose=require('../maps/composer');
const evidence=require('../core/terrain_evidence');
const setup=require('../core/scenario_starting_setup');
const S=require('../maps/setup/kiev.json');
const reviewed=require('../core/source_reviewed_movement_graph');
const cfg=require('../maps/movement-configs/kiev-source-reviewed-candidate-v435.json');
const composite=compose.compose(base,ext);
const removed=['0608','0909','1009'];
const get=(b,id)=>b.cells.find(c=>c.id===id);
const stars=b=>b.cells.filter(c=>c.tileMarkers?.some(m=>m.kind==='star')).map(c=>c.id).sort();
const standard=stars(base),combined=stars(composite);
assert.equal(standard.length,10,'Kiev-alone has ten after the authorized 0708 addition');
assert.equal(combined.length,12,'Kiev–Odessa composite has its own additional source stars');
for(const h of removed){
 for(const b of [base,composite]){
  assert.equal(get(b,h).tileMarkers.some(m=>m.kind==='star'),false,`${b.id} ${h}: no Soviet star`);
  assert.equal(get(b,h).terrain,'open',`${b.id} ${h} retains original Open terrain`);
 }
}
for(const [name,b] of [['Kiev',base],['Kiev–Odessa',composite]]){
 const ms=get(b,'0708').tileMarkers.filter(m=>m.kind==='star');
 assert.equal(ms.length,1,name+' exactly one 0708 star');
 assert(get(b,'0708').tileMarkers.some(m=>m.kind==='city'&&m.label==='Chernovtsy'),name+' Chernovtsy city remains');
 if(name==='Kiev'){assert.equal(ms[0].faction,'soviet');assert.equal(ms[0].directive,'user-directive-2026-11-21-checkpoint-202');}
 else assert.equal(ms[0].sourceSvgId,'use30','original source-authoritative composite star retained');
}
assert(!standard.includes('1111'),'Kiev alone must not inherit Odessa-only star');
assert(combined.includes('1111'),'composite gets 1111 Soviet star');
assert.equal(base.userMapCorrections.addedSovietStars[0],'0708');
assert.equal(ext.userMapCorrections.addedSovietStars[0],'0708');
const conditional=get(composite,'1111').tileMarkers.filter(m=>m.kind==='star');
assert.equal(conditional.length,1,'no doubled stars');
assert.equal(conditional[0].faction,'soviet');
assert.equal(conditional[0].scenarioScope,'kiev-odessa-only');
assert.equal(get(base,'1111').terrain,'forest');
for(const b of [base,composite]){
 const c=get(b,'1502');
 assert.equal(c.terrain,'forest');
 assert.equal(c.terrainStatus,'user-adjudicated-terrain-v435');
 assert.equal(c.userTerrainAdjudication.previousTerrain,'swamp');
 assert.equal(c.userTerrainAdjudication.terrain,'forest');
 assert(c.userTerrainAdjudication.sourceTerrainUnchanged);
 assert(c.tileEdges.NW,'prior existing hexside features retained');
}
assert.equal(get(base,'1502').sourceTerrainEvidence.layer,'swamp','original SVG evidence is unchanged');
const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../maps/source/user-svg/kiev-odessa-main.svg'))).digest('hex');
assert.equal(sourceHash,base.definitiveTerrainAudit.sourceSvgSha256);
assert.equal(sourceHash,ext.authoritativeCompositeSvg.sha256);
assert.deepEqual(base.userMapCorrections.removedSovietStars,removed);
assert.deepEqual(ext.userMapCorrections.removedSovietStars,removed);
assert.equal(base.userMapCorrections.sourceSvgModified,false);
assert.equal(ext.userMapCorrections.sourceSvgModified,false);
const inspect=evidence.inspect(base);
assert.equal(inspect.coverage.markedTerrainHexes,149,'149 known source terrains including one explicit override');
assert.equal(inspect.coverage.unresolvedTerrainHexes,16,'city underlays remain unverified');
assert.equal(reviewed.build(base,cfg).cells['1502'].terrain,'forest','actual movement candidate also reads Forest');
const tampered=structuredClone(base);get(tampered,'1502').userTerrainAdjudication.previousTerrain='open';
assert.throws(()=>evidence.inspect(tampered),/user-adjudicated-terrain-evidence-disagrees/);
assert.throws(()=>reviewed.build(tampered,cfg),/source-reviewed-fingerprint-mismatch/);
const ss=setup.slots(base,S);
assert.equal(ss.slots.star.length,10);
assert.deepEqual(ss.errors,[],'the star-count preflight is corrected without promoting Kiev');
const svgKiev=fs.readFileSync(path.join(__dirname,'../exports/kiev.svg'),'utf8');
const svgCombined=fs.readFileSync(path.join(__dirname,'../exports/kiev-odessa.svg'),'utf8');
for(const [b,svg] of [[base,svgKiev],[composite,svgCombined]]){
 for(const h of removed)assert(!svg.includes(`data-deployment-hex="${h}" data-deployment-kind="star"`),`no stale rendered star ${b.id} ${h}`);
 assert(svg.includes('data-hex-id="1502"'),'updated Forest hex rendered '+b.id);
 assert(svg.includes(`data-deployment-hex="0205" data-deployment-kind="star"`),'unrelated Soviet stars retained '+b.id);
}
for(const svg of [svgKiev,svgCombined])assert.equal((svg.match(/data-deployment-hex="0708" data-deployment-kind="star"/g)||[]).length,1,'exactly one rendered 0708 star');
assert(!svgKiev.includes('data-deployment-hex="1111" data-deployment-kind="star"'));
assert(svgCombined.includes('data-deployment-hex="1111" data-deployment-kind="star"'));
console.log('PASS v436 Kiev user-map corrections: one 0708 star each, 10 Kiev slots, 3 removals both, Odessa-only 1111, Forest 1502');
