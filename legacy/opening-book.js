/* Data-driven Battle for Moscow opening configurations. No rule alterations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B4MOpeningBook=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const E=typeof B4MEngine!=='undefined'?B4MEngine:require('./engine.js');
const localData=typeof B4M_OPENINGS!=='undefined'?B4M_OPENINGS:(typeof require==='function'?require('./data/opening_book.json'):null);
const ids=(side)=>localData[side].map(p=>p.id);
const familyLeads=()=>localData.german.filter(p=>p.variant===0).map(p=>p.id);
const get=(side,id)=>{const p=localData[side].find(p=>p.id===id);if(!p)throw new Error('Unknown '+side+' opening: '+id);return p;};
const initialSovietPositions=sc=>sc.raw.units.filter(u=>u.army==='soviet').map(u=>[u.id,u.position?`${u.position.x},${u.position.y}`:null]);
function legacyDeployment(c,id){const cfg=get('german',id),starts=c.raw.hexes.filter(h=>h.germanStart),tanks=c.raw.units.filter(u=>u.army==='german'&&u.type==='tank').slice().sort((a,b)=>b.combatFull-a.combatFull||a.id.localeCompare(b.id)),inf=c.raw.units.filter(u=>u.army==='german'&&u.type!=='tank').slice().sort((a,b)=>b.combatFull-a.combatFull||a.id.localeCompare(b.id));
const inOrder=(a,b)=>b.x-a.x||a.y-b.y;
const front=starts.slice().sort(inOrder);
const proximity=(h,x,y)=>E.dist(h.x,h.y,x,y);
let tankSlots;
if(cfg.setup==='balanced')tankSlots=front.slice().sort((a,b)=>Math.abs(a.y-5)-Math.abs(b.y-5)||b.x-a.x).slice(0,8);
else if(cfg.setup==='south-tanks')tankSlots=front.slice().sort((a,b)=>Math.abs(a.y-8)-Math.abs(b.y-8)||b.x-a.x).slice(0,8);
else if(cfg.setup==='south-front')tankSlots=front.slice().sort((a,b)=>Math.abs(a.y-7)-Math.abs(b.y-7)||b.x-a.x).slice(0,8);
else if(cfg.setup==='center-tanks')tankSlots=front.slice().sort((a,b)=>Math.abs(a.y-5)-Math.abs(b.y-5)||b.x-a.x).slice(0,8);
else if(cfg.setup==='split-tanks'){
 const north=front.slice().sort((a,b)=>Math.abs(a.y-2)-Math.abs(b.y-2)||b.x-a.x).slice(0,4),seen=new Set(north.map(h=>`${h.x},${h.y}`));
 const south=front.filter(h=>!seen.has(`${h.x},${h.y}`)).sort((a,b)=>Math.abs(a.y-9)-Math.abs(b.y-9)||b.x-a.x).slice(0,4);
 tankSlots=[...north,...south];
}else throw new Error('Unknown setup '+cfg.setup);
// Balanced and central must still have different assignments: balanced alternates strong infantry on the central salient.
if(cfg.setup==='balanced')tankSlots=front.slice().sort((a,b)=>Math.abs(a.y-3)-Math.abs(b.y-3)||b.x-a.x).slice(0,8);
let selected=new Set(tankSlots.map(h=>`${h.x},${h.y}`));if(selected.size!==8)throw new Error('Non-unique panzer setup');
let other=front.filter(h=>!selected.has(`${h.x},${h.y}`)).sort((a,b)=>b.x-a.x||Math.abs(a.y-5)-Math.abs(b.y-5));
if(other.length!==14)throw new Error('Wrong infantry starting slots');
// Within each formation, the stronger counters occupy forward crossing or breakthrough slots.
let sortedTanks=tankSlots.slice();
if(cfg.setup==='split-tanks')sortedTanks=[...tankSlots.slice(0,4).sort(inOrder),...tankSlots.slice(4).sort(inOrder)];
else sortedTanks.sort(inOrder);
return [...tanks.map((u,i)=>({id:u.id,x:sortedTanks[i].x,y:sortedTanks[i].y})),...inf.map((u,i)=>({id:u.id,x:other[i].x,y:other[i].y}))];
}
// Opening v1.2: preserve G1..G5 original deployments; new configurations are
// deterministic, legal arrangements of exactly the same 22 counters.
// deploymentSeed is independent of the seeded combat RNG, and 0 means default.
function germanDeployment(c,id,deploymentSeed=0){
 const config=get('german',id);
 if(config.legacy&&Number(deploymentSeed)===0)return legacyDeployment(c,id);
 const starts=c.raw.hexes.filter(h=>h.germanStart);
 const allTank=c.raw.units.filter(u=>u.army==='german'&&u.type==='tank')
   .sort((a,b)=>b.combatFull-a.combatFull||a.id.localeCompare(b.id));
 const infantry=c.raw.units.filter(u=>u.army==='german'&&u.type!=='tank')
   .sort((a,b)=>b.combatFull-a.combatFull||a.id.localeCompare(b.id));
 const f=Number(config.family.slice(1)),v=config.variant|0;
 const seeds=Number(deploymentSeed)>>>0;
 // Stable, bounded perturbation; does not alter combat dice or board topology.
 const jitter=(h)=>{
  if(!seeds)return 0;
  let q=(Math.imul(h.x+19,2654435761)^Math.imul(h.y+23,2246822519)^seeds)>>>0;
  q^=q>>>16;q=Math.imul(q,2246822519)>>>0;q^=q>>>13;
  return (q%1000)/1000-0.5;
 };
 const targetYs={1:[3,5,4,6],2:[8,9,7,10],3:[2,3,2,4],4:[5,4,6,5],5:[7,8,6,9],6:[2,1,3,4],7:[7,5,8,6],8:[7,6,5,8]};
 const frontWeight=f===7?-4.2:f===8?-0.8:([1,3,4].includes(f)?2.1:3.5);
 const rank=(h,goal,fw=frontWeight)=>-Math.abs(h.y-goal)*5+fw*h.x+jitter(h)*12;
 const best=(choices,count,goal,fw=frontWeight)=>choices.slice().sort((a,b)=>rank(b,goal,fw)-rank(a,goal,fw)||a.y-b.y||a.x-b.x).slice(0,count);
 let tankSlots;
 if(f===3){
   let n=[4,3,5,2][v];let north=best(starts,n,[2,2,1,3][v],3.2),used=new Set(north.map(h=>`${h.x},${h.y}`));
   tankSlots=[...north,...best(starts.filter(h=>!used.has(`${h.x},${h.y}`)),8-n,9,3.2)];
 }else if(f===8){
   let lead=best(starts,4,[9,8,10,7][v],3.4),used=new Set(lead.map(h=>`${h.x},${h.y}`));
   tankSlots=[...lead,...best(starts.filter(h=>!used.has(`${h.x},${h.y}`)),4,3,-2.7)];
 }else tankSlots=best(starts,8,targetYs[f][v]);
 if(new Set(tankSlots.map(h=>`${h.x},${h.y}`)).size!==8)throw Error('Invalid tank slots '+id);
 let used=new Set(tankSlots.map(h=>`${h.x},${h.y}`));
 let others=starts.filter(h=>!used.has(`${h.x},${h.y}`));
 if(others.length!==14)throw Error('Wrong infantry slot count '+id);
 // Orderings intentionally emphasize different counter strength along the axis,
 // while keeping a setup independent of the combat-dice seed.
 let tankOrder=tankSlots.slice().sort((a,b)=>{
   if(f===8&&v%2===0)return b.x-a.x||b.y-a.y;
   if(v===1)return b.y-a.y||b.x-a.x;
   if(v===2)return a.y-b.y||b.x-a.x;
   return b.x-a.x||a.y-b.y;
 });
 others.sort((a,b)=>v===3?(b.y-a.y||b.x-a.x):(b.x-a.x||Math.abs(a.y-5)-Math.abs(b.y-5)));
 if(f===5 && v>=2){let tmp=tankOrder[1];tankOrder[1]=tankOrder[5];tankOrder[5]=tmp;}
 if(v===3){let tmp=tankOrder[0];tankOrder[0]=tankOrder[3];tankOrder[3]=tmp;}
 return [...allTank.map((u,i)=>({id:u.id,x:tankOrder[i].x,y:tankOrder[i].y})),
         ...infantry.map((u,i)=>({id:u.id,x:others[i].x,y:others[i].y}))];
}
function setup(c,id,seed=1,deploymentSeed=0){let s=E.makeState(c,seed,'manual');for(const p of germanDeployment(c,id,deploymentSeed))if(!E.setupPlace(c,s,p.id,p.x,p.y))throw new Error('Illegal preset placement '+p.id);if(!E.finishSetup(c,s))throw new Error('Invalid German starting configuration '+id);E.validate(c,s);s.log.push({t:1,side:'german',type:'opening',id,name:get('german',id).name});return s;}
function selectedPolicy(s,config){return config.schedule[Math.max(0,Math.min(6,s.turn-1))];}
function play(c,base,germanId='G1',sovietId='S2',onDecision){const side=base.side,config=get(side,side==='german'?germanId:sovietId);let policy=selectedPolicy(base,config);let next=E.playSide(c,base,policy);E.validate(c,next);next.log.push({t:base.turn,side,type:'opening-policy',opening:config.id,policy});if(typeof onDecision==='function')onDecision({turn:base.turn,side,opening:config.id,policy});return next;}
function run(c,seed,germanId='G1',sovietId='S2',onTurn,deploymentSeed=0){let s=setup(c,germanId,seed,deploymentSeed);let started=Date.now();while(!s.over&&s.ply<14){let before=s,policy=selectedPolicy(before,get(before.side,before.side==='german'?germanId:sovietId));s=play(c,s,germanId,sovietId);if(typeof onTurn==='function')onTurn({seed,germanId,sovietId,turn:before.turn,side:before.side,policy,ply:s.ply});}return summary(c,s,{seed,germanId,sovietId,ms:Date.now()-started});}
function summary(c,s,details={}){return {...details,winner:s.winner,complete:s.over&&s.ply===14,ply:s.ply,moscowOwner:s.control['10,2'],moscowGarrison:E.occupant(s,10,2)?.id||null,germanCities:c.cities.filter(h=>s.control[`${h.x},${h.y}`]==='german').length,germanCF:E.units(s,'german').reduce((n,u)=>n+E.strength(u),0),sovietCF:E.units(s,'soviet').reduce((n,u)=>n+E.strength(u),0),germanDenied:E.sweepMetrics(c,s).germanDenied,combatCount:s.log.filter(l=>l.type==='combat').length};}
// Optional deviation from the initial book. These are disclosed tactical triggers,
// not learned strategy, and are not used in the fixed-policy pilot matrix.
function deviation(c,s,germanId='G1',sovietId='S2'){
 const side=s.side,config=get(side,side==='german'?germanId:sovietId);
 let policy=selectedPolicy(s,config),reason='scheduled';
 const m=c.profile.victory.moscow,holder=E.occupant(s,...m);
 if(side==='soviet'){
  const close=E.units(s,'german').filter(u=>E.dist(u.position.x,u.position.y,...m)<=2).length;
  if(s.control['10,2']!=='soviet'||!holder||holder.army!=='soviet'||close>=3){policy='fortress';reason='capital emergency';}
  else if(sovietId==='S5'&&E.sweepMetrics(c,s).germanDenied>=7&&s.turn<=4){policy='counter';reason='eastern screen counterattack';}
 }else{
  const metrics=E.sweepMetrics(c,s),near=metrics.tanksNearMoscow;
  if(s.control['10,2']==='german'){policy='conserve';reason='protect occupied Moscow';}
  else if(germanId==='G2'&&s.turn>=3&&(metrics.germanDenied>=10||near>=3)){policy='envelop';reason='screen sufficiently established; pivot to Moscow';}
  else if(germanId==='G3'&&s.turn>=3&&near>=2){policy='envelop';reason='encirclement forces assembled';}
  else if(germanId==='G4'&&s.turn>=4&&near>=3){policy='envelop';reason='center breach enables Moscow assault';}
 }
 return {policy,reason,opening:config.id};
}
function playFlexible(c,base,germanId='G1',sovietId='S2'){
 const {policy,reason,opening}=deviation(c,base,germanId,sovietId),next=E.playSide(c,base,policy);
 E.validate(c,next);
 next.log.push({t:base.turn,side:base.side,type:'opening-policy',opening,policy,reason,adaptive:true});
 return next;
}
// Cheap book-level opponent response: rank candidate opening pairs after one
// German and one Soviet side turn. This is NOT equivalent to optimal-game win odds.
function previewPair(c,seed,gId,sId,deploymentSeed=0){let s=setup(c,gId,seed,deploymentSeed);s=play(c,s,gId,sId);s=play(c,s,gId,sId);return {germanId:gId,sovietId:sId,score:E.strategicValue(c,s,'german'),moscow:s.control['10,2'],sovietGarrison:E.occupant(s,10,2)?.id||null,ply:s.ply};}
// Two-side-turn maximin over five opening families. Optimizes static evaluation,
// not estimated final victory probability; equal scores broken by stable ID.
function recommend(c,seed=1){const rows=[];
 for(const g of familyLeads()){const first=play(c,setup(c,g,seed),g,'S1');for(const sov of ids('soviet')){const s=play(c,first,g,sov);rows.push({germanId:g,sovietId:sov,score:E.strategicValue(c,s,'german'),moscow:s.control['10,2'],sovietGarrison:E.occupant(s,10,2)?.id||null,ply:s.ply});}}
 const candidates=familyLeads().map(g=>{const vs=rows.filter(r=>r.germanId===g).sort((a,b)=>a.score-b.score||a.sovietId.localeCompare(b.sovietId));return {germanId:g,worstResponse:vs[0].sovietId,worstScore:vs[0].score,meanScore:vs.reduce((t,r)=>t+r.score,0)/vs.length};});
 candidates.sort((a,b)=>b.worstScore-a.worstScore||b.meanScore-a.meanScore||a.germanId.localeCompare(b.germanId));
 return {recommended:candidates[0],candidates,rows,depth:'one German + one Soviet side-turn',evaluation:'static board evaluation, not calibrated win rate'};
}
return {ids,familyLeads,get,germanDeployment,setup,selectedPolicy,deviation,play,playFlexible,run,summary,previewPair,recommend,initialSovietPositions,data:localData};
});
