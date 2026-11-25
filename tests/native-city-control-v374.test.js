/* Checkpoint 140: read-only shared city-status integration and source labels. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('../core/engine.js'),S=require('../core/session.js'),P=require('../core/native_preview_config.js'),City=require('../core/native_city_status.js');
const r=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const root='games/battle-for-moscow/';
const source=Object.fromEntries(['game','map','units','deployments','rules','objectives'].map(k=>[k,r(root+k+'.json')]));
const g=E.build(P.project(source,r(root+'native-preview/config.json'))),visual=r('maps/battle-for-moscow.json');
const newSession=(state=E.start(g,1941,'auto-reference'))=>S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state});
let sess=newSession();
const initialHash=S.serialize(sess).sha256;
const initial=City.read(sess,visual);
assert.equal(initial.total,11);
assert.deepEqual(initial.counts,{german:2,soviet:9,unclaimed:0});
assert.equal(initial.cities.find(c=>c.name==='Moscow').owner,'soviet');
assert.equal(initial.cities.find(c=>c.name==='Moscow').hex,'1103');
assert.equal(initial.cities.find(c=>c.name==='Moscow').objective,true);
assert.equal(initial.cities.find(c=>c.name==='Tula').objective,false,'Tournament-only target must not be represented as active standard victory predicate');
assert.equal(initial.cities.filter(c=>c.name===c.hex).length,0,'All 11 names derive from registered visual cells');
assert.equal(initial.verdict,'soviet');
assert.equal(initial.evaluated,false);
assert.equal(initial.tournamentAvailable,false);
assert.equal(S.serialize(sess).sha256,initialHash,'Read-only model must not change state, seed, save hash or history');

// A synthetic *legal* mid-turn position near an empty enemy-controlled city.
// Deliberately not claimed as a historically reached starting move.
const state=E.start(g,1941,'auto-reference');
const unit=state.units.find(u=>u.id==='g24');
assert(unit);
unit.position={x:6,y:1};
state.phaseIndex=E.phasesFor(g,'german').findIndex(p=>p.kind==='move'&&p.movementMode==='normal');
assert(state.phaseIndex>=0);
sess=newSession(state);
assert(S.legal(sess,{type:'move',unitId:unit.id}).some(q=>q.x===5&&q.y===1));
const before=City.read(sess,visual).cities.find(c=>c.name==='Rzhev');
assert.equal(before.owner,'soviet');assert.equal(before.occupants.length,0);
const capture=S.execute(sess,{type:'move',unitId:unit.id,x:5,y:1});assert(capture.ok);
const after=City.read(capture.session,visual).cities.find(c=>c.name==='Rzhev');
assert.equal(after.owner,'german');assert.deepEqual(after.occupants,['g24']);
assert.equal(City.read(capture.session,visual).counts.german,3);
assert.equal(S.serialize(capture.session).sha256===S.serialize(sess).sha256,false);
const restored=S.restore(S.serialize(capture.session),{scenarioId:g.game.id,engine:'generic-hex-v1',config:g});
assert.deepEqual(City.read(restored,visual),City.read(capture.session,visual));
const undo=S.undo(capture.session);assert(undo.ok);
assert.deepEqual(City.read(undo.session,visual),City.read(sess,visual),'Undo restores earlier ownership');

// Owner persists without a current garrison. A city is not recaptured simply
// because the last entrant left, and visual labels do not determine ownership.
const left=structuredClone(capture.session.state);
left.units.find(u=>u.id==='g24').position={x:6,y:1};
const leftStatus=City.read(newSession(left),visual).cities.find(c=>c.name==='Rzhev');
assert.equal(leftStatus.owner,'german');assert.deepEqual(leftStatus.occupants,[]);
const changedVisual=structuredClone(visual);
changedVisual.cells.find(c=>c.sourceRef?.x===5&&c.sourceRef?.y===1).tileMarkers[0].label='Renamed in map';
assert.equal(City.read(capture.session,changedVisual).cities.find(c=>c.hex==='0602').owner,'german');
const bad=structuredClone(capture.session.state);bad.control['5,1']='invented-side';
assert.throws(()=>City.read(newSession(bad),visual),/Unknown city owner/);
const mismatch=structuredClone(capture.session.state);mismatch.control['5,1']='soviet';
assert.throws(()=>City.read(newSession(mismatch),visual),/City ownership and occupant diverge/);
assert.equal(source.game.engine,'generic-hex-v1','Production legacy route must not change');
console.log(JSON.stringify({status:'PASS',checkpoint:140,version:'v374',cities:initial.total,
 verification:['registry-name mapping','owner v occupancy','legal native capture','persistent last-entrant ownership',
  'Undo','save/restore','read-only seed/history','invalid owner rejection','active victory predicate','tournament disabled'],
 productionRoute:source.game.engine}));
