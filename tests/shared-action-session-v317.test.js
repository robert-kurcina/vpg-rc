'use strict';
const assert=require('node:assert/strict');
const S=require('../core/session');
const A=require('../core/actions');
const E=require('../legacy/engine');
const raw=require('../legacy/data/scenario.json');
const profiles=require('../legacy/data/rules_profiles.json');
const config=E.buildScenario(raw,profiles.profiles[profiles.defaultRuleset]);
const make=(phase='movement',seed=42)=>{const state=E.makeState(config,seed);state.turn=2;state.side='german';state.phase=phase;return S.create({scenarioId:'battle-for-moscow',config,state});};
let checks=0;
const check=(x,msg)=>{assert.ok(x,msg);checks++;};
const eq=(x,y)=>{assert.deepStrictEqual(x,y);checks++;};
const command=(session,action)=>{const r=S.execute(session,action);check(r.ok,r.reason);return r.session;};
{
 const start=make();
 const available=start.state.units.filter(u=>u.army==='german'&&u.position).map(u=>({u,m:S.legal(start,{type:'move',unitId:u.id,mode:'normal'})})).find(o=>o.m.length);
 check(available,'Need legal movement fixture');
 const a={type:'move',unitId:available.u.id,mode:'normal',x:available.m[0].x,y:available.m[0].y};
 const after=command(start,a);
 check(after.usedUnitIds.includes(a.unitId));
 eq(S.legal(after,{type:'move',unitId:a.unitId,mode:'normal'}),[]);
 const illegal=S.execute(after,{...a,x:999,y:999});check(!illegal.ok);check(illegal.session===after);
 eq(after.history.length,1);eq(start.history.length,0);
 const restored=S.undo(after);check(restored.ok);eq(restored.session.state,start.state);eq(restored.session.usedUnitIds,[]);
 eq(restored.session.history.length,0);
 const replay=command(restored.session,a);eq(replay.state,after.state);eq(replay.usedUnitIds,after.usedUnitIds);
 const next=command(after,{type:'finish-phase'});eq(next.usedUnitIds,[]);
 check(next.state.side==='soviet');
 const back=S.undo(next);check(back.ok);eq(back.session.state,after.state);eq(back.session.usedUnitIds,after.usedUnitIds);
 const backAgain=S.undo(back.session);check(backAgain.ok);eq(backAgain.session.state,start.state);
 check(!S.undo(start).ok);
}
{
 const start=make('combat',57);
 const preview={type:'combat-preview',defender:'unknown',attackers:['unknown'],die:3};
 const reject=S.execute(start,preview);check(!reject.ok);check(reject.session===start);
 const transition=command(start,{type:'finish-phase'});eq(transition.state.phase,'movement');
 eq(S.undo(transition).session.state,start.state);
}
{
 // Two queued combats, including die commitment and Undo/replay.
 let start=make('combat',22);
 const s=start.state;
 for(const u of s.units){u.position=null;u.strength='dead';}
 const attack=s.units.filter(u=>u.army==='german').slice(0,2);
 const defense=s.units.filter(u=>u.army==='soviet').slice(0,2);
 const locations=[];
 for(const h of config.raw.hexes){
  if(h.terrain!=='open'||h.city&&h.city!=='none')continue;
  const adjacent=E.neighbours(config,h.x,h.y).find(n=>E.hexAt(config,n.x,n.y)?.terrain==='open');
  if(!adjacent||locations.some(p=>E.dist(p.h.x,p.h.y,h.x,h.y)<4))continue;
  locations.push({h,adjacent});if(locations.length===2)break;
 }
 eq(locations.length,2);
 for(let i=0;i<2;i++){
  const {h,adjacent}=locations[i];Object.assign(attack[i],{position:{x:adjacent.x,y:adjacent.y},strength:'full',combatFull:8,combatReduced:4});
  Object.assign(defense[i],{position:{x:h.x,y:h.y},strength:'full',combatFull:2,combatReduced:1});
 }
 start=S.create({scenarioId:'battle-for-moscow',config,state:s});
 const battle=(i)=>S.legal(start,{type:'declare-battle'}).find(b=>b.defender===defense[i].id&&b.attackers.length===1&&b.attackers[0]===attack[i].id);
 check(battle(0));check(battle(1));
 let current=command(start,{type:'declare-battle',...battle(0)});
 current=command(current,{type:'declare-battle',...battle(1)});
 const committed=command(current,{type:'finish-phase'});check(committed.state.pendingBattle?.die>=1);
 const die=committed.state.pendingBattle.die;
 const resolved=command(committed,{type:'resolve-pending',options:{advanceId:'none'}});
 const reverted=S.undo(resolved);check(reverted.ok);eq(reverted.session.state,committed.state);
 eq(reverted.session.state.pendingBattle.die,die);
 const again=command(reverted.session,{type:'resolve-pending',options:{advanceId:'none'}});eq(again.state,resolved.state);
 eq(again.usedUnitIds,resolved.usedUnitIds);
 const previous=S.undo(S.undo(reverted.session).session); // Undo commitment and second declaration
 check(previous.ok);eq(previous.session.state.declaredBattles.length,1);
}
{
 assert.throws(()=>S.create({scenarioId:'kiev',config,state:make().state}),/not available/);checks++;
 assert.throws(()=>S.create({scenarioId:'battle-for-moscow',config,state:{...make().state,phase:'bogus'}}),/Unknown action phase/);checks++;
}
console.log('PASS shared action session:',checks,'checks; used-unit tracking, immutable rejects, queued combat Undo and deterministic replay');
