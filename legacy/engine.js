/* Battle for Moscow independent scenario engine. Historical data and art supplied by user.
   Oberlabs canonical profile: mud infantry unaffected, tanks halved, 4 Soviet replacements. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B4MEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const H=typeof Honeycomb!=='undefined'?Honeycomb:(typeof require==='function'?require('./assets/honeycomb.min.js'):null);
const Hex=H.extendHex({size:{width:114.55,height:101.9},orientation:'flat',offset:1});
const Grid=H.defineGrid(Hex);const geom=Grid.rectangle({width:14,height:11,start:[0,0],direction:1});
const DIR=['SE','S','SW','NW','N','NE'];const OPP=['NW','N','NE','SE','S','SW'];
const clone=x=>JSON.parse(JSON.stringify(x));const key=(x,y)=>`${x},${y}`;
function buildScenario(raw,profile){let sc=clone(raw);sc.hexes.forEach(h=>{if(h.city==='nornal')h.city='normal';});const hex=new Map(sc.hexes.map(h=>[key(h.x,h.y),h]));let neighbors=new Map();for(const h of sc.hexes){let ns=geom.neighborsOf(geom.get([h.x,h.y]));neighbors.set(key(h.x,h.y),ns.map((n,i)=>n&&hex.has(key(n.x,n.y))?{x:n.x,y:n.y,dir:DIR[i],opposite:OPP[i]}:null).filter(Boolean));}return {raw:sc,hex,neighbors,profile:clone(profile),cities:sc.hexes.filter(h=>h.city&&h.city!=='none'&&h.city!=='nornal'?true:h.city==='nornal')};}
function hexAt(c,x,y){return c.hex.get(key(x,y));}
function neighbours(c,x,y){return c.neighbors.get(key(x,y))||[];}
function pos(u){return !!u.position&&Number.isInteger(u.position.x);}
function occupant(s,x,y){return s.units.find(u=>pos(u)&&u.position.x===x&&u.position.y===y&&u.strength!=='dead')||null;}
function units(s,side){return s.units.filter(u=>u.army===side&&pos(u));}
function strength(u){return u.strength==='full'?u.combatFull:u.strength==='reduced'?u.combatReduced:0;}
function enemy(side){return side==='german'?'soviet':'german';}
function dist(x,y,a,b){let p=geom.get([x,y]),q=geom.get([a,b]);return p&&q?p.distance(q):99;}
function zoc(c,s,x,y,side){return neighbours(c,x,y).some(n=>occupant(s,n.x,n.y)?.army===enemy(side));}
function isMud(c,s){return c.profile.mudTurns.includes(s.turn);}
function makeState(c,seed=1,setup='automated'){let s={turn:1,side:'german',phase:'setup',units:clone(c.raw.units),control:{},seed:seed>>>0||1,over:false,winner:null,log:[],ply:0,scheduled:[],setupDone:false};for(let h of c.cities)s.control[key(h.x,h.y)]=h.control||'soviet';if(setup==='automated')autoSetup(c,s);return s;}
function rand(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function assignUnit(c,s,id,x,y){let u=s.units.find(v=>v.id===id);if(!u||!hexAt(c,x,y)||occupant(s,x,y))return false;u.position={x,y};claim(c,s,u);return true;}
// Manual opening: only designated 22 German crosses are legal; relocation swaps
// two German counters without changing the geometry or creating duplicate units.
function setupPlace(c,s,id,x,y){
 if(s.setupDone||s.phase!=='setup'||s.turn!==1||s.side!=='german')return false;
 const h=hexAt(c,x,y),u=s.units.find(v=>v.id===id);
 if(!h?.germanStart||!u||u.army!=='german'||u.strength!=='full')return false;
 const target=occupant(s,x,y);
 if(target&&target.army!=='german')return false;
 const old=pos(u)?{...u.position}:null;
 if(target&&target.id!==u.id){target.position=old;}
 u.position={x,y};
 // Setup control is the original ownership, plus currently occupied German cities.
 for(const city of c.cities)s.control[key(city.x,city.y)]=city.control||'soviet';
 for(const german of units(s,'german'))claim(c,s,german);
 return true;
}
function finishSetup(c,s){
 if(s.setupDone||s.phase!=='setup')return false;
 const starts=c.raw.hexes.filter(h=>h.germanStart);
 if(starts.length!==22||starts.some(h=>occupant(s,h.x,h.y)?.army!=='german')||units(s,'german').length!==22)return false;
 s.setupDone=true;s.phase='combat';s.log.push({t:1,side:'german',type:'setup',message:'Germany deployed all 22 units manually'});return true;
}
function autoSetup(c,s,doctrine='baseline'){let starts=c.raw.hexes.filter(h=>h.germanStart).sort((a,b)=>a.y-b.y||a.x-b.x),us=s.units.filter(u=>u.army==='german').sort((a,b)=>strength(b)-strength(a));if(starts.length!==us.length)throw Error('Setup count mismatch');let middle=starts.filter(h=>h.y>=3&&h.y<=7),top=starts.filter(h=>h.y<3),bottom=starts.filter(h=>h.y>7),priority=[...middle,...top,...bottom];
if(doctrine==='sweep'){
  let panzerHexes=starts.slice().sort((a,b)=>b.x-a.x||Math.abs(a.y-7)-Math.abs(b.y-7)).slice(0,8);
  let panzerIds=us.filter(u=>u.type==='tank').sort((a,b)=>strength(b)-strength(a));
  let other=us.filter(u=>u.type!=='tank');
  let rest=starts.filter(h=>!panzerHexes.some(p=>p.x===h.x&&p.y===h.y)).sort((a,b)=>b.x-a.x||Math.abs(a.y-5)-Math.abs(b.y-5));
  for(let i=0;i<panzerIds.length;i++) {panzerIds[i].position={x:panzerHexes[i].x,y:panzerHexes[i].y};claim(c,s,panzerIds[i]);}
  for(let i=0;i<other.length;i++) {other[i].position={x:rest[i].x,y:rest[i].y};claim(c,s,other[i]);}
}else us.forEach((u,i)=>{u.position={x:priority[i].x,y:priority[i].y};claim(c,s,u);});s.setupDone=true;s.phase='combat';s.log.push({t:1,side:'german',type:'setup',message:'Germany deployed all 22 units'});return s;}
function claim(c,s,u){let h=hexAt(c,u.position.x,u.position.y);if(h&&h.city&&h.city!=='none')s.control[key(h.x,h.y)]=u.army;}
function legalMoves(c,s,u,mode='normal'){if(!pos(u))return [];if(mode==='panzer'&&u.type!=='tank')return [];if(mode==='rail'&&u.army!=='soviet')return [];let start=hexAt(c,u.position.x,u.position.y);if(!start)return [];if(mode==='rail'&&!(start.rail||[]).length)return [];
let mud=isMud(c,s),limit=mode==='rail'?4:mud?1:u.movement;
let q=[{x:u.position.x,y:u.position.y,cost:0,path:[]}],best=new Map([[key(u.position.x,u.position.y),0]]),found=new Map();
while(q.length){q.sort((a,b)=>a.cost-b.cost);let a=q.shift();if(a.cost!==best.get(key(a.x,a.y)))continue;for(let n of neighbours(c,a.x,a.y)){
let h=hexAt(c,n.x,n.y),occupied=occupant(s,n.x,n.y);if(occupied&&occupied.army!==u.army)continue;
if(mode==='rail'){let origin=hexAt(c,a.x,a.y);if(!(origin.rail||[]).includes(n.dir))continue;}
let cost=a.cost+(mode==='rail'||mud?1:h.terrain==='forest'?2:1),k=key(n.x,n.y);
if(cost>limit||cost>=(best.get(k)??Infinity))continue;
// Rail may ENTER an enemy ZOC but cannot pass through it (Oberlabs getValidRailDestinations).
best.set(k,cost);let path=a.path.concat([{x:n.x,y:n.y}]);if(!occupied)found.set(k,{x:n.x,y:n.y,cost,path});
if(!zoc(c,s,n.x,n.y,u.army))q.push({x:n.x,y:n.y,cost,path});}}
return [...found.values()].sort((a,b)=>a.cost-b.cost||a.x-b.x||a.y-b.y);}
function move(c,s,id,x,y,mode='normal'){let u=s.units.find(u=>u.id===id);if(!u)return false;let options=legalMoves(c,s,u,mode);if(!options.some(p=>p.x===x&&p.y===y))return false;let from=clone(u.position);u.position={x,y};claim(c,s,u);s.log.push({t:s.turn,side:u.army,type:'move',mode,unit:id,from,to:{x,y}});return true;}
function communication(c,s,u){if(!pos(u))return false;let side=u.army,h=hexAt(c,u.position.x,u.position.y);if(side==='soviet'&&h.city==='moscow')return true;let todo=[{...u.position}],seen=new Set([key(u.position.x,u.position.y)]);while(todo.length){let a=todo.shift();let here=hexAt(c,a.x,a.y);if((side==='soviet'&&here.sovietReplacement)||(side==='german'&&here.germanReplacement))return true;
for(let n of neighbours(c,a.x,a.y)){let k=key(n.x,n.y);if(seen.has(k)||occupant(s,n.x,n.y)?.army===enemy(side)||zoc(c,s,n.x,n.y,side))continue;seen.add(k);todo.push({x:n.x,y:n.y});}}return false;}
function replacementBudget(c,s){if(s.side==='german')return s.turn===1?0:c.profile.germanReplacements;let v=c.profile.sovietReplacements;return isMud(c,s)?v.mud:v.normal;}
function enteredThisTurn(s,u){return s.log.some(ev=>ev.type==='replacement'&&ev.action==='enter'&&ev.unit===u.id&&ev.t===s.turn&&ev.side===u.army);}
function replacementOptions(c,s,side=s.side){let out=[];for(let u of s.units.filter(u=>u.army===side)){if(u.type==='shock'&&s.turn<=4)continue;if(pos(u)){if(u.strength==='reduced'&&!enteredThisTurn(s,u)&&communication(c,s,u))out.push({type:'restore',id:u.id});}else{
for(let h of c.raw.hexes){if(occupant(s,h.x,h.y))continue;let edge=side==='soviet'?h.sovietReplacement:h.germanReplacement;let city=h.city&&h.city!=='none'&&s.control[key(h.x,h.y)]===side;
if((edge&&!zoc(c,s,h.x,h.y,side))||city){if(city){let proxy={army:side,position:{x:h.x,y:h.y}};if(!communication(c,s,proxy))continue;}out.push({type:'enter',id:u.id,x:h.x,y:h.y});}}
}}return out;}
// Oberlabs turn-4 Soviet 1st Shock Army enters as a FREE, full-strength
// reinforcement BEFORE the four ordinary mud-turn replacement steps.
// It is placed only on an empty eastern-edge reinforcement hex outside German ZOC.
function shockReinforcementOptions(c,s){
 if(s.side!=='soviet'||s.turn!==4)return [];
 const shock=s.units.find(u=>u.army==='soviet'&&u.type==='shock');
 if(!shock||pos(shock))return [];
 return c.raw.hexes.filter(h=>h.sovietReplacement&&!occupant(s,h.x,h.y)&&!zoc(c,s,h.x,h.y,'soviet'))
   .map(h=>({x:h.x,y:h.y}));
}
function performShockReinforcement(c,s,preferred=null){
 const options=shockReinforcementOptions(c,s);
 const shock=s.units.find(u=>u.army==='soviet'&&u.type==='shock');
 if(!shock||!options.length){s.log.push({t:s.turn,side:'soviet',type:'shock-reinforcement-unavailable'});return false;}
 let target=preferred&&options.find(o=>o.x===preferred.x&&o.y===preferred.y);
 if(!target){const m=c.profile.victory.moscow;
  // Prefer rail access to the Moscow defense, but never override entry legality.
  target=options.slice().sort((a,b)=>(hexAt(c,b.x,b.y).rail||[]).length-(hexAt(c,a.x,a.y).rail||[]).length||dist(a.x,a.y,...m)-dist(b.x,b.y,...m))[0];
 }
 shock.strength='full';shock.position={x:target.x,y:target.y};claim(c,s,shock);
 s.log.push({t:s.turn,side:'soviet',type:'shock-reinforcement',unit:shock.id,at:{...target},replacementCost:0});return true;
}
function applyReplacement(c,s,r){let options=replacementOptions(c,s);if(!options.some(o=>JSON.stringify(o)===JSON.stringify(r)))return false;let u=s.units.find(v=>v.id===r.id);if(r.type==='restore')u.strength='full';else{u.strength='reduced';u.position={x:r.x,y:r.y};claim(c,s,u);}s.log.push({t:s.turn,side:u.army,type:'replacement',unit:u.id,action:r.type,at:pos(u)?clone(u.position):null});return true;}
function battleOdds(c,s,attackers,defender){if(!attackers.length)return {odds:0};let mud=isMud(c,s),total=0;for(let u of attackers){let f=strength(u);if(mud&&u.type==='tank')f/=2;total+=f;}let raw=Math.min(6,Math.floor(total/strength(defender)));let h=hexAt(c,defender.position.x,defender.position.y);let mods=[];
if(h.terrain==='forest')mods.push('forest');if(h.terrain==='fortification'&&defender.army==='soviet')mods.push('fortification');if(h.city==='major'||h.city==='moscow')mods.push('major-city');
let across=attackers.every(u=>{let dir=neighbours(c,h.x,h.y).find(n=>n.x===u.position.x&&n.y===u.position.y);return dir&&(h.river||[]).includes(dir.dir);});if(across)mods.push('river');return {odds:Math.max(0,raw-mods.length),raw,modifiers:mods,attackerStrength:total,defenderStrength:strength(defender)};}
function attackCandidates(c,s,side=s.side){let others=units(s,enemy(side)),out=[];for(let d of others){let aa=neighbours(c,d.position.x,d.position.y).map(n=>occupant(s,n.x,n.y)).filter(u=>u&&u.army===side);if(!aa.length)continue;let combinations=[];for(let mask=1;mask<1<<aa.length;mask++){let subset=aa.filter((_,i)=>mask>>i&1);let odds=battleOdds(c,s,subset,d);if(odds.odds>0)combinations.push({defender:d.id,attackers:subset.map(u=>u.id),...odds});}combinations.sort((a,b)=>b.odds-a.odds||a.attackers.length-b.attackers.length);out.push(...combinations.slice(0,8));}return out;}
function loseStep(s,u){if(u.strength==='full')u.strength='reduced';else {u.strength='dead';u.position=null;}}
// PDF §3.3 and Oberlabs identifyRetreat: advance exactly two hexes away
// (or farther through friendly occupancies), never end in enemy ZOC;
// at most one EZOC transit is survivable by a full-strength defender.
// Bound paths by playable hex count; retain the lowest-cost route to each end hex.
// Original Oberlabs retreat paths progress *away* from the original hex at
// every step. A unit may pass through friendly occupied hexes or one hostile
// ZOC, but must finish empty, at least two hexes away, outside all hostile ZOC.
// Track lowest-ZOC routes per endpoint; expand only unfinished paths. Each
// step strictly increases hex distance, making this a finite directed search.
function retreatOptions(c,s,d,steps=2){
 if(!pos(d))return [];
 const o={...d.position},limit=Math.min(c.hex.size,16);
 let frontier=[{x:o.x,y:o.y,cost:0,path:[]}],best=new Map();
 for(let depth=1;depth<=limit&&frontier.length;depth++){
  const next=[];
  for(const a of frontier){
   for(const n of neighbours(c,a.x,a.y)){
    if(dist(o.x,o.y,n.x,n.y)!==depth)continue;
    const oc=occupant(s,n.x,n.y);
    if(oc?.army===enemy(d.army))continue;
    const inZoc=zoc(c,s,n.x,n.y,d.army),cost=a.cost+Number(inZoc);
    if(cost>1)continue;
    const path=a.path.concat({x:n.x,y:n.y}),k=key(n.x,n.y);
    if(depth>=steps&&!oc&&!inZoc){
     const prior=best.get(k);
     if(!prior||cost<prior.cost||cost===prior.cost&&path.length<prior.path.length)
      best.set(k,{x:n.x,y:n.y,path,cost});
    }else if(depth<limit){
     next.push({x:n.x,y:n.y,cost,path});
    }
   }
  }
  // Dominance is sound for future paths because no occupied/visited path state
  // changes ZOCs and all future legal steps move one ring farther from origin.
  const dominant=new Map();
  for(const a of next){const k=key(a.x,a.y);if(!dominant.has(k)||a.cost<dominant.get(k).cost)dominant.set(k,a);}
  frontier=[...dominant.values()];
 }
 return [...best.values()].sort((a,b)=>a.cost-b.cost||a.path.length-b.path.length||(d.army==='soviet'?b.x-a.x:a.x-b.x)||a.y-b.y);
}
// These data-only choices are usable by a browser human player, an AI policy,
// or a replay tester. They do not change the canonical CRT or legal retreat set.
function battlePreview(c,s,action,die){
 const defender=s.units.find(u=>u.id===action.defender);
 const aa=action.attackers.map(id=>s.units.find(u=>u.id===id));
 if(!defender||!pos(defender)||!aa.length||aa.some(u=>!u||!pos(u)||u.army===defender.army||dist(u.position.x,u.position.y,defender.position.x,defender.position.y)!==1))return null;
 const score=battleOdds(c,s,aa,defender);
 if(score.odds<1||!Number.isInteger(die)||die<1||die>6)return null;
 const outcome=c.profile.crtByOdds[String(score.odds)][die-1];
 const h=hexAt(c,defender.position.x,defender.position.y);
 const cityHold=outcome==='DR'&&defender.strength==='full'&&(h.city==='moscow'||h.city==='major');
 const retreat=(!cityHold&&['DR','DRL','EX'].includes(outcome)&&!(outcome!=='DR'&&defender.strength==='reduced'))?retreatOptions(c,s,defender):[];
 return {die,outcome,odds:score.odds,modifiers:score.modifiers,cityHold,
  defender:action.defender,attackers:[...action.attackers],retreat,
  potentialAdvance:['DR','DRL','EX','DE'].includes(outcome)&&!cityHold};
}
// Optional common-random-number mode for *counterfactual research only*.
// Normal Oberlabs play uses the unchanged seeded PRNG. In experimental mode,
// a defender receives the same uniform 1d6 for the same turn and side across
// alternative continuations, independently of how many other battles occur.
function rollCombatDie(s,defenderId=null){
 if(s.experimentalCombatSeed!==undefined&&defenderId){
  let h=(s.experimentalCombatSeed>>>0)^0x9e3779b9;
  const label=`${s.turn}:${s.side}:${defenderId}`;
  for(let i=0;i<label.length;i++){h=Math.imul(h^label.charCodeAt(i),16777619)>>>0;}
  h^=h>>>16;h=Math.imul(h,2246822507)>>>0;h^=h>>>13;
  h=Math.imul(h,3266489909)>>>0;h=(h^(h>>>16))>>>0;
  return (h%6)+1;
 }
 return Math.floor(rand(s)*6)+1;
}
function resolveAttack(c,s,attackerIds,defenderId,roll=null,options={}){
 const d=s.units.find(u=>u.id===defenderId),aa=attackerIds.map(id=>s.units.find(u=>u.id===id)).filter(Boolean);
 if(!d||!pos(d)||!aa.length||aa.some(u=>!pos(u)||u.army===d.army||dist(u.position.x,u.position.y,d.position.x,d.position.y)!==1))return null;
 const score=battleOdds(c,s,aa,d);if(score.odds<1)return null;
 const die=roll??rollCombatDie(s,defenderId),outcome=c.profile.crtByOdds[String(score.odds)][die-1];
 const prior={...d.position},side=aa[0].army,defenderBefore=strength(d),defenderFullBefore=d.strength==='full';
 const dh=hexAt(c,prior.x,prior.y);
 // Reject malformed explicit orders before changing units. Source-compatible AI
 // defaults remain available when no explicit choice has been supplied.
 if(options.attackerLossId!==undefined&&(!aa.some(u=>u.id===options.attackerLossId)||outcome!=='AL'))throw Error('Invalid attacker loss choice');
 if(options.exchangeOrder!==undefined){
  if(outcome!=='EX'||!Array.isArray(options.exchangeOrder)||new Set(options.exchangeOrder).size!==options.exchangeOrder.length||options.exchangeOrder.some(id=>!aa.some(u=>u.id===id)))throw Error('Invalid exchange loss order');
 }
 let validatedRetreat=null;
 if(options.retreatTo!==undefined){
  if(!options.retreatTo||!Number.isInteger(options.retreatTo.x)||!Number.isInteger(options.retreatTo.y))throw Error('Invalid retreat destination');
  const hold=outcome==='DR'&&defenderFullBefore&&(dh.city==='moscow'||dh.city==='major');
  const canRetreat=['DR','DRL','EX'].includes(outcome)&&!hold&&
    !(outcome!=='DR'&&d.strength==='reduced');
  const routes=canRetreat?retreatOptions(c,s,d):[];
  validatedRetreat=routes.find(r=>r.x===options.retreatTo.x&&r.y===options.retreatTo.y);
  if(!validatedRetreat)throw Error('Invalid legal retreat endpoint');
 }
 if(options.advanceId!==undefined&&options.advanceId!==null&&options.advanceId!=='none'&&!aa.some(u=>u.id===options.advanceId))throw Error('Invalid advancing unit');
 let advanced=false,retreated=false,cityHold=false,retreatZocCost=0,attackerLoss=null,exchangeLosses=[],retreatDestination=null,retreatPath=[],advanceUnit=null;
 if(outcome==='AL'){
  let weak=options.attackerLossId?aa.find(u=>u.id===options.attackerLossId):aa.slice().sort((a,b)=>strength(a)-strength(b))[0];
  attackerLoss=weak.id;loseStep(s,weak);
 }
 if(['DRL','EX'].includes(outcome))loseStep(s,d);
 if(outcome==='DE'){d.strength='dead';d.position=null;}
 if(outcome==='DR'&&defenderFullBefore&&(dh.city==='moscow'||dh.city==='major')){
  loseStep(s,d);cityHold=true;
 }else if(['DR','DRL','EX'].includes(outcome)&&pos(d)){
  const best=validatedRetreat||retreatOptions(c,s,d)[0];
  if(!best||best.cost&&d.strength==='reduced'){d.strength='dead';d.position=null;}
  else{if(best.cost){retreatZocCost=best.cost;loseStep(s,d);}
   if(pos(d)){d.position={x:best.x,y:best.y};claim(c,s,d);retreated=true;retreatDestination={...d.position};retreatPath=best.path;}}
 }
 if(outcome==='EX'){
  const need=defenderFullBefore?d.combatFull-d.combatReduced:defenderBefore;
  let matched=0;
  const chosen=options.exchangeOrder?.length?options.exchangeOrder.map(id=>aa.find(u=>u.id===id)):
    aa.slice().sort((a,b)=>strength(a)-strength(b));
  const rest=aa.filter(u=>!chosen.includes(u)).sort((a,b)=>strength(a)-strength(b));
  for(const u of [...chosen,...rest]){if(matched>=need)break;
   const prev=strength(u);loseStep(s,u);matched+=prev-strength(u);exchangeLosses.push(u.id);
  }
 }
 const vacated=!pos(d)||d.position.x!==prior.x||d.position.y!==prior.y;
 if(vacated){
  const reserved=new Set(options.avoidAdvanceIds||[]);
  const available=aa.filter(u=>pos(u)&&!reserved.has(u.id));
  // Human may decline advance; AI retains its previous weakest-available choice.
  let chosen=options.advanceId==='none'?null:options.advanceId?available.find(u=>u.id===options.advanceId):available.slice().sort((a,b)=>strength(a)-strength(b))[0];
  if(chosen){chosen.position=prior;claim(c,s,chosen);advanced=true;advanceUnit=chosen.id;}
 }
 const record={t:s.turn,side,type:'combat',defender:defenderId,attackers:attackerIds,odds:score.odds,
  modifiers:score.modifiers,die,outcome,retreated,advance:advanced,cityHold,retreatZocCost,
  attackerLoss,exchangeLosses,retreatDestination,retreatPath,advanceUnit,defenderVacated:vacated};
 s.log.push(record);return record;
}
function gameResult(c,s){let m=c.profile.victory.moscow,k=key(...m);if(s.control[k]==='german')return 'german';let others=c.cities.filter(h=>key(h.x,h.y)!==k);return others.some(h=>s.control[key(h.x,h.y)]==='soviet')?'soviet':'draw';}
function endSide(c,s){if(s.side==='german'){s.side='soviet';s.phase='replacement';}else{s.turn++;s.side='german';s.phase='replacement';if(s.turn>7){s.over=true;s.winner=gameResult(c,s);s.phase='finished';}}s.ply++;return s;}
function strategicValue(c,s,side){let opp=enemy(side),value=0,moscow=c.profile.victory.moscow;for(let h of c.cities){let k=key(h.x,h.y),v=(h.city==='moscow'?300:h.city==='major'?55:12);value+=(s.control[k]===side?1:-1)*v;}for(let u of s.units){if(!pos(u))continue;let sign=u.army===side?1:-1;value+=sign*(strength(u)*2.5+7);let distance=dist(u.position.x,u.position.y,...moscow);value+=sign*(u.army==='german'?11-distance:distance-9)*.25;}
let g=occupant(s,...moscow);if(g&&g.army==='soviet'){value+=(side==='soviet'?1:-1)*(45+strength(g)*1.5);}value+=(side==='german'?1:-1)*(7-s.turn)*-2;return value;}
function targetList(c,s,side,policy){let city=c.cities.slice().sort((a,b)=>((b.city==='moscow'?20:0)-(a.city==='moscow'?20:0))||(side==='german'?b.x-a.x:a.x-b.x));if(policy==='flank')city.reverse();if(policy==='south')city.sort((a,b)=>b.y-a.y);if(policy==='north')city.sort((a,b)=>a.y-b.y);return city;}
function doReplacements(c,s,policy){let budget=replacementBudget(c,s);for(let i=0;i<budget;i++){let options=replacementOptions(c,s);if(!options.length)break;let m=c.profile.victory.moscow;
 if(s.side==='soviet'&&['fortress','screen','counter','railguard'].includes(policy)){
  let occupied=occupant(s,m[0],m[1]);
  options.sort((a,b)=>{
   const rank=r=>{let u=s.units.find(v=>v.id===r.id),xy=r.type==='enter'?r:u.position,near=dist(xy.x,xy.y,...m),atM=xy.x===m[0]&&xy.y===m[1];
    // A Moscow garrison is critical, but may only be placed by a legal replacement action.
    // A reduced Moscow garrison is restored before resources are spent on the outer defense.
    if(atM&&r.type==='restore')return 100000;
    if(!occupied&&atM&&r.type==='enter')return 90000+(u.type==='shock'?1000:0)+u.combatReduced;
    if(r.type==='restore')return 2800-40*near+u.combatFull*.5;
    if(r.type==='enter')return 500-35*near+u.combatReduced*.4;
    return 0;};
   return rank(b)-rank(a);
  });
 } else { options.sort((a,b)=>{let score=r=>{let u=s.units.find(v=>v.id===r.id),xy=r.type==='enter'?r:u.position;return (r.type==='restore'?40:policy==='conserve'?5:28)+strength(u)*.4+(r.type==='enter'?-dist(xy.x,xy.y,...m)*2:0)+(u.type==='shock'?20:0);};return score(b)-score(a);});}
 applyReplacement(c,s,options[0]);}}
// Voluntary fortress relief is allowed only when both legs are legal in the
// *current* movement phase. No teleporting, stacking, or illegal swaps.
function tryMoscowRelief(c,s,mode){
 if(mode!=='normal'||s.turn<4)return false;
 const m=c.profile.victory.moscow,old=occupant(s,...m),shock=s.units.find(u=>u.army==='soviet'&&u.type==='shock'&&pos(u));
 if(!old||!shock||old.id===shock.id||strength(shock)<=strength(old))return false;
 if(dist(shock.position.x,shock.position.y,...m)!==1)return false;
 const destinations=legalMoves(c,s,old,'normal').filter(h=>!zoc(c,s,h.x,h.y,'soviet')&&dist(h.x,h.y,...m)<=2&&hexAt(c,h.x,h.y)?.terrain==='fortification');
 for(const dest of destinations){
  const next=clone(s),oc=next.units.find(u=>u.id===old.id),sh=next.units.find(u=>u.id===shock.id);
  if(!move(c,next,oc.id,dest.x,dest.y,'normal'))continue;
  if(!move(c,next,sh.id,m[0],m[1],'normal'))continue;
  s.units=next.units;s.control=next.control;s.log=next.log;
  s.log.push({t:s.turn,side:'soviet',type:'garrison-relief',from:old.id,to:shock.id});
  return true;
 }
 return false;
}
function strategicMove(c,s,mode,policy,side){let relief=side==='soviet'&&['fortress','screen','counter','railguard'].includes(policy)?tryMoscowRelief(c,s,mode):false;let worked=new Set();if(relief){let ev=s.log[s.log.length-1],old=s.log.filter(v=>v.type==='garrison-relief').at(-1);if(old){worked.add(old.from);worked.add(old.to);}}let city=targetList(c,s,side,policy),eligible=units(s,side).filter(u=>mode!=='panzer'||u.type==='tank').filter(u=>mode!=='rail'||(hexAt(c,u.position.x,u.position.y).rail||[]).length).sort((a,b)=>{let da=Math.min(...city.map(h=>dist(a.position.x,a.position.y,h.x,h.y))),db=Math.min(...city.map(h=>dist(b.position.x,b.position.y,h.x,h.y)));return da-db||strength(b)-strength(a);});for(let u of eligible){if(side==='soviet'&&['fortress','screen','counter','railguard'].includes(policy)&&u.position.x===10&&u.position.y===2)continue;if(worked.has(u.id))continue;let moves=legalMoves(c,s,u,mode);if(!moves.length)continue;let at=clone(u.position);let initial=Math.min(...city.map(h=>dist(at.x,at.y,h.x,h.y)));let options=moves.map(m=>{let distValue=Math.min(...city.map((h,i)=>dist(m.x,m.y,h.x,h.y)*(i===0?0.65:1.1)));let threat=neighbours(c,m.x,m.y).filter(n=>occupant(s,n.x,n.y)?.army===enemy(side)).length;let z= zoc(c,s,m.x,m.y,side);let heldCity=hexAt(c,at.x,at.y)?.city;let score=-distValue*5+ (hexAt(c,m.x,m.y).city!=='none'?8:0)+(side==='soviet'&&hexAt(c,m.x,m.y).terrain==='fortification'?8:0)+(side==='soviet'&&['fortress','screen','counter','railguard'].includes(policy)?Math.max(0,4-dist(m.x,m.y,10,2))*(policy==='screen'?17:policy==='railguard'?12:11)+(hexAt(c,m.x,m.y).terrain==='fortification'?(policy==='screen'?18:9):0)+(policy==='counter'?threat*8:0)+(policy==='railguard'&&(hexAt(c,m.x,m.y).rail||[]).length?8:0):0)+(policy==='aggressive'?threat*9:policy==='conserve'?-threat*8:['fortress','screen','counter','railguard'].includes(policy)?threat*4:threat*2)+(policy==='south'?m.y*1.5:policy==='north'?-m.y*1.5:0)-(heldCity==='moscow'&&side==='soviet'?80:0)-(z&&policy==='conserve'?10:0);return {m,score};}).sort((a,b)=>b.score-a.score);let originScore=-initial*5+(hexAt(c,at.x,at.y).city!=='none'?8:0)+(hexAt(c,at.x,at.y).city==='moscow'&&side==='soviet'?100:0);if(options[0].score>originScore+.2){move(c,s,u.id,options[0].m.x,options[0].m.y,mode);worked.add(u.id);}}}
// CRT-aware attack allocation: preserve attackers if removing one does not cross a CRT
// column.  Among same-column sets, favor fewer attackers and less committed CF.
function selectCombatActions(c,s,side,policy){
 const attacks=attackCandidates(c,s,side),moscow=c.profile.victory.moscow;
 const refined=policy==='adaptive'||policy==='interdict'||policy==='envelop'||policy==='tactical';
 const scored=attacks.map(a=>{const d=s.units.find(u=>u.id===a.defender),h=hexAt(c,d.position.x,d.position.y);
   const committed=a.attackers.reduce((sum,id)=>sum+strength(s.units.find(u=>u.id===id)),0);
   const strategic=(h.city==='moscow'?180:h.city!=='none'?35:0)-dist(d.position.x,d.position.y,...moscow)*(side==='german'?3:0);
   return {...a,committed,score:strategic+a.odds*11-(refined?a.attackers.length*8+committed*.15:a.attackers.length*.1)};
 });
 scored.sort((a,b)=>b.score-a.score||b.odds-a.odds||a.committed-b.committed);
 return scored;
}
// Combat is declared as a complete set before any dice are rolled.
function announceBattles(c,s,policy,side){
 const committed=new Set(),defended=new Set(),declared=[],attacks=selectCombatActions(c,s,side,policy);
 const threshold=policy==='aggressive'||policy==='adaptive'||policy==='envelop'||policy==='interdict'?1:policy==='conserve'?3:2;
 for(const a of attacks){if(a.odds<threshold||defended.has(a.defender)||a.attackers.some(id=>committed.has(id)))continue;
  declared.push({defender:a.defender,attackers:[...a.attackers],declaredOdds:a.odds});
  defended.add(a.defender);a.attackers.forEach(id=>committed.add(id));}
 return declared;
}
function resolveDeclaredBattles(c,s,declared){
 const defenders=new Set(),attackers=new Set();
 // Reject duplicate commitments before the first roll or board mutation.
 for(const a of declared){
  if(defenders.has(a.defender)||a.attackers.some(id=>attackers.has(id)))throw Error('Duplicate announced combat commitment');
  defenders.add(a.defender);for(const id of a.attackers)attackers.add(id);
 }
 s.log.push({t:s.turn,side:s.side,type:'combat-declaration',battles:clone(declared)});
 const outcomes=[];
 for(let i=0;i<declared.length;i++){
  const a=declared[i],reserved=declared.slice(i+1).flatMap(x=>x.attackers);
  const result=resolveAttack(c,s,a.attackers,a.defender,null,{avoidAdvanceIds:reserved});
  if(result)outcomes.push(result);
 }
 return outcomes;
}
function strategicCombat(c,s,policy,side){
 return resolveDeclaredBattles(c,s,announceBattles(c,s,policy,side));
}
// Panzer penetration doctrine: stage 1 south of Tula -> east edge, stage 2 northern
// reinforcement screen -> infantry relief, stage 3 Moscow encirclement.
function edgeCoverage(c,s){
 const entries=c.raw.hexes.filter(h=>h.sovietReplacement),out=[];
 for(const h of entries){let occ=occupant(s,h.x,h.y),covered=zoc(c,s,h.x,h.y,'soviet');
  let deniedByGerman=occ?.army==='german'||covered;let blocked=!!occ||covered;
  out.push({x:h.x,y:h.y,blocked,deniedByGerman:!!deniedByGerman,covered,occupied:!!occ,occupiedBy:occ?.army||null,
    byTanks:neighbours(c,h.x,h.y).filter(n=>{let u=occupant(s,n.x,n.y);return u&&u.army==='german'&&u.type==='tank';}).map(n=>occupant(s,n.x,n.y).id),
    byInfantry:neighbours(c,h.x,h.y).filter(n=>{let u=occupant(s,n.x,n.y);return u&&u.army==='german'&&u.type!=='tank';}).map(n=>occupant(s,n.x,n.y).id)});
 }
 return out;
}
function sweepMetrics(c,s){let a=edgeCoverage(c,s),north=a.filter(h=>h.y<=4),south=a.filter(h=>h.y>=5),moscow=c.profile.victory.moscow;
 let tanks=units(s,'german').filter(u=>u.type==='tank'),inf=units(s,'german').filter(u=>u.type!=='tank');
 return {total:a.length,blocked:a.filter(x=>x.blocked).length,germanDenied:a.filter(x=>x.deniedByGerman).length,sovietOccupied:a.filter(x=>x.occupiedBy==='soviet').length,northBlocked:north.filter(x=>x.blocked).length,northTotal:north.length,southBlocked:south.filter(x=>x.blocked).length,southTotal:south.length,
    tankBlockers:a.filter(x=>x.byTanks.length>0).length,infantryBlockers:a.filter(x=>x.byInfantry.length>0).length,
    tanksEast:tanks.filter(u=>u.position.x>=10).length,tanksNearMoscow:tanks.filter(u=>dist(u.position.x,u.position.y,...moscow)<=2).length,
    infantryEast:inf.filter(u=>u.position.x>=9).length,moscowControl:s.control[key(...moscow)]};
}
function sweepMove(c,s,mode,variant='sweep'){
  let tanks=units(s,'german').filter(u=>u.type==='tank'),inf=units(s,'german').filter(u=>u.type!=='tank');
  let stage=s.turn<=2?'breakthrough':s.turn<=4?'screen':s.turn<=5?'relief':'moscow';
  if(variant==='adaptive'){const m=sweepMetrics(c,s);if(s.turn>=4 && (m.germanDenied>=Math.ceil(m.total*.60)||m.tanksNearMoscow>=3))stage='moscow';else if(s.turn>=3&&m.germanDenied>=Math.ceil(m.total*.35))stage='relief';}
  if(variant==='interdict'&&s.turn>=4)stage='moscow';
  if(variant==='envelop')stage='moscow';
  if(variant==='north-route')stage='north-route';
  // Each moving panzer chooses a legal destination that increases ZOC coverage,
  // progressing south to east before curling north. Avoid vacating a useful screen
  // until infantry can replace it.
  let active=mode==='panzer'?tanks:[...inf,...tanks];
  active.sort((a,b)=>mode==='panzer'?strength(b)-strength(a):(a.type==='tank'?1:0)-(b.type==='tank'?1:0));
  let moved=0;
  const zone=(u,h)=>{
    let xe=h.x,ye=h.y,entry=c.raw.hexes.filter(p=>p.sovietReplacement);
    let cover=entry.filter(p=>dist(xe,ye,p.x,p.y)<=1);
    let northern=cover.filter(p=>p.y<=4).length,southern=cover.filter(p=>p.y>=5).length;
    let right=xe*2,approach=-dist(xe,ye,10,2)*2;
    if(u.type!=='tank'){
      let held=entry.filter(p=>dist(xe,ye,p.x,p.y)<=1).length;
      return xe*3+held*12+(xe>=9?10:0)-Math.abs(ye-5)*.4;
    }
    if(stage==='north-route') return -dist(xe,ye,10,2)*9 + (ye<=2?25:0) + (xe>=6&&ye<=3?16:0) - (hexAt(c,xe,ye)?.terrain==='fortification'?12:0) + northern*1.5;
    if(stage==='breakthrough') return right*2 + ye*2.4 + southern*14 - Math.abs(ye-7)*1.7;
    if(stage==='screen') return right*2+ southern*7+northern*16 + (ye<=5?7:0) + approach*.25;
    if(stage==='relief') return right + northern*13+southern*8 +approach*.8;
    return approach*(variant==='envelop'?5:3) + (dist(xe,ye,10,2)<=1?24:0)+ northern*(variant==='interdict'?8:4);
  };
  for(let u of active){let candidates=legalMoves(c,s,u,mode==='panzer'?'panzer':'normal');if(!candidates.length)continue;
    const origin=u.position,base=zone(u,origin),current=edgeCoverage(c,s).filter(x=>x.blocked).length;
    let best=null,bestScore=-Infinity;
    for(let h of candidates){let old=u.position;u.position={x:h.x,y:h.y};let next=edgeCoverage(c,s).filter(x=>x.blocked).length;u.position=old;
      let score=zone(u,h)+(next-current)*(variant==='north-route'?0:23);
      let terrain=hexAt(c,h.x,h.y);
      if(terrain?.city&&terrain.city!=='none')score+=terrain.city==='moscow'?60:8;
      if(stage!=='moscow'&&u.type==='tank'&&origin.x>=10&&current>next)score-=30;
      if(score>bestScore){bestScore=score;best=h;}
    }
    if(best&&bestScore>base+.5){if(move(c,s,u.id,best.x,best.y,mode==='panzer'?'panzer':'normal'))moved++;}
  }
  s.log.push({t:s.turn,side:'german',type:'sweep-stage',stage,variant,mode,moved,...sweepMetrics(c,s)});
}
const POLICIES=['aggressive','balanced','conserve','flank','north','south'];
const SEARCH_GERMAN=['sweep','adaptive','envelop','north-route','interdict','aggressive','balanced'];
const SEARCH_SOVIET=['fortress','screen','counter','railguard'];
function playSide(c,base,policy='balanced'){let s=clone(base),side=s.side;if(s.over)return s;
if(s.phase==='setup')autoSetup(c,s);if(side==='soviet'&&s.turn===4)performShockReinforcement(c,s);doReplacements(c,s,policy);
const special=side==='german'&&['sweep','adaptive','interdict','envelop','north-route'].includes(policy);
if(!(side==='german'&&s.turn===1)){if(special)sweepMove(c,s,'panzer',policy);else strategicMove(c,s,side==='german'?'panzer':'rail',policy,side);}
strategicCombat(c,s,policy==='sweep'?'aggressive':policy,side);
if(special)sweepMove(c,s,'normal',policy);else strategicMove(c,s,'normal',policy,side);
s.log.push({t:s.turn,side,type:'end-turn',policy});endSide(c,s);return s;}
// A complete-state key excluding identity of functionally identical units, including
// remaining RNG seed because dice are part of the simulated game state.
function abstractStateKey(s){return [s.turn,s.side,s.seed,s.over,s.winner,
 Object.entries(s.control).sort((a,b)=>a[0].localeCompare(b[0])),
 s.units.map(u=>[u.army,u.type,u.movement,u.combatFull,u.combatReduced,u.strength,u.position?.x??-1,u.position?.y??-1])
 .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))].map(x=>JSON.stringify(x)).join('|');}
function candidatePolicies(side,mode='formation',width=4){let opts=mode==='formation'?(side==='german'?SEARCH_GERMAN:SEARCH_SOVIET):POLICIES;
return opts.slice(0,Math.max(1,Math.min(opts.length,width)));}
function minimax(c,s,depth,alpha,beta,rootSide,width,stats,mode='formation',cache=new Map()){
stats.nodes++;
if(s.over||depth===0)return {score:strategicValue(c,s,rootSide)+(s.over?(s.winner===rootSide?1e5:s.winner==='draw'?0:-1e5):0),line:[]};
const ck=abstractStateKey(s)+'|'+depth+'|'+rootSide+'|'+mode+'|'+width;
if(cache.has(ck)){stats.hits++;return cache.get(ck);}
let maximizer=s.side===rootSide,opts=candidatePolicies(s.side,mode,width),best={score:maximizer?-Infinity:Infinity,line:[]},pruned=false,seen=new Set();
for(let policy of opts){let next=playSide(c,s,policy),nk=abstractStateKey(next);
if(seen.has(nk)){stats.equivalent++;continue;}seen.add(nk);
let r=minimax(c,next,depth-1,alpha,beta,rootSide,width,stats,mode,cache);
if(maximizer?r.score>best.score:r.score<best.score)best={score:r.score,line:[policy,...r.line]};
if(maximizer)alpha=Math.max(alpha,best.score);else beta=Math.min(beta,best.score);
if(beta<=alpha){stats.prunes++;pruned=true;break;}}
if(!pruned)cache.set(ck,best);return best;}
function choose(c,s,depth=2,width=4,forceSweep=false,mode='formation'){
let stats={nodes:0,prunes:0,equivalent:0,hits:0},d=Math.max(1,Math.min(3,depth));
let r=forceSweep&&s.side==='german'?{score:strategicValue(c,playSide(c,s,'sweep'),s.side),line:['sweep']}:minimax(c,s,d,-Infinity,Infinity,s.side,width,stats,mode);
return {policy:r.line[0]||'balanced',score:r.score,pv:r.line,stats};}
// Soviet adversarial policy search: enumerate coherent fortress formations and
// score each after an explicit predicted German side-turn. This is *one opposing
// side-turn response*, not exhaustive unit-level minimax. Deterministic seed
// state is cloned for each line so the comparison is reproducible.
function chooseSovietResponse(c,s,germanDoctrine='sweep',useReply=true){
 if(s.side!=='soviet')throw Error('Soviet response requires Soviet-to-move state');
 let rows=[];
 for(const policy of SEARCH_SOVIET){
  const after=playSide(c,s,policy);
  const m=occupant(after,10,2);
  const value=strategicValue(c,after,'soviet')+(after.control['10,2']==='soviet'?90:-2000);
  rows.push({policy,score:value,moscowGarrison:m?.id||null,reply:null,after});
 }
 rows.sort((a,b)=>b.score-a.score||SEARCH_SOVIET.indexOf(a.policy)-SEARCH_SOVIET.indexOf(b.policy));
 // Expensive adversarial continuation is limited to the two highest immediate
 // candidates. This is a selective, bounded 2-ply response search.
 if(useReply){
  for(const row of rows.slice(0,2)){
   const predicted=playSide(c,row.after,germanDoctrine==='formation'?'envelop':germanDoctrine);
   const m=occupant(predicted,10,2),safe=predicted.control['10,2']==='soviet';
   row.score=strategicValue(c,predicted,'soviet')+(safe?180:-2000);
   row.reply={moscowOwner:predicted.control['10,2'],moscowGarrison:m?.id||null};
  }
  // Nonsearched policies may not outrank searched policies: report them as
  // unsearched rather than pretending their static scores are comparable.
  rows.forEach(r=>{if(!r.reply)r.score=null;});
  rows.sort((a,b)=>(b.score??-Infinity)-(a.score??-Infinity)||SEARCH_SOVIET.indexOf(a.policy)-SEARCH_SOVIET.indexOf(b.policy));
 }
 const chosen=rows[0];
 return {policy:chosen.policy,score:chosen.score,pv:[chosen.policy,germanDoctrine],stats:{nodes:rows.length+(useReply?2:0),prunes:0,equivalent:0,hits:0},alternatives:rows.map(({after,...rest})=>rest)};
}
function playSovietAdversarial(c,s,germanDoctrine='sweep',useReply=true){
 const decision=chooseSovietResponse(c,s,germanDoctrine,useReply);
 const state=playSide(c,s,decision.policy);
 state.log.push({t:s.turn,side:'soviet',type:'decision',...decision});
 return {state,decision};
}
function playAI(c,s,depth=2,width=4,forceSweep=false,mode='formation'){
let decision=choose(c,s,depth,width,forceSweep,mode),next=playSide(c,s,decision.policy);
next.log.push({t:s.turn,side:s.side,type:'decision',...decision});return {state:next,decision};}
function runMatch(c,seed=1,depth=2,width=3,mode='formation'){let s=makeState(c,seed);
while(!s.over&&s.ply<20)s=playAI(c,s,depth,width,false,mode).state;return s;}
// One-step post-mortem: compare actual tactical action to nearby alternatives at
// fixed pre-decision position. It computes only guaranteed CRT column effects.
function crtThresholdAudit(c,s,side=s.side){let observations=[];
for(const d of units(s,enemy(side))){let aa=neighbours(c,d.position.x,d.position.y)
.map(n=>occupant(s,n.x,n.y)).filter(u=>u?.army===side);
if(!aa.length)continue;let candidates=[];
for(let mask=1;mask<(1<<aa.length);mask++){let subset=aa.filter((_,i)=>mask>>i&1);
let odds=battleOdds(c,s,subset,d);if(odds.odds<1)continue;
candidates.push({attackers:subset.map(u=>u.id),odds:odds.odds,committed:subset.reduce((n,u)=>n+strength(u),0),count:subset.length});}
const byOdds={};for(const a of candidates){let k=a.odds;if(!byOdds[k]||a.count<byOdds[k].count||a.count===byOdds[k].count&&a.committed<byOdds[k].committed)byOdds[k]=a;}
let opportunities=Object.values(byOdds).sort((a,b)=>b.odds-a.odds);
if(opportunities.length)observations.push({defender:d.id,hex:d.position,availableAttackers:aa.length,legalSubsets:candidates.length,distinctCRTColumns:opportunities.length,efficient:opportunities});}
return observations;}
// Exact local CRT sensitivity: holding all geometry fixed, change one attacker CF
// by +1.  This tests the specific 7-vs-8 threshold hypothesis without asserting
// that the units can actually exchange positions under movement rules.
function onePointSensitivity(c,s,side=s.side){const result=[];
for(const a of attackCandidates(c,s,side)){
 const d=s.units.find(u=>u.id===a.defender);
 for(const id of a.attackers){const u=s.units.find(u=>u.id===id),old=battleOdds(c,s,a.attackers.map(i=>s.units.find(v=>v.id===i)),d).odds;
 const shadow={...u,combatFull:u.combatFull+1,combatReduced:u.combatReduced+1};
 const updated=battleOdds(c,s,a.attackers.map(i=>i===id?shadow:s.units.find(v=>v.id===i)),d).odds;
 if(updated!==old)result.push({defender:a.defender,attacker:id,attackers:a.attackers,fromOdds:old,toOdds:updated,deltaCF:1});
 }
}
return result;}
function comparePlans(c,s,side=s.side,policies=candidatePolicies(side,'formation',6)){
return policies.map(policy=>{let next=playSide(c,s,policy);return {policy,score:strategicValue(c,next,side)+(next.over?(next.winner===side?1e5:next.winner==='draw'?0:-1e5):0),
  key:abstractStateKey(next),result:next.winner,edge:sweepMetrics(c,next),battles:next.log.filter(e=>e.type==='combat').length};})
.map(({key,...rest})=>rest).sort((a,b)=>b.score-a.score);}
function validate(c,s){let found=new Set();for(let u of s.units){if(!pos(u))continue;let k=key(u.position.x,u.position.y);if(!hexAt(c,...[u.position.x,u.position.y])||found.has(k))throw Error('Invalid/stacked unit '+u.id);found.add(k);}return true;}
return {doReplacements,strategicCombat,strategicMove,sweepMove,announceBattles,buildScenario,makeState,setupPlace,finishSetup,battlePreview,rollCombatDie,shockReinforcementOptions,performShockReinforcement,autoSetup,abstractStateKey,candidatePolicies,crtThresholdAudit,onePointSensitivity,comparePlans,selectCombatActions,edgeCoverage,sweepMetrics,legalMoves,move,communication,replacementBudget,replacementOptions,applyReplacement,battleOdds,attackCandidates,announceBattles,resolveDeclaredBattles,resolveAttack,retreatOptions,gameResult,endSide,playSide,choose,playAI,chooseSovietResponse,playSovietAdversarial,runMatch,validate,occupant,units,hexAt,neighbours,dist,strength,geom,Hex,key,isMud,strategicValue,enemy,claim};
});
