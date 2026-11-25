'use strict';
/* Seven-turn legal transaction acceptance, intentionally no elective movement or
 * combat. This is NOT a strategic, all-decisions, or victory-play quality test. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const Deployment=require('../core/historical_deployment_session');
const Inventory=require('../core/historical_source_face_inventory');
const Campaign=require('../core/historical_campaign_session');
const map=require('../maps/arduous.json'),setupSpec=require('../maps/setup/arduous.json');
const config=require('../maps/phase-configs/arduous.json'),profile=require('../maps/movement-configs/arduous.json');
const counterConfig=require('../maps/counter-configs/arduous.json'),fixedPolicy=require('../maps/setup/arduous-fixed-pieces.json');
const combatPolicy=require('../maps/combat-configs/arduous.json'),buildupPolicy=require('../maps/buildup-configs/arduous.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/arduous.json');
const fixture=require('./fixtures/arduous-source-setup-v419');
const groups=setupSpec.concealedSetup.groups;
let deployment=Deployment.create({map,setupSpec,counterConfig,inventory:Inventory.create(require('../maps/setup/arduous-inventory.json')),
 phaseConfig:config,movementProfile:profile,fixedPolicy,allocation:fixture.allocation,placements:fixture.placements});
deployment=deployment.permute(groups,groups.flatMap(g=>fixture.allocation[g]).slice().reverse());
const committed=deployment.commit({requireMixed:true});
const context={...committed.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,
 buildupPolicy,buildupAllocation:committed.allocation,housekeepingPolicy,fixedPolicy};
const expectedPhases=["german-buildup","german-movement","german-combat","german-special-movement","soviet-buildup","soviet-special-movement","soviet-combat","soviet-movement","housekeeping"];
const entries=[];
let s=Campaign.create(context),count=0,placed=[],housekeeping=0,resumeAt=0;const byPhase={};
const action=a=>{s=s.execute(a).session;count++;};
const slotByTurn=turn=>buildupPolicy.reinforcements.filter(x=>x.turn===turn);
while(!s.snapshot().cursor.complete&&count<140){
 const snap=s.snapshot(),kind=snap.phaseKind;
 const key=`${snap.cursor.turn}:${snap.phaseId}`; if(entries.at(-1)!==key)entries.push(key);byPhase[kind]=(byPhase[kind]||0)+1;
 if(kind==='combat'){
  if(snap.combat.status==='air-sea-open')action({type:'combat',action:{type:'finish-air-sea'}});
  else if(snap.combat.status==='awaiting-declarations')action({type:'combat',action:{type:'commit-battles',battles:[]}});
  else action({type:'combat',action:{type:'finish-combat'}});
 }else if(kind==='movement'||kind==='special-movement')action({type:'finish-phase'});
 else if(kind==='buildup'){
  if(snap.actor==='soviet'){
   const due=slotByTurn(snap.cursor.turn).filter(x=>!snap.buildup?.placedSlotIds?.includes(x.slotId));
   const available=due[0];
   if(available){
    let done=false;
    for(const hex of buildupPolicy.entryEdge.soviet){
     try{action({type:'place-reinforcement',slotId:available.slotId,hex});placed.push({slot:available.slotId,hex});done=true;break;}
     catch(e){if(!/Illegal reinforcement edge|overstacked/.test(e.message))throw e;}
    }
    if(done)continue;
   }
  }
  action({type:'finish-buildup'});
 }else if(kind==='housekeeping'){
  action({type:'finish-housekeeping'});housekeeping++;
  if(housekeeping===3){const saved=s.save();s=Campaign.restore(saved,context);resumeAt=housekeeping;assert.deepEqual(Campaign.restore(saved,context).snapshot(),s.snapshot());}
 }else throw Error('Unsupported phase '+kind);
}
const final=s.snapshot();
const expectedEntries=Array.from({length:7},(_,i)=>expectedPhases.slice(i===0?2:0).map(p=>`${i+1}:${p}`)).flat();
assert.deepEqual(entries,expectedEntries,"Printed §4 phase order and §6 opening exceptions");
assert.deepEqual(Object.entries(final.state.cityControl).map(([k,v])=>v),Array(12).fill("soviet"),"§5 initial cities remain Soviet without movement");
assert.equal(final.cursor.complete,true,'Seven turns complete');
assert.equal(housekeeping,7,'Seven housekeeping phases');
assert.equal(resumeAt,3,'Mid-campaign save and resume');
assert.equal(placed.length,7,'All seven source-ground reinforcements admitted');
assert.equal(final.terminal.outcome,'soviet-victory');
assert.equal(final.terminal.axisControlledCount,0);
assert.deepEqual(Campaign.restore(s.save(),context).snapshot(),final,'Final save round-trips');
const introduced=placed.map(p=>buildupPolicy.reinforcements.find(x=>x.slotId===p.slot));
assert.equal(introduced.filter(x=>x.printedKind==='mechanized').length,3);
assert.deepEqual([1,2,3,4,5,6,7].map(turn=>["infantry","mechanized"].map(kind=>introduced.filter(x=>x.turn===turn&&x.printedKind===kind).length)),[[2,2],[1,1],[1,0],[0,0],[0,0],[0,0],[0,0]],"§11 per-turn arrivals");
for(const p of placed){const slot=buildupPolicy.reinforcements.find(x=>x.slotId===p.slot); assert.ok(buildupPolicy.entryEdge.soviet.includes(p.hex)); }
const mechFaces=Object.values(final.state.units).filter(x=>x.class==='mechanized'&&x.id.startsWith('arduous-front-'));
assert.equal(mechFaces.length,10);
assert(mechFaces.every(x=>x.strengthStatus==='untried'&&x.printedCombatStrength===null),'Concealed arrivals remain unrevealed');
const report={checkpoint:356,version:'v590',phaseEntries:entries.length,scope:'seven-turn no-optional-combat-or-movement source-transaction smoke',
 actions:count,housekeeping,reinforcements:placed,terminal:final.terminal.outcome,
 limitations:['No optional attacks or movement exercised','This is not a full human-play or AI-play acceptance','The source opening uses a deterministic candidate assignment']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/arduous-source-phase-v590.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS Arduous seven-turn source transaction smoke',JSON.stringify(report));
