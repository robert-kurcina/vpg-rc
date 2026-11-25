'use strict';
const A=require('node:assert/strict'),Auto=require('../core/historical_campaign_autoplay'),Campaign=require('../core/historical_campaign_session'),Catalog=require('../core/historical_campaign_action_catalog');
const F=require('./fixtures/kiev-source-opening-v437');
const map=F.map,counterConfig=F.counterConfig,profile=require('../maps/movement-configs/kiev.json'),config=require('../maps/phase-configs/kiev.json');
const combatPolicy=require('../maps/combat-configs/kiev.json');
const committed=require('../core/historical_deployment_session').create({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},allocation:F.allocation,placements:F.placements}).commit();
const ctx={...committed.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy:require('../maps/buildup-configs/kiev.json'),buildupAllocation:committed.allocation,housekeepingPolicy:require('../maps/housekeeping-configs/kiev.json')};
let n=0;const ok=(v,m)=>{A.ok(v,m);n++};const eq=(a,b,m)=>{A.deepEqual(a,b,m);n++};
const cursor={...ctx.cursor,turn:3,index:config.phases.findIndex(p=>p.id==='german-movement')};
const c={...ctx,actor:'german',cursor,state:structuredClone(Campaign.create(ctx).snapshot().state)};
const s=Campaign.create(c),snap=s.snapshot(),before=s.save();
const options=Catalog.discover({session:s,context:c,enumerateCombinedPlans:false});
const ranked=Auto.rankObjectiveMoves({snapshot:snap,context:c,commands:options.commands,communication:true});
ok(ranked.length>0);ok(ranked.length<=32);ok(ranked.every(x=>x.score>0));
const B=require('../core/historical_buildup_phase').create({map,profile,config,counterConfig,policy:c.buildupPolicy,allocation:c.buildupAllocation,combatPolicy});
for(const x of ranked){const {unitId,path}=x.action.request;const projected={...snap.state.units,[unitId]:{...snap.state.units[unitId],hex:path.at(-1)}};let net=0;for(const u of Object.values(snap.state.units).filter(u=>u.hex&&!u.marker)){const a=B.communicated(u.hex,u.owner,snap.state.units),b=B.communicated(projected[u.id].hex,u.owner,projected);net+=(Number(b)-Number(a))*(u.owner===snap.actor?1:-1);}eq(x.communication.net,net);}
for(let i=1;i<ranked.length;i++)ok(ranked[i-1].score>=ranked[i].score);
const d=Auto.decide({session:s,context:c,policy:{attackSelection:'continuation-pilot'}});
eq(d.reason,'objective-directed-ground-movement');eq(d.action,ranked[0].action);eq(s.save(),before);
const moved=s.execute(d.action).session;ok(moved.snapshot().pendingGround);
const resolved=Auto.decide({session:moved,context:c,policy:{attackSelection:'continuation-pilot'}});eq(resolved.status,'action');ok(moved.execute(resolved.action).session.snapshot());
const baseline=Auto.decide({session:s,context:c});eq(baseline.reason,'source-legal-ground-movement');
const allFriendly={...snap,state:{...snap.state,cityControl:Object.fromEntries(Object.keys(snap.state.cityControl).map(k=>[k,snap.actor]))}};
eq(Auto.rankObjectiveMoves({snapshot:allFriendly,context:c,commands:options.commands}),[]);
console.log('PASS communication movement',n,'assertions; ranked',ranked.length,'best',JSON.stringify(ranked[0]));
// Independent geography check on all ranked moves, including the no-credit
// rule for moving from a safe position into enemy adjacency.
const G=require('../core/historical_combat_geography').create(map,profile,{cityMarkerMode:combatPolicy.cityMarkerMode,fortificationMode:combatPolicy.fortificationMode});
const board=require('../core/movement_binding').build(map,profile).board;
const neighbors=h=>board.edges.filter(e=>!e.impassable&&!e.allSea&&!e.lake&&(e.a===h||e.b===h)).map(e=>e.a===h?e.b:e.a);
const protection=(h,u)=>{const attackers=Object.values(snap.state.units).filter(e=>e.owner!==snap.actor&&!e.marker&&neighbors(h).includes(e.hex)).map(e=>e.id);if(!attackers.length)return null;try{const g=G.evaluate({attackers,defenders:[u.id],defenderHex:h},{...snap.state.units,[u.id]:{...u,hex:h}});return -(combatPolicy.modifiers.terrainColumnShifts[g.defenderTerrain]||0)-(g.allAttackersAcrossRiver?combatPolicy.modifiers.allAttackersAcrossRiverShift:0);}catch{return null;}};
for(const x of ranked){const {unitId,path}=x.action.request;const u=snap.state.units[unitId],a=protection(path[0],u),b=protection(path.at(-1),u);eq(x.protectionDelta,a===null||b===null?0:b-a);ok(Math.abs(x.score-(2*x.reinforced+x.captured+0.1*x.progress+0.25*x.communication.net+0.15*x.protectionDelta+0.25*x.concentrationDelta))<1e-9);}
// Construct comparable exposed positions on source geometry. Synthetic moves
// are ranking witnesses only, not certified routes.
const cities=new Set(map.cells.filter(c=>c.city?.name).map(c=>c.id));
const edgeOk=(a,b)=>board.edges.some(e=>e.verified&&!e.impassable&&!e.allSea&&!e.lake&&((e.a===a&&e.b===b)||(e.a===b&&e.b===a))&&!e.river);
const pair=map.cells.flatMap(e=>{const ns=neighbors(e.id).filter(h=>!cities.has(h)&&edgeOk(e.id,h));return ns.flatMap(a=>ns.filter(b=>board.cells[a].terrain==='open'&&board.cells[b].terrain==='forest'&&edgeOk(a,b)).map(b=>[e.id,a,b]));})[0];ok(pair);
const [enemy,open,forest]=pair;
const own=Object.values(snap.state.units).find(u=>u.owner==='german'),opp=Object.values(snap.state.units).find(u=>u.owner==='soviet');
const cityControl=Object.fromEntries(Object.keys(snap.state.cityControl).map(k=>[k,'german']));
const fixture=(from,to)=>{const units={[own.id]:{...own,hex:from},[opp.id]:{...opp,hex:enemy}};return Auto.rankObjectiveMoves({snapshot:{...snap,state:{...snap.state,units,cityControl}},context:c,commands:[{type:'declare-ground-move',request:{unitId:own.id,path:[from,to]}}],communication:true});};
const result=fixture(open,forest);ok(result.length===1);eq(result[0].protectionDelta,1);ok(result[0].score>0);
const reverse=fixture(forest,open);ok(!reverse.length||reverse[0].protectionDelta===-1);
const safe=map.cells.find(h=>!cities.has(h.id)&&h.terrain==='open'&&!neighbors(enemy).includes(h.id)&&h.id!==enemy).id;
const entry=fixture(safe,forest);ok(!entry.length||entry[0].protectionDelta===0);
console.log('PASS positional movement',n,'assertions',pair);
