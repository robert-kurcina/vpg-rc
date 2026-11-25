'use strict';
/* Checkpoint 311: fully source-backed mixed+face-selected seven-turn journal.
 * Browser consumes the actual signed Save/Restore envelope at selected turns.
 * No synthetic state edits, overrides of legality, or scenario-specific engine.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const req=name=>require('../'+name);
const hash=req('core/sync_sha256');
const Editor=req('core/historical_source_setup_editor');
const Campaign=req('core/historical_campaign_session');
const Human=req('core/historical_campaign_human');
const source={opening:req('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart,
 policy:req('games/kiev-odessa/experimental-preview/setup-policy-v534.json'),
 map:req('maps/kiev-odessa-composite-experimental-v531.json'),
 counterConfig:req('maps/counter-configs/kiev-odessa-experimental-v531.json'),
 buildupAllocation:req('games/kiev-odessa/experimental-preview/allocation-v533.json')};
const v544Selected='kiev-front-r02c06',originalReserve='kiev-front-r01c07';
const base=Editor.create(source),initial=base.snapshot(),order=[...initial.concealedSlots.slice(3),...initial.concealedSlots.slice(0,3)];
const editor=base.selectInfantryReserve(v544Selected).mixConcealed(order);
const initialView=editor.snapshot(),opening=editor.commit();
const context={...structuredClone(opening),map:source.map,
 profile:req('maps/movement-configs/kiev-odessa-experimental-v531.json'),
 config:req('maps/phase-configs/kiev-odessa.json'),counterConfig:source.counterConfig,
 combatPolicy:req('maps/combat-configs/kiev-odessa-experimental-v531.json'),
 rosterOverlay:req('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,
 buildupPolicy:req('maps/buildup-configs/kiev-odessa-experimental-v533.json'),
 buildupAllocation:editor.selectedAllocation(),
 housekeepingPolicy:req('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
let n=0;const ok=(a,label)=>{assert.ok(a,label);n++};
const eq=(a,b,label)=>{assert.deepStrictEqual(a,b,label);n++};
const nope=(f,re,label)=>{assert.throws(f,re,label);n++};
const physical=Object.fromEntries(initial.concealedSlots.map((slot,i)=>[slot,order[i]]));
eq(initialView.identityAssignments,physical,'Non-identity permutation of the original ten photos');
eq(new Set(Object.values(physical)).size,10,'Concealed physical identities remain unique');
ok(initialView.concealedMixed,'Exact setup editor mixed the original physical face assignments');
ok(initialView.infantryFaceSelection.reserveFaceId===v544Selected,'49 Mtn held for Turn 3');
ok(opening.state.units[originalReserve]&& !opening.state.units[v544Selected],'29 joins original starting positions and 49 Mtn held in reserve');
for(const [slot,id] of Object.entries(physical)){
 eq(opening.state.units[id].hex,initialView.placements[slot],'Mixed source identity at legal source start '+id);
 eq(opening.state.units[id].strengthStatus,'untried','Actual untried source face remains untried '+id);
}
const outDir=path.resolve(__dirname,'../rules/audit/saves');fs.mkdirSync(outDir,{recursive:true});
const artifacts={};
let session=Campaign.create(context);
function signedCustom(){
 const payload={format:'historical-custom-campaign',version:1,deployment:editor.save(),human:Human.create({session,context}).save()};
 return {...payload,integrity:{algorithm:'SHA-256',digest:hash.sha256(JSON.stringify(payload))}};
}
function save(label){
 const v=signedCustom();artifacts[label]=v;
 const file=path.join(outDir,'odessa-mixed-selected-'+label+'-v545.json');
 fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n');
 eq(Human.restore(v.human,context).snapshot(),session.snapshot(),'Saved human session authentic '+label);
 eq(Campaign.restore(v.human.campaign,context).snapshot(),session.snapshot(),'Replay journal authentic '+label);
 return file;
}
const step=a=>{session=session.execute(a).session;return session.snapshot()};
save('turn1-opening');
let human=Human.create({session,context}).choose({type:'combat',action:{type:'finish-air-sea'}});
const battle=human.view().proposals.find(b=>b.defenderHex==='0205'&&b.attackers.join(',')==='kiev-front-r01c01,kiev-front-r01c03');
ok(battle,'Actual source-approved two-Panzer contested battle available');
human=human.choose({type:'combat',action:{type:'commit-battles',battles:[battle]}})
 .choose({type:'combat',action:{type:'select-battle',defenderHex:'0205'}})
 .choose({type:'combat',action:{type:'commit-ground-air',faceId:'kiev-front-r03c01'}}).roll(3);
eq(human.view().crtOutcome,'EX','B4M CRT common Exchange');
human=human.choose(human.view().options[0]);
session=Campaign.restore(human.save().campaign,context);
ok(session.snapshot().state.units['kiev-front-r01c01'].strengthStatus==='printed-reduced','Real original Panzer reduced');
save('post-exchange');
const plan={2:[['t2-slovak','kiev-front-r02c07'],['t2-hungarian','kiev-front-r04c08']],
 3:[['t3-german-infantry',v544Selected],['t3-italian-motorized','kiev-front-r04c01']],
 5:[['t5-soviet-army','kiev-front-r04c05']],6:[['t6-soviet-army','kiev-front-r04c06']]};
const arrivals=[],housekeeping=[],controlSnapshots=[];let count=0,steps=0;
while(!session.snapshot().cursor.complete&&count++<180){
 const snap=session.snapshot(),turn=snap.cursor.turn,phase=snap.phaseKind;
 if(turn===3&&snap.phaseId==='german-buildup'&&!artifacts['turn3-pre-arrivals'])save('turn3-pre-arrivals');
 if(turn===6&&snap.phaseId==='soviet-buildup'&&!artifacts['turn6-pre-arrival'])save('turn6-pre-arrival');
 if(phase==='combat'){
  if(snap.combat.status==='air-sea-open')step({type:'combat',action:{type:'finish-air-sea'}});
  else if(snap.combat.status==='awaiting-declarations')step({type:'combat',action:{type:'commit-battles',battles:[]}});
  else if(['battles-resolved','no-battles-declared','complete'].includes(snap.combat.status))step({type:'combat',action:{type:'finish-combat'}});
  else throw Error('Unexpected combat status '+snap.combat.status+' on '+snap.phaseId);
 }else if(phase==='buildup'){
  for(const [slot,id] of plan[turn]||[]){
   const policy=context.buildupPolicy.reinforcements.find(x=>x.slotId===slot);
   if(policy.owner!==snap.actor)continue;
   let chosen;
   for(const hex of context.buildupPolicy.entryEdge[snap.actor]){
    try{session.execute({type:'place-reinforcement',slotId:slot,hex});chosen=hex;break;}catch{}
   }
   ok(chosen,'Ordinary source-authorized entry found for '+slot);
   const before=session.snapshot();
   const after=step({type:'place-reinforcement',slotId:slot,hex:chosen});
   eq(after.state.units[id].hex,chosen,'Expected source identity '+slot+' legally deployed');
   eq(after.state.units[id].sourceFaceId,id,'Printed source face retained '+slot);
   nope(()=>session.execute({type:'place-reinforcement',slotId:slot,hex:chosen}),/already admitted/i,'No duplicate reinforcements '+slot);
   const undo=session.undo();ok(undo.ok,'Source journal undo '+slot);eq(undo.session.snapshot(),before,'Undo original source event '+slot);
   arrivals.push({turn,slot,id,hex:chosen});
  }
  step({type:'finish-buildup'});
 }else if(phase==='housekeeping'){
  housekeeping.push(turn);controlSnapshots.push(structuredClone(snap.state.cityControl));
  step({type:'finish-housekeeping'});
 }else step({type:'finish-phase'});
 steps++;
}
const terminal=session.snapshot();
ok(terminal.cursor.complete,'Full seven-turn campaign terminates with mixed face selection');
eq(housekeeping,[1,2,3,4,5,6,7],'All seven historical housekeeping transitions run');
eq(arrivals.map(a=>a.slot),['t2-slovak','t2-hungarian','t3-german-infantry','t3-italian-motorized','t5-soviet-army','t6-soviet-army'],'All scheduled source arrivals');
eq(Object.keys(terminal.state.units).length,42,'Exactly original 36 and six reinforcement identities on map');
for(const entry of arrivals)eq(terminal.state.units[entry.id].hex,entry.hex,'Scheduled counter persists to terminal '+entry.slot);
eq(terminal.state.units[v544Selected].sourceFaceId,v544Selected,'Real 49 Mountain physical face remains active');
for(const id of Object.values(physical))ok(terminal.state.units[id]?.sourceFaceId===id,'Every mixed physical identity survived source replay '+id);
let all=[...Object.values(terminal.state.units)].map(u=>u.sourceFaceId);
eq(new Set(all).size,42,'Original counter face allocation remains one-to-one after seven turns');
ok(typeof terminal.terminal?.outcome==='string','Original terminal city scoring available');
save('terminal');
ok(session.undo().ok,'Terminal bookkeeping is undoable');
const report={checkpoint:311,version:'v545',status:'PASS',scope:'Node seven-turn contested journal, browser-stage replay groundwork',
 assertions:n,mixedConcealedIdentities:10,mixedPhysicalFaceAssignments:physical,reservedGermanFace:v544Selected,
 reinforcements:arrivals,housekeeping,steps,finalStateHash:artifacts.terminal.human.campaign.finalStateHash,
 savedStages:Object.keys(artifacts),historicalCertification:false,
 limitations:['Naval evacuation phase not source authorized','Source topology and Romania territorial authority remain experimental']};
fs.writeFileSync(path.resolve(__dirname,'../rules/audit/odessa-mixed-selected-seven-turn-v545.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS v545 mixed+face selected seven-turn source journal:',n,'assertions;',steps,'phase actions;',arrivals.length,'reinforcements;',Object.keys(artifacts).length,'real save stages');
