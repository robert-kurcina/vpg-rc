/* v1.5 experimental German screen-breach planner.
   Changes only AI selection. Canonical engine rules and CRT are unchanged. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B4MGermanAssaultV15=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const E=typeof B4MEngine!=='undefined'?B4MEngine:require('./engine.js');
const B=typeof B4MOpeningBook!=='undefined'?B4MOpeningBook:require('./opening-book.js');
const C=typeof B4MCapitalAssault!=='undefined'?B4MCapitalAssault:require('./capital-assault.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const center={x:10,y:2};
const distance=(a,b)=>E.dist(a.x,a.y,b.x,b.y);
function adjacent(c,s,d){return E.neighbours(c,d.position.x,d.position.y).map(p=>E.occupant(s,p.x,p.y)).filter(u=>u?.army==='german');}
function metrics(c,s,d,ids){const a=ids.map(id=>s.units.find(u=>u.id===id)).filter(Boolean);return a.length?E.battleOdds(c,s,a,d):{odds:0};}
function consequence(c,s,d,odds){if(!odds)return {vacate:0,soften:0,attackerLoss:0};
 const crt=c.profile.crtByOdds[String(odds)],atM=distance(d.position,center)===0,city=E.hexAt(c,d.position.x,d.position.y)?.city;
 let vacate=0,soften=0,attackerLoss=0;
 for(const code of crt){if(code==='AL'){attackerLoss++;continue;}
  if(code==='DE'){vacate++;continue;}
  if(code==='EX'){vacate++;soften++;attackerLoss+=.7;continue;}
  if(code==='DRL'){vacate++;soften++;continue;}
  if(code==='DR'){if(d.strength==='full'&&(city==='moscow'||city==='major'))soften++;
     else vacate++;
  }
 }
 return {vacate:vacate/6,soften:soften/6,attackerLoss:attackerLoss/6,atM};
}
function prepareForTarget(c,base,dId){let s=copy(base),d=s.units.find(x=>x.id===dId),tanks=E.units(s,'german').filter(u=>u.type==='tank');
 // Move near tanks first to avoid far-away tanks claiming critical adjacent hexes.
 tanks.sort((a,b)=>distance(a.position,d.position)-distance(b.position,d.position)||E.strength(b)-E.strength(a)||a.id.localeCompare(b.id));
 const performed=[];
 for(const u of tanks){
  const options=E.legalMoves(c,s,u,'panzer');if(!options.length)continue;
  const atD=distance(u.position,d.position),atM=distance(u.position,center);
  let best=null,bestGain=0;
  for(const p of options){
   const dt=distance(p,d.position),dm=distance(p,center);
   // Preserve units already adjacent to the target, and favor CRT-building
   // attackers over remote replacement-blocking positions.
   let gain=(atD-dt)*20+(atM-dm)*7;
   if(dt===1&&atD!==1)gain+=105+E.strength(u)*3;
   if(atD===1&&dt!==1)gain-=170;
   if(dm===1&&atM!==1)gain+=35;
   // A tank next to Moscow with no screen breach is not yet a winning attack.
   if(dm===1&&dt>2)gain-=35;
   if(E.hexAt(c,p.x,p.y)?.city==='major')gain+=5;
   if(gain>bestGain+.01){best=p;bestGain=gain;}
  }
  if(best&&E.move(c,s,u.id,best.x,best.y,'panzer'))performed.push({id:u.id,x:best.x,y:best.y});
 }
 const a=adjacent(c,s,d),b=E.battleOdds(c,s,a,d),p=consequence(c,s,d,b.odds);
 const nNear=E.units(s,'german').filter(u=>distance(u.position,center)<=2).length;
 const nAtt=a.length,full=d.strength==='full';
 const score=(p.vacate*190+p.soften*80-p.attackerLoss*50)+b.odds*22+nAtt*10+nNear*6-
  (full?40:0)+performed.length*3 + (distance(d.position,center)===1?65:0);
 return {target:d.id,score,odds:b.odds,adjacent:nAtt,moves:performed};
}
function screenPlan(c,s){const m=E.occupant(s,10,2);
 if(m?.army!=='soviet')return {target:null,moves:[]};
 const target=E.units(s,'soviet').filter(u=>distance(u.position,center)===1);
 if(!target.length)return {target:m.id,moves:[]};
 const choices=target.map(d=>prepareForTarget(c,s,d.id));
 choices.sort((a,b)=>b.score-a.score||a.target.localeCompare(b.target));
 return {...choices[0],alternatives:choices.map(x=>({target:x.target,score:Math.round(x.score),odds:x.odds}))};
}
function prepMove(c,s){const plan=screenPlan(c,s),executed=[];
 for(const a of plan.moves||[]){if(!E.move(c,s,a.id,a.x,a.y,'panzer'))throw Error('Panzer preparation no longer legal: '+a.id);executed.push(a.id);}
 s.log.push({t:s.turn,side:'german',type:'v15-breach-preparation',target:plan.target,score:Math.round(plan.score||0),expectedOdds:plan.odds||0,moved:executed,alternatives:plan.alternatives||[]});return plan;
}
function combatPlan(c,s,targetId){const groups=C.battleOptions(c,s),expanded=[];
 for(const g of groups){const d=s.units.find(u=>u.id===g.defender),dist=distance(d.position,center);
  const opts=g.choices.map(o=>{
   const p=consequence(c,s,d,o.odds),isTarget=d.id===targetId,atM=dist===0,ring=dist===1;
   const f=o.attackers.reduce((n,id)=>n+E.strength(s.units.find(u=>u.id===id)),0);
   // CRT-aware: a full-strength Moscow defender is NOT displaced by DR.
   let score=(atM?450:ring?120:15)*p.vacate+(atM&&s.turn<7?115:50)*p.soften-
     (atM?100:55)*p.attackerLoss+o.odds*10 - o.attackers.length*4-f*.23;
   if(isTarget)score+=75;
   if(atM&&p.vacate>0)score+=180;
   if(!atM&&dist>1)score-=55;
   return {...o,score};
  });
  opts.sort((a,b)=>b.score-a.score||a.attackers.length-b.attackers.length);
  expanded.push({id:g.defender,options:opts.slice(0,10)});
 }
 expanded.sort((a,b)=>{
  const ad=s.units.find(u=>u.id===a.id),bd=s.units.find(u=>u.id===b.id);
  const da=distance(ad.position,center),db=distance(bd.position,center);
  return (da===0?-1:da===1?0:1)-(db===0?-1:db===1?0:1)||a.id.localeCompare(b.id);
 });
 let beam=[{used:0,score:0,declared:[]}];
 for(const group of expanded){const next=[];
  for(const row of beam){next.push(row);
   for(const o of group.options){if((row.used&o.bits)!==0||o.score<=0)continue;
    next.push({used:row.used|o.bits,score:row.score+o.score,declared:[...row.declared,{defender:o.defender,attackers:o.attackers,declaredOdds:o.odds}]});
   }
  }
  next.sort((a,b)=>b.score-a.score||a.declared.length-b.declared.length);
  const seen=new Set();beam=[];
  for(const r of next){const key=`${r.used}/${r.declared.map(o=>o.defender).sort().join(';')}`;
   if(seen.has(key))continue;seen.add(key);beam.push(r);if(beam.length>=36)break;
  }
 }
 return beam[0]?.declared||[];
}
function playSide(c,base,originalPolicy='adaptive'){
 if(base.side!=='german')throw Error('Expected German side');
 const s=copy(base);if(s.over)return s;
 E.doReplacements(c,s,originalPolicy);
 const plan=s.turn>1?prepMove(c,s):{target:null,moves:[]};
 const declared=combatPlan(c,s,plan.target);
 C.resolveCapitalBattles(c,s,declared);
 C.moveConcentration(c,s,'normal');
 s.log.push({t:s.turn,side:'german',type:'v15-plan-end',target:plan.target,battles:declared.length,assessment:C.combatSummary(c,s)});
 E.endSide(c,s);E.validate(c,s);return s;
}
function playFromOpening(c,s,g='G2',so='S2',options={}){
 if(s.side==='german'&&s.turn>=(options.beginTurn||5))return playSide(c,s,B.selectedPolicy(s,B.get('german',g)));
 return B.play(c,s,g,so);
}
return {consequence,screenPlan,prepMove,combatPlan,playSide,playFromOpening};
});
