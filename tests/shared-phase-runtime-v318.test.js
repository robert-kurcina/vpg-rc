const assert=require('node:assert/strict');
const P=require('../core/phase_runtime');
const registry=require('../maps/scenarios/registry.json');
for(const id of ['arduous','leningrad']){
 const c=require('../maps/phase-configs/'+id+'.json');
 assert.equal(P.validate(c),true);
 assert.equal(registry.games.find(g=>g.id===id).domains.phases.status,'source-bound-non-executable');
 let s=P.start(c);assert.equal(P.current(c,s).id,'german-combat');
 assert.equal(P.permitted(c,s,'move'),false);assert.equal(P.permitted(c,s,'declare-attack'),true);
 assert.throws(()=>P.advance(c,s),/gate required/);
 assert.throws(()=>P.advance(c,s,()=>false),/unfinished/);
 assert.equal(P.current(c,s).id,'german-combat');
 const ids=[]; let n=0;
 while(!s.complete){ids.push(`${s.turn}:${P.current(c,s).id}`);s=P.advance(c,s,()=>true);assert.ok(++n<100);}
 assert.equal(ids.length,7+(c.turns-1)*9);
 assert.deepEqual(ids.slice(0,7),c.phases.slice(2).map(p=>'1:'+p.id));
 assert.equal(ids[7],'2:german-buildup');
 assert.equal(ids.at(-1),`${c.turns}:housekeeping`);
 assert.throws(()=>P.advance(c,s,()=>true),/complete/);
 assert.throws(()=>P.current(c,{...s,scenarioId:'battle-for-moscow'}),/Invalid phase cursor/);
 assert.throws(()=>P.validate({...c,phases:[...c.phases,c.phases[0]]}),/Invalid phase/);
 assert.throws(()=>P.validate({...c,firstTurnStart:'nonexistent'}),/first-turn/);
 console.log('PASS',id,ids.length,'source-derived phase transitions');
}
assert.equal(registry.games.find(g=>g.id==='arduous').mode,'historical-non-executable');
assert.equal(registry.games.find(g=>g.id==='leningrad').mode,'historical-non-executable');
console.log('PASS shared configurable phase runtime with fail-closed game activation');
{
 const base=require('../maps/phase-configs/arduous.json');
 const custom=structuredClone(base);
 custom.scenarioId='hypothetical-phase-test';custom.turns=2;
 custom.phases.splice(4,0,{id:'weather-check',owner:'german',kind:'custom',permissions:['weather']});
 let s=P.start(custom);let observed=[];
 while(!s.complete){observed.push(P.current(custom,s).id);s=P.advance(custom,s,()=>true);}
 assert.equal(observed.filter(x=>x==='weather-check').length,2);
 assert.equal(observed.length,8+10);
 assert.throws(()=>P.validate({...custom,players:['soviet','german']}),/Player order/);
 console.log('PASS configurable custom phases and invalid player-order rejection');
}
