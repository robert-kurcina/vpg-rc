'use strict';
// Synthetic terminal origins, actual production graph and campaign transaction.
const A=require('node:assert/strict'), C=require('../core/historical_campaign_session'), B=require('../core/historical_buildup_phase'), Binding=require('../core/movement_binding');
const root=x=>require('../'+x), opening=root('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const context={...structuredClone(opening),map:root('maps/kiev-odessa-composite-experimental-v531.json'),profile:root('maps/movement-configs/kiev-odessa-experimental-v531.json'),config:root('maps/phase-configs/kiev-odessa.json'),counterConfig:root('maps/counter-configs/kiev-odessa-experimental-v531.json'),combatPolicy:root('maps/combat-configs/kiev-odessa-experimental-v531.json'),rosterOverlay:root('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,buildupPolicy:root('maps/buildup-configs/kiev-odessa-experimental-v533.json'),buildupAllocation:root('games/kiev-odessa/experimental-preview/allocation-v533.json'),housekeepingPolicy:root('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
const b=B.create({...context,policy:context.buildupPolicy,allocation:context.buildupAllocation});
const board=Binding.build(context.map,context.profile).board;
const links=new Map(), geometric=new Map();
function add(m,a,z){if(!m.has(a))m.set(a,[]);m.get(a).push(z);}
for(const e of board.edges){for(const [a,z] of [[e.a,e.b],[e.b,e.a]]){add(geometric,a,z);if(e.verified&&!e.impassable&&!e.allSea&&!e.lake)add(links,a,z);}}
const edge=new Set(context.buildupPolicy.entryEdge.soviet);
const initial=C.create(context).snapshot().state;
const cities=context.map.cells.filter(c=>c.city?.name);
const enemy=Object.values(initial.units).filter(u=>u.owner==='german'&&u.hex&&!u.marker);
let n=0;const eq=(a,z,m)=>{A.deepEqual(a,z,m);n++;};
function oracle(origin,units){const blocked=new Set();for(const u of Object.values(units)){if(u.owner==='soviet'||!u.hex||u.marker)continue;blocked.add(u.hex);for(const z of geometric.get(u.hex)||[])blocked.add(z);} // reverse reachability, with exempt origin
 const reach=new Set([...edge].filter(x=>!blocked.has(x))),q=[...reach];for(let i=0;i<q.length;i++)for(const z of links.get(q[i])||[])if(!blocked.has(z)&&!reach.has(z)){reach.add(z);q.push(z);}
 return edge.has(origin)||reach.has(origin)||(links.get(origin)||[]).some(z=>reach.has(z));}
// Full eastern edge occupation is a deliberately synthetic isolation fixture.
const sealed=Object.fromEntries([...edge].map((hex,i)=>[enemy[i].id,{...enemy[i],hex}]));
const scenarios=[{},sealed,initial.units];let seed=579;const land=context.map.cells.filter(c=>c.terrain!=='sea').map(c=>c.id);
for(let i=0;i<30;i++){const units={};for(const u of enemy.slice(0,1+i%enemy.length)){seed=(Math.imul(seed,1664525)+1013904223)>>>0;units[u.id]={...u,hex:land[seed%land.length]};}scenarios.push(units);}
for(const units of scenarios)for(const city of cities)eq(b.communicated(city.id,'soviet',units),oracle(city.id,units),'communication '+city.id);
const cursor={...opening.cursor,turn:7,index:context.config.phases.length-2};
const interior=cities.filter(c=>!edge.has(c.id)&&oracle(c.id,{}));
for(const units of [{},sealed])for(const remaining of [[interior[0]],[interior[0],interior[1]]]){
 const state=structuredClone(initial);state.units=units;state.cityControl=Object.fromEntries(cities.map(c=>[c.city.name,remaining.includes(c)?'soviet':'german']));
 const ctx={...context,cursor,actor:'soviet',state};const s=C.create(ctx).execute({type:'finish-phase'}).session,end=s.execute({type:'finish-housekeeping'}).session,after=end.snapshot();
 const isolated=remaining.some(c=>!oracle(c.id,units));const expected=remaining.length===1?(isolated?'german-victory':'draw'):(isolated?'draw':'soviet-victory');
 eq(after.terminal.outcome,expected);eq(after.terminal.isolatedSovietCities,remaining.filter(c=>!oracle(c.id,units)).map(c=>c.city.name));eq(end.undo().session.snapshot(),s.snapshot());eq(C.restore(end.save(),ctx).snapshot(),after);
}
// Actual campaign replacement transaction: isolated Odessa, with and without Fleet.
const coastal='kiev-odessa/soviet-coastal-army';
const unit=initial.units[coastal],back=context.counterConfig.faces.back.find(f=>f.faceId===unit.reverseFaceId);
const state=structuredClone(initial);state.units={...sealed,[coastal]:{...unit,strengthStatus:'printed-reduced',activeFaceId:unit.reverseFaceId,printedCombatStrength:Number(back.visualTranscription.printedValues.split('-')[0])}};
eq(b.communicated(unit.hex,'soviet',state.units),false);
const replacement={type:'apply-replacement',unitId:coastal,hex:null};
for(const condition of ['undamaged','damaged','absent']){
 const start=structuredClone(state);if(condition==='absent')delete start.supportMarkers.blackSeaFleet;else start.supportMarkers.blackSeaFleet.condition=condition;
 const ctx={...context,state:start,cursor:{...opening.cursor,turn:2,index:context.config.phases.findIndex(p=>p.id==='soviet-buildup')},actor:'soviet'};
 const s=C.create(ctx);eq(s.canExecute(replacement),condition!=='absent');
 if(condition==='absent'){A.throws(()=>s.execute(replacement),/not in communication/);n++;continue;}
 const next=s.execute(replacement).session;eq(next.snapshot().state.units[coastal].strengthStatus,'printed-full');eq(next.snapshot().state.units[coastal].printedCombatStrength,unit.printedCombatStrength);eq(next.undo().session.snapshot(),s.snapshot());eq(C.restore(next.save(),ctx).snapshot(),next.snapshot());
}
console.log('PASS v579 actual graph isolation:',n,'assertions');
