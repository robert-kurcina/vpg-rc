'use strict';
/* v541: A real contested Kiev–Odessa campaign crosses the original map seam,
 * then takes the original Chisinau city using the source-pinned shared game.
 * This does not certify the still-experimental composite movement graph. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const req=p=>require('../'+p);
const Campaign=req('core/historical_campaign_session');
const Human=req('core/historical_campaign_human');
const Audit=req('core/composite_graph_audit');
const Compose=req('maps/composer');
const origin=req('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const context={...structuredClone(origin),map:req('maps/kiev-odessa-composite-experimental-v531.json'),
 profile:req('maps/movement-configs/kiev-odessa-experimental-v531.json'),config:req('maps/phase-configs/kiev-odessa.json'),
 counterConfig:req('maps/counter-configs/kiev-odessa-experimental-v531.json'),
 combatPolicy:req('maps/combat-configs/kiev-odessa-experimental-v531.json'),
 rosterOverlay:req('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,
 buildupPolicy:req('maps/buildup-configs/kiev-odessa-experimental-v533.json'),
 buildupAllocation:req('games/kiev-odessa/experimental-preview/allocation-v533.json'),
 housekeepingPolicy:req('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
const id='kiev-odessa/romanian-cavalry-corps';
let checks=0;
function eq(actual,expected,label){assert.deepStrictEqual(actual,expected,label);checks++}
function yes(value,label){assert.ok(value,label);checks++}
function fails(fn,re,label){assert.throws(fn,re,label);checks++}
const base=req('maps/kiev.json'),ext=req('maps/odessa-extension.json');
const seam=Audit.audit(base,ext,Compose.compose(base,ext)).seams;
yes(seam.some(e=>e.baseHex==='1010'&&e.extensionHex==='1011'),
 '1010/1011 is an actual base/expansion seam rather than an ordinary in-map move');
let s=Campaign.create(context),snap=()=>s.snapshot(),advance=action=>(s=s.execute(action).session,snap());
function saveUndoReplay(label){
 const before=snap(),copy=Campaign.restore(s.save(),context);eq(copy.snapshot(),before,label+' saved replay');
 const undone=s.undo();yes(undone.ok,label+' is undoable');
 const last=s.save().journal.at(-1).action;
 eq(undone.session.execute(last).session.snapshot(),before,label+' replay after Undo');
}
eq(snap().state.units[id].hex,'1010','Romanian cavalry opens on source hex');
eq(snap().state.cityControl.Chisinau,'soviet','Chisinau starts Soviet-controlled');
// Standard original first combat is real, not an artificial enemy deletion.
let human=Human.create({session:s,context});
human=human.choose({type:'combat',action:{type:'finish-air-sea'}});
const battle=human.view().proposals.find(x=>x.defenderHex==='0205'&&x.attackers.join(',')==='kiev-front-r01c01,kiev-front-r01c03');
yes(battle,'Original source-legal 0205 battle is available');
human=human.choose({type:'combat',action:{type:'commit-battles',battles:[battle]}})
 .choose({type:'combat',action:{type:'select-battle',defenderHex:'0205'}})
 .choose({type:'combat',action:{type:'commit-ground-air',faceId:'kiev-front-r03c01'}}).roll(3);
eq(human.view().crtOutcome,'EX','Common B4M CRT resolves a real EX');
human=human.choose(human.view().options[0]);
s=Campaign.restore(human.save().campaign,context);
eq(snap().state.units['kiev-front-r01c01'].strengthStatus,'printed-reduced','Actual battle causes a Panzer loss');
const movePlan={1:{phase:'german-special-movement',path:['1010','1011']},
 2:{phase:'german-movement',path:['1011','1112']},
 3:{phase:'german-movement',path:['1112','1211']}};
const scheduled={2:{german:[['t2-slovak','0101'],['t2-hungarian','0201']]},
 3:{german:[['t3-german-infantry','0102'],['t3-italian-motorized','0102']]}};
let loops=0,steps=0,housekeepings=[],movements=[];
while(loops++<95){
 const state=snap(),turn=state.cursor.turn,kind=state.phaseKind;
 if(turn===3&&state.phaseId==='german-combat'&&movements.length===3)break;
 if(state.cursor.complete)throw Error('Campaign unexpectedly completed before Chisinau capture');
 const planned=movePlan[turn];
 if(planned&&state.phaseId===planned.phase&&movements.length===turn-1){
  const reqMove={type:'declare-ground-move',request:{unitId:id,path:planned.path}};
  if(process.env.ODESSA_V541_SAVE_DIR){
   const file=path.resolve(process.env.ODESSA_V541_SAVE_DIR,'odessa-pre-movement-turn'+turn+'-v541.json');
   fs.mkdirSync(path.dirname(file),{recursive:true});
   fs.writeFileSync(file,JSON.stringify(Human.create({session:s,context}).save(),null,2)+'\n');
  }
  const view=Human.create({session:s,context}).view();
  yes(view.commands.some(a=>JSON.stringify(a)===JSON.stringify(reqMove)),
   'Exact seam/city route is offered in authoritative human command catalog on Turn '+turn);
  fails(()=>s.execute({type:'declare-ground-move',request:{unitId:id,path:[planned.path[0],'9999']}}),
   /illegal|invalid|path|move|unreachable/i,'Forged off-map movement rejected on Turn '+turn);
  const pre=snap(),cityBefore=pre.state.cityControl.Chisinau;
  advance(reqMove);
  eq(snap().state.units[id].hex,planned.path[0],
   'Move declaration does not teleport cavalry before resolution');
  eq(snap().state.cityControl.Chisinau,cityBefore,'Declaration does not capture city');
  saveUndoReplay('Pending turn '+turn+' move');
  advance({type:'resolve-ground-move'});
  eq(snap().state.units[id].hex,planned.path.at(-1),'Turn '+turn+' destination committed');
  const owner=turn===3?'german':'soviet';
  eq(snap().state.cityControl.Chisinau,owner,'Only entering the real city changes control on Turn '+turn);
  saveUndoReplay('Resolved turn '+turn+' move');
  movements.push({turn,path:planned.path,cityControl:snap().state.cityControl.Chisinau});
 }
 const phase=snap();
 if(phase.phaseKind==='combat'){
  const status=phase.combat?.status;
  if(status==='air-sea-open')advance({type:'combat',action:{type:'finish-air-sea'}});
  else if(status==='awaiting-declarations')advance({type:'combat',action:{type:'commit-battles',battles:[]}});
  else if(['battles-resolved','no-battles-declared','complete'].includes(status))advance({type:'combat',action:{type:'finish-combat'}});
  else throw Error('Unexpected combat state '+status);
 }else if(phase.phaseKind==='buildup'){
  for(const [slot,hex] of scheduled[phase.cursor.turn]?.[phase.actor]||[]){
   advance({type:'place-reinforcement',slotId:slot,hex});
   yes(snap().lastEvent?.slotId===slot || Object.values(snap().state.units).some(u=>u.arrivedBySlot===slot), 'Real scheduled reinforcement admitted '+slot);
  }
  advance({type:'finish-buildup'});
 }else if(phase.phaseKind==='housekeeping'){
  housekeepings.push(phase.cursor.turn);
  advance({type:'finish-housekeeping'});
 }else advance({type:'finish-phase'});
 steps++;
}
eq(movements.map(x=>x.path),[['1010','1011'],['1011','1112'],['1112','1211']],
 'All three actual source-legal movement paths executed');
eq(housekeepings,[1,2],'Two complete intermediate historical turns, with no phase bypass');
eq(snap().state.cityControl.Chisinau,'german','Chisinau captured through actual movement');
eq(snap().state.units[id].sourceFaceId,'odessa-front-r01c08','Original cavalry face maintained throughout');
eq(snap().state.units[id].strengthStatus,'printed-reduced','Reduced cavalry source status preserved');
eq(snap().state.units['kiev-front-r01c01'].strengthStatus,'printed-reduced','Turn 1 combat casualty still present');
const complete=s.save();
eq(Campaign.restore(complete,context).snapshot(),snap(),'City captured after full source replay');
const replay=Human.restore(Human.create({session:s,context}).save(),context);
eq(replay.snapshot().state.cityControl.Chisinau,'german','Human save restores captured city');
console.log('PASS v541 Odessa contested seam + Chisinau campaign',checks,'assertions;',steps,'phase steps');
