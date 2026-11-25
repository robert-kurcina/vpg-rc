'use strict';
const assert=require('node:assert/strict');
const A=require('../core/actions');
const E=require('../legacy/engine');
const sc=require('../legacy/data/scenario.json');
const p=require('../legacy/data/rules_profiles.json');
const c=E.buildScenario(sc,p.profiles[p.defaultRuleset]);
let count=0;
const ctx=(s,phase=s.phase)=>({scenarioId:'battle-for-moscow',engine:'legacy-b4m-v1',config:c,state:s,actor:s.side,phase});
const fresh=()=>{let s=E.makeState(c,34);s.turn=2;s.side='soviet';s.phase='replacement';return s;};
const same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
{
 const s=fresh(),opts=A.legal(ctx(s),{type:'replacement'});
 const entry=opts.find(o=>o.operation==='enter');assert.ok(entry);count++;
 const result=A.execute(ctx(s),entry);assert.ok(result.ok,result.reason);same(s,fresh());count++;
 assert.equal(result.state.units.find(u=>u.id===entry.id).strength,'reduced');count++;
 const illegal=A.execute(ctx(result.state),{type:'replacement',operation:'restore',id:entry.id});
 assert.equal(illegal.ok,false);assert.strictEqual(illegal.state,result.state);count++;
 const old=fresh();assert.equal(E.applyReplacement(c,old,{type:'enter',id:entry.id,x:entry.x,y:entry.y}),true);old.replacementUsed=1;same(old,result.state);count++;
}
{
 const s=fresh();
 const invalid=A.execute(ctx(s),{type:'move',unitId:s.units[0].id,x:0,y:0});
 assert.equal(A.execute(ctx(s),{type:'combat-resolve',defender:'foo',attackers:['bar'],die:1}).ok,false);
 assert.equal(invalid.ok,false);same(invalid.state,s);count++;
 assert.throws(()=>A.legal({...ctx(s),actor:'german'},{type:'replacement'}),/Wrong acting player/);count++;
 assert.throws(()=>A.legal({...ctx(s),scenarioId:'kiev'},{type:'replacement'}),/not available/);count++;
}
{
 // Controlled movement fixture, compare to the untouched B4M resolution function.
 const s=E.makeState(c,42);s.side='german';s.turn=2;s.phase='movement';
 const move=s.units.filter(u=>u.army==='german'&&u.position).flatMap(u=>{
  const opts=E.legalMoves(c,s,u,'normal');return opts.length?[{u,option:opts[0]}]:[];
 })[0];
 assert.ok(move,'No legal movement fixture');
 const opts=A.legal(ctx(s),{type:'move',unitId:move.u.id,mode:'normal'});
 assert.ok(opts.some(o=>o.x===move.option.x&&o.y===move.option.y));count++;
 const action={type:'move',unitId:move.u.id,mode:'normal',x:move.option.x,y:move.option.y};
 const res=A.execute(ctx(s),action);assert.ok(res.ok,res.reason);
 const direct=JSON.parse(JSON.stringify(s));assert.equal(E.move(c,direct,action.unitId,action.x,action.y,'normal'),true);same(res.state,direct);count++;
 const orig=JSON.stringify(s);const nope=A.execute(ctx(s),{...action,x:999});assert.equal(nope.ok,false);assert.strictEqual(nope.state,s);assert.equal(JSON.stringify(s),orig);count++;
 assert.equal(A.legal(ctx({...s,phase:'special'}),{type:'move',unitId:move.u.id,mode:'normal'}).length,0);count++;
}
{
 // Combat preview and deterministic commit, with the die already chosen upstream.
 let located=null;
 for(const h of c.raw.hexes){if(h.terrain!=='open'||h.city&&h.city!=='none')continue;
  const ns=E.neighbours(c,h.x,h.y);if(ns.length<2)continue;
  const s=E.makeState(c,17);s.side='german';s.turn=2;s.phase='combat-resolution';
  for(const u of s.units){u.position=null;u.strength='dead';}
  const a=s.units.find(u=>u.army==='german'),d=s.units.find(u=>u.army==='soviet');
  Object.assign(a,{position:{x:ns[0].x,y:ns[0].y},strength:'full',combatFull:8,combatReduced:4});
  Object.assign(d,{position:{x:h.x,y:h.y},strength:'full',combatFull:2,combatReduced:1});
  const action={type:'combat-preview',attackers:[a.id],defender:d.id,die:1};
  if(A.legal(ctx(s),action)){located={s,action};break;}
 }
 assert.ok(located,'No combat fixture');
 const {s,action}=located;const before=JSON.stringify(s);
 const preview=A.execute(ctx(s),action);assert.ok(preview.ok);assert.strictEqual(preview.state,s);count++;
 assert.equal(A.execute(ctx(s),{...action,type:'combat-resolve',die:null}).ok,false);assert.equal(JSON.stringify(s),before);count++;
 const committed={...action,type:'combat-resolve',options:{advanceId:'none'}};
 const r=A.execute(ctx(s),committed),direct=JSON.parse(before);
 assert.ok(r.ok,r.reason);const reference=E.resolveAttack(c,direct,action.attackers,action.defender,action.die,{advanceId:'none'});
 assert.deepEqual(r.result,reference);same(r.state,direct);count++;
 assert.equal(JSON.stringify(s),before);assert.equal(s.seed,r.state.seed);count++;
 const invalid=A.execute(ctx(s),{...committed,options:{attackerLossId:'not-a-unit'}});
 assert.equal(invalid.ok,false);assert.strictEqual(invalid.state,s);assert.equal(JSON.stringify(s),before);count++;
}
{
 const s=E.makeState(c,19,'manual');const start=c.raw.hexes.find(h=>h.germanStart);
 const unit=s.units.find(u=>u.army==='german'&&!u.position);
 assert.ok(start&&unit);
 const result=A.execute(ctx(s),{type:'setup-place',unitId:unit.id,x:start.x,y:start.y});
 assert.ok(result.ok,result.reason);same(s,E.makeState(c,19,'manual'));count++;
 assert.equal(result.state.units.find(u=>u.id===unit.id).position.x,start.x);count++;
 assert.equal(A.execute(ctx(s),{type:'finish-setup'}).ok,false);count++;
}
{
 const s=fresh();s.replacementUsed=E.replacementBudget(c,s);
 assert.equal(A.legal(ctx(s),{type:'replacement'}).length,0);count++;
 assert.equal(A.execute(ctx(s),{type:'replacement',operation:'restore',id:s.units[0].id}).ok,false);count++;
 assert.throws(()=>A.legal({...ctx(s),phase:'movement'},{type:'move',unitId:'x'}),/Phase context/);count++;
}
{
 const s=E.makeState(c,92);s.turn=4;s.side='soviet';s.phase='reinforcement';
 const opts=A.legal(ctx(s),{type:'shock-reinforcement'});
 if(opts.length){const selected=opts[0];const original=JSON.stringify(s);
  const out=A.execute(ctx(s),selected);assert.ok(out.ok,out.reason);
  const direct=JSON.parse(original);assert.equal(E.performShockReinforcement(c,direct,{x:selected.x,y:selected.y}),true);
  same(out.state,direct);assert.equal(JSON.stringify(s),original);count++;
  assert.equal(A.execute(ctx(s),{...selected,x:999}).ok,false);count++;
 }
}
{
 const s=E.makeState(c,94);s.turn=2;s.side='german';s.phase='special';
 const movable=s.units.filter(u=>u.army==='german'&&u.type==='tank'&&u.position).find(u=>E.legalMoves(c,s,u,'panzer').length);
 if(movable){const query={type:'move',unitId:movable.id,mode:'panzer'};
  assert.ok(A.legal(ctx(s),query).length);count++;
  assert.equal(A.legal({...ctx(s),usedUnitIds:[movable.id]},query).length,0);count++;
  assert.equal(A.execute({...ctx(s),usedUnitIds:[movable.id]}, {...query,x:0,y:0}).ok,false);count++;
 }
}
console.log('PASS shared action boundary:',count,'assertion groups; state parity, fail-closed, phase controls, explicit combat die');
