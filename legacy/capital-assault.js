/* A bounded, optional German tactical policy. It changes move and combat
   selection, not the legal move generator, CRT, replacement, or victory rules.
   Deliberately opt-in; historical G1-G32 results retain their original AI. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B4MCapitalAssault=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const E=typeof B4MEngine!=='undefined'?B4MEngine:require('./engine.js');
const B=typeof B4MOpeningBook!=='undefined'?B4MOpeningBook:require('./opening-book.js');
const k=(p)=>`${p.x},${p.y}`;
function moscow(c){const [x,y]=c.profile.victory.moscow;return {x,y};}
function ring(c){const m=moscow(c);return E.neighbours(c,m.x,m.y).map(n=>({x:n.x,y:n.y}));}
function nearest(c,p,q){return E.dist(p.x,p.y,q.x,q.y);}
function defenders(c,s){const m=moscow(c);return E.units(s,'soviet').filter(u=>nearest(c,u.position,m)<=2);}
function isRing(c,u){return nearest(c,u.position,moscow(c))===1;}
function allAdjacent(c,s,d){return E.neighbours(c,d.position.x,d.position.y).map(n=>E.occupant(s,n.x,n.y)).filter(u=>u?.army==='german');}
function combatSummary(c,s){
 const m=moscow(c),g=E.occupant(s,m.x,m.y),att=g?.army==='soviet'?allAdjacent(c,s,g):[];
 const odds=g?.army==='soviet'&&att.length?E.battleOdds(c,s,att,g).odds:0;
 const screens=defenders(c,s).filter(u=>isRing(c,u)).map(u=>{const aa=allAdjacent(c,s,u);return {id:u.id,at:u.position,cf:E.strength(u),adjacentAttackers:aa.map(a=>a.id),odds:aa.length?E.battleOdds(c,s,aa,u).odds:0};});
 return {moscowOwner:s.control[k(m)],moscowGarrison:g?.id||null,moscowAttackers:att.map(u=>u.id),moscowOdds:odds,screens};
}
// Choose the ring defender reachable by the greatest useful German strength.
// This is a diagnostic target, not a claim of an optimal or forced breach.
function breachTarget(c,s){
 const m=moscow(c),g=E.occupant(s,m.x,m.y);
 if(g?.army==='soviet'){
  const screen=defenders(c,s).filter(u=>isRing(c,u));
  if(!screen.length)return g;
  const force=E.units(s,'german');
  const possibilities=screen.map(d=>{
   let near=force.filter(u=>nearest(c,u.position,d.position)<=3).reduce((n,u)=>n+E.strength(u)/Math.max(1,nearest(c,u.position,d.position)),0);
   const already=allAdjacent(c,s,d),odds=already.length?E.battleOdds(c,s,already,d).odds:0;
   const cityPenalty=E.hexAt(c,d.position.x,d.position.y)?.terrain==='fortification'?2:0;
   return {d,score:near+odds*14-cityPenalty*2};
  });
  possibilities.sort((a,b)=>b.score-a.score||a.d.id.localeCompare(b.d.id));
  return possibilities[0].d;
 }
 return null;
}
function candidatePositionScore(c,s,u,point,target){
 const m=moscow(c),dm=nearest(c,point,m),held=s.control[k(m)]==='german',ringPositions=ring(c);
 let score= -dm*18;
 const existing=E.occupant(s,point.x,point.y);
 if(held){
  score+=dm===0?10000:dm===1?130+E.strength(u)*.5:dm===2?65:0;
 }else{
  score+=dm===1?200+E.strength(u)*2:dm===2?72:dm===3?25:0;
  if(target){const dt=nearest(c,point,target.position);
   score+=dt===1?125+E.strength(u)*2:dt===2?60:dt===3?10:0;
   if(dt===1){
    // Reward a player who makes a new CRT column possible on a ring screen.
    const before=allAdjacent(c,s,target).filter(a=>a.id!==u.id);
    const prior=before.length?E.battleOdds(c,s,before,target).odds:0;
    const after=E.battleOdds(c,s,[...before,u],target).odds;
    score+=(after-prior)*48+(prior===0&&after>0?65:0);
   }
  }
  // Small reward for secondary opportunities around the fortress.
  const threatened=ringPositions.filter(p=>{const o=E.occupant(s,p.x,p.y);return o?.army==='soviet'&&nearest(c,point,p)===1;}).length;
  score+=Math.min(2,threatened)*13;
 }
 if(E.hexAt(c,point.x,point.y)?.city==='normal')score+=3;
 if(E.hexAt(c,point.x,point.y)?.city==='major')score+=6;
 if(existing&&existing.id!==u.id)score-=500;
 return score;
}
function moveConcentration(c,s,mode){
 const m=moscow(c),held=s.control[k(m)]==='german',target=held?null:breachTarget(c,s);
 const candidates=E.units(s,'german').filter(u=>mode!=='panzer'||u.type==='tank');
 candidates.sort((a,b)=>{
  const da=nearest(c,a.position,target?.position||m),db=nearest(c,b.position,target?.position||m);
  return (mode==='panzer'?0:(a.type==='tank'? -1:0)-(b.type==='tank'?-1:0))||da-db||E.strength(b)-E.strength(a)||a.id.localeCompare(b.id);
 });
 const moved=[];
 for(const u of candidates){
  if(held&&u.position.x===m.x&&u.position.y===m.y)continue;
  let bestPoint=u.position,bestScore=candidatePositionScore(c,s,u,u.position,target);
  for(const move of E.legalMoves(c,s,u,mode)){
   const old=u.position;u.position={x:move.x,y:move.y};
   const score=candidatePositionScore(c,s,u,u.position,target);
   u.position=old;
   if(score>bestScore+0.1){bestScore=score;bestPoint={x:move.x,y:move.y};}
  }
  if((bestPoint.x!==u.position.x||bestPoint.y!==u.position.y)&&E.move(c,s,u.id,bestPoint.x,bestPoint.y,mode))moved.push(u.id);
 }
 s.log.push({t:s.turn,side:'german',type:'capital-concentration',mode,breach:target?.id||null,moved,assessment:combatSummary(c,s)});
 return moved;
}
function battleOptions(c,s){
 const m=moscow(c),us=E.units(s,'german'),bitById=new Map(us.map((u,i)=>[u.id,1<<i]));
 const choices=[];
 for(const d of E.units(s,'soviet')){
  const adj=allAdjacent(c,s,d);if(!adj.length)continue;
  const dd=nearest(c,d.position,m);if(dd>2)continue;
  const atM=dd===0,onRing=dd===1;
  const source=E.hexAt(c,d.position.x,d.position.y);
  const options=[];
  for(let mask=1;mask<(1<<adj.length);mask++){
   const aa=adj.filter((_,i)=>(mask>>i)&1),b=E.battleOdds(c,s,aa,d);if(b.odds<1)continue;
   const crt=c.profile.crtByOdds[String(b.odds)];
   const vacateProbability=crt.filter(out=>out==='DR'||out==='DRL'||out==='EX'||out==='DE').length/6;
   const favorable=crt.filter(out=>out==='DR'||out==='DRL'||out==='DE').length/6;
   const cost=aa.reduce((n,u)=>n+E.strength(u),0);
   const score=(atM?850:onRing?220:34)+b.odds*35+vacateProbability*(atM?230:75)+favorable*45 - aa.length*3 - cost*.3 + (source?.terrain==='fortification'&&onRing?24:0);
   const ids=aa.map(u=>u.id),bits=ids.reduce((n,id)=>n|bitById.get(id),0);
   options.push({defender:d.id,attackers:ids,bits,odds:b.odds,score,atM,onRing});
  }
  options.sort((a,b)=>b.score-a.score||a.attackers.length-b.attackers.length);
  // Keep different attacker masks as alternative allocations to other battles.
  choices.push({defender:d.id,choices:options.slice(0,12),priority:atM?0:onRing?1:2});
 }
 choices.sort((a,b)=>a.priority-b.priority||a.defender.localeCompare(b.defender));
 return choices;
}
function planBattles(c,s){
 const perDefender=battleOptions(c,s);
 // Bounded beam search for disjoint simultaneous declarations. No unit can be
 // committed to two attacks. The no-attack branch is retained for each target.
 let beam=[{used:0,score:0,declared:[]}];
 for(const entry of perDefender){
  let next=[];
  for(const row of beam){
   next.push(row);
   for(const opt of entry.choices){if(row.used&opt.bits)continue;
    next.push({used:row.used|opt.bits,score:row.score+opt.score,declared:[...row.declared,{defender:opt.defender,attackers:opt.attackers,declaredOdds:opt.odds}]});
   }
  }
  next.sort((a,b)=>b.score-a.score||a.declared.length-b.declared.length);
  const unique=new Set();beam=[];
  for(const row of next){let id=`${row.used}/${row.declared.map(v=>v.defender).sort().join(',')}`;if(unique.has(id))continue;unique.add(id);beam.push(row);if(beam.length>=36)break;}
 }
 return beam[0]?.declared||[];
}
function resolveCapitalBattles(c,s,declared){
 // Original source requires all attack declarations before resolution; do not
 // choose participants adaptively based on already-revealed dice.
 s.log.push({t:s.turn,side:'german',type:'combat-declaration',battles:JSON.parse(JSON.stringify(declared))});
 const events=[];
 for(let i=0;i<declared.length;i++){
  const a=declared[i],reserved=new Set(declared.slice(i+1).flatMap(v=>v.attackers));
  // Choose the strongest surviving participant for advance into Moscow, and
  // otherwise a durable participant for a screen breach.
  const possible=a.attackers.map(id=>s.units.find(u=>u.id===id)).filter(u=>u&&E.strength(u)>0&&!reserved.has(u.id));
  possible.sort((a,b)=>E.strength(b)-E.strength(a));
  const options={avoidAdvanceIds:[...reserved],advanceId:possible[0]?.id||'none'};
  const result=E.resolveAttack(c,s,a.attackers,a.defender,null,options);
  if(result)events.push(result);
 }
 return events;
}
function playCapitalSide(c,base,originalPolicy='adaptive'){
 if(base.side!=='german')throw Error('Capital planner requires German-to-move state');
 let s=JSON.parse(JSON.stringify(base));if(s.over)return s;
 if(s.phase==='setup')E.autoSetup(c,s);
 E.doReplacements(c,s,originalPolicy);
 if(s.turn>1)moveConcentration(c,s,'panzer');
 const declared=planBattles(c,s);
 resolveCapitalBattles(c,s,declared);
 moveConcentration(c,s,'normal');
 s.log.push({t:s.turn,side:'german',type:'capital-plan-end',declared:declared.length,policy:originalPolicy,assessment:combatSummary(c,s)});
 E.endSide(c,s);E.validate(c,s);return s;
}
// Controlled comparison: same historical deployment, same turns 1-4, same
// Soviet policy. Replace *only* the German tactical selector starting at turn 5.
function playFromOpening(c,s,g='G2',so='S2',options={}){
 if(s.side==='german'&&s.turn>=(options.beginTurn||5))return playCapitalSide(c,s,B.selectedPolicy(s,B.get('german',g)));
 return B.play(c,s,g,so);
}
function run(c,seed=7041,g='G2',so='S2',options={}){
 let s=B.setup(c,g,seed,options.deploymentSeed||0);
 while(!s.over&&s.ply<14)s=playFromOpening(c,s,g,so,options);
 return s;
}
return {combatSummary,breachTarget,moveConcentration,battleOptions,planBattles,resolveCapitalBattles,playCapitalSide,playFromOpening,run};
});
