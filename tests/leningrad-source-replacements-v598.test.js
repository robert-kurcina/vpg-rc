'use strict';
/* Checkpoint 364: independent communication oracle and militia exception. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const Campaign=require('../core/historical_campaign_session');
const Buildup=require('../core/historical_buildup_phase');
const Bridge=require('../core/scenario_opening_bridge');
const M=require('../maps/leningrad.json'),K=require('../maps/counter-configs/leningrad.json');
const S=require('../maps/setup/leningrad.json'),P=require('../maps/movement-configs/leningrad.json');
const F=require('../maps/phase-configs/leningrad.json'),Q=require('../maps/combat-configs/leningrad.json');
const U=require('../core/leningrad_starting_inventory');
const Policy=require('../maps/buildup-configs/leningrad.json');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const clone=v=>JSON.parse(JSON.stringify(v));let checks=0;
const eq=(a,b,n)=>{assert.deepEqual(a,b,n);checks++};
const yes=(a,n)=>{assert.ok(a,n);checks++};
const fail=(fn,re)=>{assert.throws(fn,re);checks++};
const selected=Fixture.selected;
yes(U.validateAllocation(K,selected).valid,'Bound allocation passes original source inventory');
const original=Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:U,
 allocation:selected,placements:Fixture.placements,phaseConfig:F,movementProfile:P,
 phaseFactories:{combat:()=>({})},supportPolicy:Q}).snapshot();
const source=(o)=>({map:M,profile:P,config:F,counterConfig:K,combatPolicy:Q,
 enableAirSupport:true,buildupPolicy:Policy,buildupAllocation:selected,...clone(o)});
const ctx=source(original);
const advance=(s,a)=>s.execute(a).session;
const restore=(s,origin)=>{const save=s.save();const r=Campaign.restore(clone(save),origin);
 eq(r.snapshot(),s.snapshot());eq(r.save(),save);return r;};
const b=Buildup.create({map:M,profile:P,config:F,counterConfig:K,policy:Policy,allocation:selected});
const p=Policy.reinforcements;
eq(p.length,9);eq(p.map(x=>x.turn),[3,4,4,4,5,6,7,7,8]);
eq(Policy.supportArrivals[0].faceId,Q.airSupport.markers.find(m=>m.firstTurn===6).faceId);

eq(Policy.replacementSteps.german,[0,0,0,1,1,1,1,1]);
eq(Policy.replacementSteps.soviet,[0,1,1,2,2,2,1,1]);
eq(Object.keys(Policy.initialCityControl).length,14);
// A separately trusted, already-initialized cursor is used only for bounded
// phase-level tests. This is NOT an eight-turn campaign replay.
const seeded=Campaign.create(ctx).snapshot().state;
const at=(turn,index,state=seeded)=>{const cursor={scenarioId:'leningrad',turn,index,complete:false};
 const origin={cursor,actor:F.phases[index].owner,state:clone(state)};
 return {ctx:source(origin),session:Campaign.create(source(origin))};};
const graph=require('../core/movement_binding').build(M,P).board;
const links=new Map();for(const e of graph.edges.filter(e=>e.verified&&!e.impassable&&!e.allSea&&!e.lake))for(const [a,c] of [[e.a,e.b],[e.b,e.a]]){if(!links.has(a))links.set(a,[]);links.get(a).push(c);}
function oracle(origin,actor,units){const blocked=new Set();for(const u of Object.values(units))if(u.owner!==actor){blocked.add(u.hex);for(const h of links.get(u.hex)||[])blocked.add(h);}const seen=new Set([origin]),queue=[origin];for(let i=0;i<queue.length;i++){const h=queue[i];if(Policy.entryEdge[actor].includes(h))return true;for(const n of links.get(h)||[])if(!seen.has(n)&&!blocked.has(n)){seen.add(n);queue.push(n);}}return false;}
let seed=598;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
const land=M.cells.filter(c=>c.terrain!=='sea').map(c=>c.id),cities=M.cells.filter(c=>c.city);
eq(cities.length,14);let graphChecks=0;
for(let t=0;t<60;t++){const units={},used=new Set();for(let j=0;j<12;j++){let h;do{h=land[Math.floor(random()*land.length)];}while(used.has(h));used.add(h);units[j]={owner:j%2?'german':'soviet',hex:h};}for(const actor of ['german','soviet'])for(const city of cities){eq(b.communicated(city.id,actor,units),oracle(city.id,actor,units),`${actor} ${city.id} trial ${t}`);graphChecks++;}}
const militia=selected.sovietTurn3WorkersMilitia[0],slot=p.find(x=>x.turn===3),army=selected.sovietFrontArmies[0];
const isolated=clone(seeded);for(const id of Object.keys(isolated.units))if(isolated.units[id].hex==='1701')delete isolated.units[id];
['1602','1702','1802'].forEach((h,i)=>isolated.units[selected.germanInitialInfantry[i]].hex=h);
eq(b.communicated('1701','soviet',isolated.units),false);
let m=at(3,4,isolated);m.session=advance(m.session,{type:'place-reinforcement',slotId:slot.slotId,hex:'1701'});eq(m.session.snapshot().state.units[militia].hex,'1701');
const admitted=m.session.snapshot().state;const casualty=clone(admitted);delete casualty.units[militia];
let r=at(4,4,casualty);r.session=advance(r.session,{type:'apply-replacement',unitId:militia,hex:'1701'});eq(r.session.snapshot().state.units[militia].strengthStatus,'printed-reduced');eq(r.session.snapshot().state.units[militia].printedCombatStrength,1);fail(()=>r.session.execute({type:'apply-replacement',unitId:militia,hex:null}),/Cannot rebuild and restore/);restore(r.session,r.ctx);eq(r.session.undo().session.snapshot(),Campaign.create(r.ctx).snapshot());
let next=at(5,4,r.session.snapshot().state);next.session=advance(next.session,{type:'apply-replacement',unitId:militia,hex:null});eq(next.session.snapshot().state.units[militia].strengthStatus,'printed-full');eq(next.session.snapshot().state.units[militia].printedCombatStrength,2);restore(next.session,next.ctx);
let blocked=clone(casualty);blocked.units[selected.germanInitialInfantry[0]].hex='1701';let denied=at(4,4,blocked);fail(()=>denied.session.execute({type:'apply-replacement',unitId:militia,hex:'1701'}),/Workers militia replacement/);
let ordinary=clone(casualty);delete ordinary.units[army];let o=at(4,4,ordinary);fail(()=>o.session.execute({type:'apply-replacement',unitId:army,hex:'1701'}),/controlled city/);
const report={checkpoint:364,version:'v598',source:'references/rules/leningrad-rules.pdf §§11–12.4',assertions:checks,graphChecks,scope:'synthetic positions, original counter identities and current shipped graph; no browser or continuous contested campaign'};if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-source-replacements-v598.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
