/* v1.6: bounded German assault quality / capital retention planner.
 * Rules and random-number generation remain in the original engine.
 * No outcome peeking; all evaluations are made before dice are rolled.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B4MAssaultRetentionV16=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const E=typeof B4MEngine!=='undefined'?B4MEngine:require('./engine.js');
const B=typeof B4MOpeningBook!=='undefined'?B4MOpeningBook:require('./opening-book.js');
const C=typeof B4MCapitalAssault!=='undefined'?B4MCapitalAssault:require('./capital-assault.js');
const V=typeof B4MGermanAssaultV15!=='undefined'?B4MGermanAssaultV15:require('./german-assault-v15.js');
const M={x:10,y:2},clone=x=>JSON.parse(JSON.stringify(x));
const dist=(a,b=M)=>E.dist(a.x,a.y,b.x,b.y);
function adjacent(c,s,d,side='german'){
 return E.neighbours(c,d.position.x,d.position.y).map(p=>E.occupant(s,p.x,p.y)).filter(u=>u?.army===side);
}
function crtOutcome(c,s,d,attackers){
 const b=E.battleOdds(c,s,attackers,d),h=E.hexAt(c,d.position.x,d.position.y),full=d.strength==='full';
 if(b.odds<1)return {odds:0,vacate:0,soften:0,adverse:0,holdDR:0,attackerStrength:b.attackerStrength||0,defenderStrength:E.strength(d)};
 let vacate=0,soften=0,adverse=0,holdDR=0;
 for(const v of c.profile.crtByOdds[String(b.odds)]){
  if(v==='DE'){vacate++;soften++;}
  if(v==='EX'){vacate++;soften++;adverse+=.65;}
  if(v==='DRL'){vacate++;soften++;}
  if(v==='DR'){
   if(full&&(h.city==='moscow'||h.city==='major')){soften++;holdDR++;}
   else vacate++;
  }
  if(v==='AL')adverse++;
 }
 return {odds:b.odds,vacate:vacate/6,soften:soften/6,adverse:adverse/6,holdDR:holdDR/6,attackerStrength:b.attackerStrength,defenderStrength:b.defenderStrength};
}
function defenseAudit(c,s){
 const g=E.occupant(s,M.x,M.y);if(!g||g.army!=='german')return {held:false,odds:0,adjacentSovietStrength:0,retentionRisk:1};
 const sov=adjacent(c,s,g,'soviet'),sum=sov.reduce((n,u)=>n+E.strength(u),0),profile=sov.length?crtOutcome(c,s,g,sov):null;
 return {held:true,garrison:g.id,garrisonStrength:E.strength(g),adjacentSovietStrength:sum,odds:profile?.odds||0,retentionRisk:profile?.vacate||0,cityHoldDR:profile?.holdDR||0};
}
function railThreats(c,s){
 const danger=new Map(),ring=E.neighbours(c,M.x,M.y);
 for(const p of ring){
  const occ=E.occupant(s,p.x,p.y);
  if(occ?.army==='german'){danger.set(`${p.x},${p.y}`,{strength:0,source:'blocked'});continue;}
  let strongest=occ?.army==='soviet'?E.strength(occ):0;
  let source=occ?.army==='soviet'?occ.id:null;
  if(!occ){
   for(const u of E.units(s,'soviet')){
    if(!(E.hexAt(c,u.position.x,u.position.y)?.rail||[]).length)continue;
    if(E.strength(u)<=strongest)continue;
    if(E.legalMoves(c,s,u,'rail').some(q=>q.x===p.x&&q.y===p.y)){strongest=E.strength(u);source=u.id;}
   }
  }
  danger.set(`${p.x},${p.y}`,{strength:strongest,source});
 }
 return danger;
}
function retentionProjection(c,s){
 const city=E.occupant(s,M.x,M.y),current=defenseAudit(c,s),threats=railThreats(c,s);
 // Conservative threat upper bound: it can over-count one Soviet unit as
 // available to more than one ring hex. It NEVER substitutes for an actual
 // legal Soviet attack or a probability of final victory.
 const potentialStrength=[...threats.values()].reduce((n,x)=>n+x.strength,0);
 const upperOdds=city?.army==='german'?Math.max(0,Math.min(6,Math.floor(potentialStrength/E.strength(city))-1)):0;
 return {...current,railThreatUpperStrength:potentialStrength,railThreatUpperOdds:upperOdds,
  contestedRing:[...threats.values()].filter(x=>x.strength>0).length};
}
function moveRetention(c,s){
 const city=E.occupant(s,M.x,M.y),moved=[];
 if(city?.army!=='german')return moved;
 // Defend against the imminent Soviet reply. Place previously uncommitted
 // units in legally reachable ring hexes that could admit rail attackers.
 // Each formation receives at most one normal movement order.
 let danger=railThreats(c,s);
 const germ=E.units(s,'german').filter(u=>u.id!==city.id).sort((a,b)=>
  dist(a.position)-dist(b.position)||E.strength(b)-E.strength(a)||a.id.localeCompare(b.id));
 for(const u of germ){
  const original=dist(u.position),oldKey=`${u.position.x},${u.position.y}`;
  // Never vacate an existing occupied ring hex merely to occupy another.
  // A swap can open a rail counterattack path the local score cannot see.
  if(original>4||original===1)continue;
  const oldBlock=0;
  let best=null,bestGain=0;
  for(const p of E.legalMoves(c,s,u,'normal')){
   if(dist(p)!==1)continue;
   const target=`${p.x},${p.y}`,vacancy=danger.get(target);
   if(!vacancy)continue;
   const gain=30+vacancy.strength*9-oldBlock-(E.neighbours(c,p.x,p.y).filter(q=>E.occupant(s,q.x,q.y)?.army==='soviet').length*8);
   if(gain>bestGain+.1){best=p;bestGain=gain;}
  }
  if(best&&E.move(c,s,u.id,best.x,best.y,'normal')){
   moved.push({id:u.id,to:{x:best.x,y:best.y},gain:Math.round(bestGain)});
   danger=railThreats(c,s);
  }
 }
 s.log.push({t:s.turn,side:'german',type:'v16-retention-moves',moved,projection:retentionProjection(c,s)});
 return moved;
}
function advanceChoice(c,s,declared,remaining){
 const d=s.units.find(u=>u.id===declared.defender),atM=d&&dist(d.position)===0;
 const reserved=new Set(remaining.flatMap(x=>x.attackers));
 const choices=declared.attackers.map(id=>s.units.find(u=>u.id===id)).filter(u=>u&&E.strength(u)>0&&!reserved.has(u.id));
 if(!choices.length)return 'none';
 // Capital's strongest surviving formation is the most robust first garrison.
 // For a screen, prefer durability but do not move a Moscow garrison away.
 choices.sort((a,b)=>E.strength(b)-E.strength(a)||(b.strength==='full'?1:0)-(a.strength==='full'?1:0)||a.id.localeCompare(b.id));
 return choices[0].id;
}
function combatOptions(c,s){
 const germ=E.units(s,'german'),index=new Map(germ.map((u,i)=>[u.id,1<<i])),groups=[];
 const capital=E.occupant(s,M.x,M.y);
 for(const d of E.units(s,'soviet')){
  const proximity=dist(d.position);
  if(proximity>2)continue;
  const aa=adjacent(c,s,d);
  if(!aa.length)continue;
  const opts=[];
  for(let mask=1;mask<(1<<aa.length);mask++){
   const attackers=aa.filter((_,i)=>mask&(1<<i)),v=crtOutcome(c,s,d,attackers);
   if(!v.odds)continue;
   const bits=attackers.reduce((b,u)=>b|index.get(u.id),0);
   const atM=proximity===0,ring=proximity===1,full=d.strength==='full';
   // Capturing Moscow is necessary, but the first DR against full-strength
   // city defenders only reduces them. Never count it as an immediate capture.
   const quality=atM?(v.odds>=4?260:v.odds===3?155:v.odds===2?45:-65):0;
   const screen=ring?(v.odds>=3?65:v.odds===2?35:0):0;
   const strength=attackers.reduce((n,u)=>n+E.strength(u),0);
   const preservation=attackers.filter(u=>dist(u.position)===1).length;
   let score=atM? 230*v.vacate+100*v.soften+quality-125*v.adverse:
             ring? 105*v.vacate+50*v.soften+screen-75*v.adverse:
             20*v.vacate+20*v.soften-45*v.adverse;
   score+= (atM?24:ring?9:0)*v.odds-strength*(atM?.5:.75)-attackers.length*4;
   if(ring&&capital?.army==='soviet')score-=preservation*3;
   if(atM&&s.turn===7)score+=v.vacate*105;
   // Low-odds capital attacks remain possible in the final turn but should
   // not displace competent attacks against the screening formations.
   if(atM&&full&&v.odds<2&&s.turn<7)score-=50;
   if(score>0)opts.push({defender:d.id,attackers:attackers.map(u=>u.id),bits,score,odds:v.odds,prob:v.vacate,soften:v.soften});
  }
  opts.sort((a,b)=>b.score-a.score||b.odds-a.odds||a.attackers.length-b.attackers.length);
  if(opts.length)groups.push({id:d.id,priority:proximity===0?0:proximity===1?1:2,options:opts.slice(0,18)});
 }
 groups.sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
 return groups;
}
function combatPlan(c,s){
 const groups=combatOptions(c,s);let beam=[{mask:0,value:0,declared:[]}];
 for(const g of groups){
  const next=[];
  for(const row of beam){next.push(row);for(const o of g.options){if(row.mask&o.bits)continue;
   next.push({mask:row.mask|o.bits,value:row.value+o.score,declared:[...row.declared,{defender:o.defender,attackers:o.attackers,declaredOdds:o.odds,quality:{vacate:o.prob,soften:o.soften}}]});
  }}
  next.sort((a,b)=>b.value-a.value||a.declared.length-b.declared.length);
  const seen=new Set();beam=[];
  for(const row of next){const signature=`${row.mask}:${row.declared.map(x=>x.defender).join(',')}`;
   if(seen.has(signature))continue;seen.add(signature);beam.push(row);if(beam.length>=48)break;
  }
 }
 return beam[0]?.declared||[];
}
function resolve(c,s,declared){
 s.log.push({t:s.turn,side:'german',type:'v16-declarations',battles:clone(declared)});
 const completed=[];
 for(let i=0;i<declared.length;i++){
  const x=declared[i],other=declared.slice(i+1),advanceId=advanceChoice(c,s,x,other);
  const r=E.resolveAttack(c,s,x.attackers,x.defender,null,{advanceId,avoidAdvanceIds:other.flatMap(z=>z.attackers)});
  if(r)completed.push(r);
 }
 return completed;
}
function playSide(c,base,policy='adaptive'){
 if(base.side!=='german')throw Error('Expected German side');
 const s=clone(base);if(s.over)return s;
 E.doReplacements(c,s,policy);
 // Do not replace the tested G2 deployment or the pre-mud opening policy.
 const breach=s.turn>1?V.prepMove(c,s):{target:null,moves:[]};
 const declared=combatPlan(c,s);
 const capitalDefender=E.occupant(s,M.x,M.y)?.id||null;
 const capitalOrders=declared.filter(d=>d.defender===capitalDefender);
 const battles=resolve(c,s,declared);
 if(E.occupant(s,M.x,M.y)?.army==='german')moveRetention(c,s);
 else C.moveConcentration(c,s,'normal');
 const capital=E.occupant(s,M.x,M.y);const risk=defenseAudit(c,s);
 s.log.push({t:s.turn,side:'german',type:'v16-assault-audit',moscowOwner:capital?.army||s.control['10,2'],breachTarget:breach.target,capitalBattles:battles.filter(x=>x.defender===capitalDefender).length,declared:declared.length,highestCapitalOdds:Math.max(0,...capitalOrders.map(d=>d.declaredOdds)),retention:risk});
 E.endSide(c,s);E.validate(c,s);return s;
}
function playFromOpening(c,s,g='G2',so='S2',options={}){
 if(s.side==='german'&&(s.turn===2||s.turn>=5))return playSide(c,s,B.selectedPolicy(s,B.get('german',g)));
 return B.play(c,s,g,so);
}
return {crtOutcome,defenseAudit,railThreats,retentionProjection,moveRetention,advanceChoice,combatOptions,combatPlan,resolve,playSide,playFromOpening};
});
