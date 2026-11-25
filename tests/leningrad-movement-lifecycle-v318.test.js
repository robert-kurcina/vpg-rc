'use strict';
const A=require('node:assert/strict');
const H=require('../core/historical_movement_lifecycle.js');
const B=require('../core/movement_binding.js');
const L=require('../maps/leningrad.json');
const P=require('../maps/movement-configs/leningrad.json');
const C=require('../maps/phase-configs/leningrad.json');
const R=require('../core/phase_runtime.js');
let count=0;function check(x){A.ok(x);count++;}
const board=B.build(L,P).board;
const e=board.edges.find(e=>e.verified&&!e.impassable&&!e.rail&&board.cells[e.a].verified&&board.cells[e.b].verified&&board.cells[e.b].terrain==='open');check(e);
const original={scenarioId:'leningrad',units:{g:{id:'g',owner:'german',class:'infantry',size:'corps',hex:e.a,mp:4}}};
const cursor={scenarioId:'leningrad',turn:2,index:1,complete:false};
const opts={map:L,profile:P,config:C,cursor,actor:'german',state:original};
let s=H.create(opts);A.deepEqual(s.snapshot().cursor,cursor);count++;
const r={unitId:'g',path:[e.a,e.b]};
const first=s.move(r);check(first.ok);const s1=first.session;
A.equal(s1.snapshot().state.units.g.hex,e.b);count++;
A.equal(original.units.g.hex,e.a);count++;
A.deepEqual(s.snapshot().usedUnitIds,[]);count++;
A.deepEqual(s1.snapshot().usedUnitIds,['g']);count++;
const second=s1.move({unitId:'g',path:[e.b,e.a]});A.equal(second.ok,false);A.equal(second.reason,'already-moved-or-invalid');count+=2;
const back=s1.undo();check(back.ok);A.deepEqual(back.session.snapshot().state,original);count++;
A.deepEqual(back.session.snapshot().usedUnitIds,[]);count++;
check(back.session.move(r).ok);
const bad=s.move({unitId:'g',path:[e.a,'9999']});A.equal(bad.ok,false);count++;
A.equal(bad.session.snapshot().history.length,0);count++;
const end=s1.finish();check(end.ok);A.equal(end.nextPhase,'german-combat');count++;
A.deepEqual(end.session.snapshot().usedUnitIds,[]);count++;
A.throws(()=>end.session.finish(),/Only movement-phase pilot/);count++;
A.throws(()=>end.session.move(r),/Only movement-phase pilot/);count++;
const undone=end.session.undo();check(undone.ok);A.deepEqual(undone.session.snapshot(),s1.snapshot());count++;
A.throws(()=>H.create({...opts,actor:'soviet'}),/Wrong phase actor/);count++;
A.throws(()=>H.create({...opts,state:{...original,scenarioId:'kiev'}}),/Historical state mismatch/);count++;
A.throws(()=>H.create({...opts,cursor:R.start(C)}),/Only movement-phase pilot/);count++;
// Source rule: movement is optional, so no move is required to finish.
const idle=s.finish();check(idle.ok);A.equal(idle.nextPhase,'german-combat');count++;
// First turn German special movement is reachable only after source-backed combat.
const special={...cursor,turn:1,index:3};
let specialSession=H.create({...opts,cursor:special});
const specialEnd=specialSession.finish();check(specialEnd.ok);A.equal(specialEnd.nextPhase,'soviet-buildup');count++;
A.throws(()=>H.create({...opts,cursor:{...cursor,index:4}}),/Only movement-phase pilot/);count++;
// Input and output objects cannot alter stored history.
const leaked=s1.snapshot();leaked.state.units.g.hex='fake';leaked.usedUnitIds.push('fake');A.equal(s1.snapshot().state.units.g.hex,e.b);count++;
A.deepEqual(s1.snapshot().usedUnitIds,['g']);count++;
console.log(`PASS Leningrad bounded movement lifecycle ${count} assertions`);
