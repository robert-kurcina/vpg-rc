'use strict';
const A=require('node:assert/strict'),G=require('../core/graduated_mode'),R=require('../core/graduated_victory'),H=require('../core/historical_housekeeping_phase'),E=require('../core/engine'),S=require('../core/session'),P=require('../core/native_preview_config');
const sources=require('../maps/victory-configs/graduated-research-v1.json');let checks=0;
const eq=(a,b,m)=>{A.deepEqual(a,b,m);checks++};const fail=(f,p)=>{A.throws(f,p);checks++};
for(const [scenario,source] of Object.entries(sources)){
 const p=G.profile(scenario),all=Object.fromEntries(source.cities.map(k=>[k,'soviet']));
 eq(Object.keys(p.weights),source.cities);eq(G.evaluate(p,all).grade,'soviet-decisive');
 const allGerman=Object.fromEntries(source.cities.map(k=>[k,'german']));eq(G.evaluate(p,allGerman).grade,'german-decisive');
 // Enumerate one reachable subset per VP total, with Moscow retained by the Soviets.
 const byVP=new Map([[0,all]]);for(const k of source.cities.filter(k=>k!==source.moscow))for(const [v,l] of [...byVP])if(!byVP.has(v+p.weights[k]))byVP.set(v+p.weights[k],{...l,[k]:'german'});
 const grades=new Set();for(const [v,l] of byVP){const r=G.evaluate(p,l);grades.add(r.grade);eq(r.germanVP,v);eq(r.germanVP+r.sovietVP,r.totalVP);eq(r.grade,R.evaluateWeighted({scenario,status:'complete',exactRestore:true,terminal:{winner:'soviet'},cityControl:l},p).graduated);}
 if(source.moscow){eq(G.evaluate(p,{...all,[source.moscow]:'german'}).grade,'german-decisive');grades.add('german-decisive');}eq(grades.size,9,scenario+' all grades reachable');
 fail(()=>G.evaluate({...p,thresholds:p.thresholds.slice(1)},all),/altered/);fail(()=>G.evaluate(p,{...all,Other:'german'}),/ledger/);
 if(scenario==='battle-for-moscow')continue;
 const map=require(scenario==='kiev-odessa'?'../maps/kiev-odessa-composite-experimental-v531.json':'../maps/'+scenario+'.json');
 const config=require('../maps/phase-configs/'+scenario+'.json');const policy=require(scenario==='kiev-odessa'?'../maps/housekeeping-configs/kiev-odessa-candidate-v521.json':'../maps/housekeeping-configs/'+scenario+'.json');
 const buildup=require(scenario==='kiev-odessa'?'../maps/buildup-configs/kiev-odessa-experimental-v533.json':'../maps/buildup-configs/'+scenario+'.json');
 const base={map,config,housekeepingPolicy:policy};const variant=G.withHistorical(base,'graduated');eq(G.withHistorical(variant,'historical'),base);
 const common={map,config,initialCityControl:buildup.initialCityControl,communicated:()=>true};
 const historical=H.create({...common,policy}),graded=H.create({...common,policy:variant.housekeepingPolicy});
 for(const l of byVP.values()){const state={units:{},cityControl:l};const a=historical.evaluate(state),b=graded.evaluate(state);eq(b.historical,{outcome:a.outcome,reason:a.reason});eq(b.graduated,G.evaluate(p,l));eq(b.outcome,b.graduated.winner==='draw'?'draw':b.graduated.winner+'-victory');}
 const cursor={scenarioId:scenario,turn:config.turns,index:config.phases.length-1,complete:false};eq(graded.close({cursor,state:{units:{},cityControl:allGerman},actor:'system'}).terminal.graduated.grade,'german-decisive');eq(graded.close({cursor:{...cursor,turn:config.turns-1},state:{units:{},cityControl:allGerman},actor:'system'}).terminal,null);
}
const {original,config}=require('../tools/audit-b4m-native-preview-v360').load();const base=P.project(original,config);const old=E.build(base);const profile=G.withNative(base,'graduated');const g=E.build(profile);eq(G.withNative(profile,'historical'),base);
const start=E.start(g,42,'auto-reference');eq(E.score(g,start),{german:2,soviet:12});eq(E.result(g,start),'soviet');
const final={...start,control:Object.fromEntries(Object.keys(start.control).map(k=>[k,'german']))};eq(E.result(g,final),'german');eq(E.score(g,final),{german:14,soviet:0});
const initial=S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state:start});const saved=S.serialize(initial);eq(S.serialize(S.restore(saved,{scenarioId:g.game.id,engine:'generic-hex-v1',config:g})),saved);fail(()=>S.restore(saved,{scenarioId:old.game.id,engine:'generic-hex-v1',config:old}),/scenario-package mismatch/);
console.log(checks+' graduated profile, score, grade reachability, historical adjudication and save binding assertions passed');
