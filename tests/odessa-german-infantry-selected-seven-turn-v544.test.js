'use strict';
/* Checkpoint 310 source-face-variant acceptance: real B4M combat followed by all seven Kiev–Odessa phases,
 * including Turn 2/3/5/6 ground reinforcements. Source geometry explicitly
 * remains experimental: this is NOT historical certification or naval testing. */
const assert=require('node:assert/strict');
const req=p=>require('../'+p);
const Campaign=req('core/historical_campaign_session');
const Human=req('core/historical_campaign_human');
const opening=req('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const Editor=req('core/historical_source_setup_editor');
const selectedSetup=Editor.create({opening,
 policy:req('games/kiev-odessa/experimental-preview/setup-policy-v534.json'),
 map:req('maps/kiev-odessa-composite-experimental-v531.json'),
 counterConfig:req('maps/counter-configs/kiev-odessa-experimental-v531.json'),
 buildupAllocation:req('games/kiev-odessa/experimental-preview/allocation-v533.json')})
 .selectInfantryReserve('kiev-front-r02c06');
const changedOpening=selectedSetup.commit();
const context={...structuredClone(changedOpening),map:req('maps/kiev-odessa-composite-experimental-v531.json'),
 profile:req('maps/movement-configs/kiev-odessa-experimental-v531.json'),
 config:req('maps/phase-configs/kiev-odessa.json'),
 counterConfig:req('maps/counter-configs/kiev-odessa-experimental-v531.json'),
 combatPolicy:req('maps/combat-configs/kiev-odessa-experimental-v531.json'),
 rosterOverlay:req('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,
 buildupPolicy:req('maps/buildup-configs/kiev-odessa-experimental-v533.json'),
 buildupAllocation:selectedSetup.selectedAllocation(),
 housekeepingPolicy:req('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
let n=0;const eq=(a,b,label)=>{assert.deepStrictEqual(a,b,label);n++};
const ok=(a,label)=>{assert.ok(a,label);n++};
const fail=(f,re,label)=>{assert.throws(f,re,label);n++};
let s=Campaign.create(context);
const step=a=>{s=s.execute(a).session;return s.snapshot()};
let human=Human.create({session:s,context});
human=human.choose({type:'combat',action:{type:'finish-air-sea'}});
const battle=human.view().proposals.find(b=>b.defenderHex==='0205'&&b.attackers.join(',')==='kiev-front-r01c01,kiev-front-r01c03');
ok(battle,'Authoritative original Kiev opening attack still legal');
human=human.choose({type:'combat',action:{type:'commit-battles',battles:[battle]}})
 .choose({type:'combat',action:{type:'select-battle',defenderHex:'0205'}})
 .choose({type:'combat',action:{type:'commit-ground-air',faceId:'kiev-front-r03c01'}}).roll(3);
eq(human.view().crtOutcome,'EX','Actual common CRT Exchange result after committed die');
const committedSave=human.save();
eq(Human.restore(committedSave,context).view().crtOutcome,'EX','Pending EX survives authenticated browser-equivalent human save');
human=Human.restore(committedSave,context).choose(human.view().options[0]);
s=Campaign.restore(human.save().campaign,context);
const outcome=s.snapshot();
eq(outcome.combat.resolved.length,1,'Genuine resolved B4M battle before seven-turn continuation');
eq(outcome.state.units['kiev-front-r01c01'].strengthStatus,'printed-reduced','First Panzer reduced by actual battle');
const turnPhases=new Map(),arrivals=[],phaseEvents=[];
const plan={2:[['t2-slovak','kiev-front-r02c07'],['t2-hungarian','kiev-front-r04c08']],
 3:[['t3-german-infantry','kiev-front-r02c06'],['t3-italian-motorized','kiev-front-r04c01']],
 5:[['t5-soviet-army','kiev-front-r04c05']],
 6:[['t6-soviet-army','kiev-front-r04c06']]};
let actions=0,loop=0;
while(!s.snapshot().cursor.complete&&loop++<160){
 const snap=s.snapshot(),turn=snap.cursor.turn,key=turn+':'+snap.phaseId;
 turnPhases.set(key,(turnPhases.get(key)||0)+1);
 if(snap.phaseKind==='combat'){
  if(snap.combat.status==='air-sea-open')step({type:'combat',action:{type:'finish-air-sea'}});
  else if(snap.combat.status==='awaiting-declarations')step({type:'combat',action:{type:'commit-battles',battles:[]}});
  else if(['battles-resolved','no-battles-declared','complete'].includes(snap.combat.status))step({type:'combat',action:{type:'finish-combat'}});
  else throw Error('Unexpected combat state '+snap.combat.status+' '+key);
 }else if(snap.phaseKind==='buildup'){
  const due=plan[turn]?.filter(([slot])=>{
   const r=context.buildupPolicy.reinforcements.find(x=>x.slotId===slot);return r.owner===snap.actor;
  })||[];
  const slots=context.buildupPolicy.reinforcements.filter(x=>x.owner===snap.actor&&x.turn===turn&&x.kind==='ground');
  eq(due.map(x=>x[0]),slots.map(x=>x.slotId),'Exactly source-ground scheduled slots at '+key);
  for(const [slot,id] of due){
   const r=context.buildupPolicy.reinforcements.find(x=>x.slotId===slot);
   fail(()=>s.execute({type:'place-reinforcement',slotId:slot,hex:r.owner==='german'?'1914':'0101'}),
    /illegal reinforcement|overstack|national/i,'Wrong-country entry rejected '+slot);
   let picked=null;
   for(const hex of context.buildupPolicy.entryEdge[snap.actor]){
    try{s.execute({type:'place-reinforcement',slotId:slot,hex});picked=hex;break;}catch(_e){}
   }
   ok(picked,'Source legal candidate exists for '+slot+' on Turn '+turn);
   const discovered=Human.create({session:s,context}).view().commands;
   ok(discovered.some(x=>x.type==='place-reinforcement'&&x.slotId===slot&&x.hex===picked),
    'Human action catalog actually exposes legal source counter '+slot);
   const before=s.snapshot();
   step({type:'place-reinforcement',slotId:slot,hex:picked});
   const after=s.snapshot();
   eq(after.state.units[id].hex,picked,'Real counter '+id+' entered source edge '+picked);
   eq(after.state.units[id].sourceFaceId,id,'Original photographed counter identity '+slot);
   eq(after.state.units[id].nationality,r.nationality,'Printed nationality '+slot);
   fail(()=>s.execute({type:'place-reinforcement',slotId:slot,hex:picked}),/already admitted/i,'Cannot reuse scheduled slot '+slot);
   const saved=s.save();eq(Campaign.restore(saved,context).snapshot(),after,'Replay after '+slot);
   const undone=s.undo();ok(undone.ok,'Journal undo '+slot);
   eq(undone.session.snapshot(),before,'Atomic undo '+slot);
   arrivals.push({turn,slot,hex:picked,id});
  }
  const next=step({type:'finish-buildup'});
  eq(next.lastEvent.lostGroundSlotIds,[],'All due ground reinforcements admitted at '+key);
 }else if(snap.phaseKind==='housekeeping'){
  phaseEvents.push({turn,control:structuredClone(snap.state.cityControl)});
  step({type:'finish-housekeeping'});
 }else step({type:'finish-phase'});
 actions++;
}
const final=s.snapshot();
eq(final.cursor.complete,true,'Seven-turn contested campaign terminates');
eq(phaseEvents.map(x=>x.turn),[1,2,3,4,5,6,7],'Every housekeeping reached');
eq(arrivals.map(x=>x.slot),['t2-slovak','t2-hungarian','t3-german-infantry',
 't3-italian-motorized','t5-soviet-army','t6-soviet-army'],'All six source scheduled units admitted');
eq(Object.keys(final.state.units).length,42,'36 initial + 6 real arrived ground units (no phantom extras)');
for(let turn=1;turn<=7;turn++)for(const p of context.config.phases){
 if(turn===1&&['german-buildup','german-movement'].includes(p.id))continue;
 ok(turnPhases.has(turn+':'+p.id),'Real phase reached '+turn+':'+p.id);
}
for(const item of arrivals)eq(final.state.units[item.id].hex,item.hex,'Counter persists through endgame '+item.slot);
const finalSave=s.save();
eq(Campaign.restore(finalSave,context).snapshot(),final,'Full contested campaign source-authenticated replay');
const undo=s.undo();ok(undo.ok,'Terminal undo');eq(undo.session.snapshot().cursor.complete,false,'Undo returns to Turn 7 housekeeping');
ok(Boolean(final.terminal)&&typeof final.terminal.outcome==='string','Real source terminal evaluation exists');
if(process.env.ODESSA_V537_SAVE_OUT){
 const fs=require('node:fs'),path=require('node:path');
 const destination=path.resolve(process.env.ODESSA_V537_SAVE_OUT);
 fs.mkdirSync(path.dirname(destination),{recursive:true});
 fs.writeFileSync(destination,JSON.stringify(Human.create({session:s,context}).save(),null,2)+'\n');
 eq(Campaign.restore(require(destination).campaign,context).snapshot(),final,'Exported source-bound full human campaign save replays');
}
console.log('PASS v544 Odessa original 49 Mtn selected as Turn 3 source face and seven-turn contested integration',n,'assertions;',actions,'loop actions;',arrivals.length,'arrivals');
