'use strict';
const A=require('node:assert/strict'),Auto=require('../core/historical_campaign_autoplay');
const F=require('./fixtures/kiev-source-opening-v437'),map=F.map,profile=require('../maps/movement-configs/kiev.json');
const board=require('../core/movement_binding').build(map,profile).board;
const adj=new Map(Object.keys(board.cells).map(h=>[h,[]]));
for(const e of board.edges)if(!e.impassable&&!e.allSea&&!e.lake){adj.get(e.a).push(e.b);adj.get(e.b).push(e.a);}
let checks=0;const eq=(a,b)=>{A.deepEqual(a,b);checks++};const ok=x=>{A.ok(x);checks++};
for(const actor of ['german','soviet']){
 const opponent=actor==='german'?'soviet':'german';
 const city=map.cells.find(c=>c.city?.name&&adj.get(c.id)?.length>=3);
 const dist=Auto.objectiveDistanceField(adj,[city.id]);
 const enemy=adj.get(city.id)[0];
 const from=[...dist].find(([h,d])=>d===3&&adj.get(h).some(n=>dist.get(n)===2&&!adj.get(enemy).includes(n)))[0];
 const to=adj.get(from).find(n=>dist.get(n)===2&&!adj.get(enemy).includes(n));
 const cmd={type:'declare-ground-move',request:{unitId:'reserve',path:[from,to]}};
 const state={cityControl:Object.fromEntries(map.cells.filter(c=>c.city?.name).map(c=>[c.city.name,actor])),units:{reserve:{id:'reserve',owner:actor,hex:from},enemy:{id:'enemy',owner:opponent,hex:enemy}}};
 const snapshot={actor,state},context={map,profile};
 const args={snapshot,context,commands:[cmd],operational:true};
 eq(Auto.rankObjectiveMoves(args),[]);
 const result=Auto.rankObjectiveMoves({...args,objectivePolicy:'reserve-relief'});
 eq(result.length,1);eq(result[0].reliefProgress,1);eq(result[0].action,cmd);
 eq(Auto.rankObjectiveMoves({...args,objectivePolicy:'reserve-relief',snapshot:{actor,state:{...state,units:{...state.units,enemy:{...state.units.enemy,marker:true}}}}}),[]);
 eq(Auto.rankObjectiveMoves({...args,objectivePolicy:'reserve-relief',snapshot:{actor,state:{...state,units:{...state.units,garrison:{id:'garrison',owner:actor,hex:city.id}}}}}),[]);
 // Two mobile reserves: the closer one should receive the relief credit.
 const near=to;
 const nearTo=adj.get(near).find(h=>dist.get(h)===1&&h!==enemy);
 ok(nearTo);
 const nearCmd={type:'declare-ground-move',request:{unitId:'near',path:[near,nearTo]}};
 const two={actor,state:{...state,units:{...state.units,near:{id:'near',owner:actor,hex:near}}}};
 const rank=(commands,snapshot=two)=>Auto.rankObjectiveMoves({...args,commands,snapshot,objectivePolicy:'reserve-relief'});
 eq(rank([cmd,nearCmd]).map(x=>x.action.request.unitId),['near']);
 // No legal advancing path for the nearer unit: do not suppress the mobile reserve.
 eq(rank([cmd]).map(x=>x.action.request.unitId),['reserve']);
 const away={type:'declare-ground-move',request:{unitId:'near',path:[near,from]}};
 eq(rank([cmd,away]).map(x=>x.action.request.unitId),['reserve']);
 // Marker interactions are not reliable relief commitments.
 const marked={actor,state:{...two.state,supportMarkers:{m:{hex:nearTo}}}};
 ok(rank([cmd,nearCmd],marked).some(x=>x.action.request.unitId==='reserve'&&x.reliefProgress===1));
 // An approach improving two threatened cities must not double-count
 // the benefit of a single reserve. Actual Kiev map topology.
 const overlapUnits={reserve:{id:'reserve',owner:actor,hex:'0104'},enemyX:{id:'enemyX',owner:opponent,hex:'0101'},enemyY:{id:'enemyY',owner:opponent,hex:'0305'}};
 const overlap={actor,state:{cityControl:state.cityControl,units:overlapUnits}};
 const both={type:'declare-ground-move',request:{unitId:'reserve',path:['0104','0203']}};
 for(const target of ['0201','0404']){
  const field=Auto.objectiveDistanceField(adj,[target]);
  eq(field.get('0104')-field.get('0203'),1);
 }
 eq(rank([both],overlap)[0].reliefProgress,1);
 // A sole garrison is not an available relief reserve. Kovel is friendly,
 // even when it is not itself threatened.
 const garrisonHex='0502';
 const garrisonTo=adj.get(garrisonHex).find(h=>Auto.objectiveDistanceField(adj,['0201']).get(h)<Auto.objectiveDistanceField(adj,['0201']).get(garrisonHex)&&h!==overlapUnits.enemyX.hex);
 ok(garrisonTo);
 const gc={type:'declare-ground-move',request:{unitId:'garrison',path:[garrisonHex,garrisonTo]}};
 const protectedState={actor,state:{...overlap.state,units:{...overlapUnits,garrison:{id:'garrison',owner:actor,hex:garrisonHex}}}};
 ok(!rank([gc],protectedState).some(x=>x.reliefProgress>0));
 ok(dist.get(city.id)===0);eq(dist.get(from),3);eq(dist.get(to),2);
}
eq(Auto.policyOf({phaseScope:'operational'}).objectivePolicy,'baseline');eq(Auto.policyOf({phaseScope:'operational',objectivePolicy:'reserve-relief'}).objectivePolicy,'reserve-relief');A.throws(()=>Auto.policyOf({objectivePolicy:'reserve-relief'}));checks++;A.throws(()=>Auto.policyOf({phaseScope:'operational',objectivePolicy:'invalid'}));checks++;
console.log('PASS reserve-relief advisory ranking',checks,'assertions, both factions');
