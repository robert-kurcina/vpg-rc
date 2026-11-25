/* Battle for Moscow v1.0: learning from completed games and legal counterfactual forks.
   No change to game rules. Training explicitly groups by seed to prevent leakage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B4MOutcomeLearning=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const E=typeof B4MEngine!=='undefined'?B4MEngine:require('./engine.js');
const B=typeof B4MOpeningBook!=='undefined'?B4MOpeningBook:require('./opening-book.js');
const G=B.ids('german'),S=B.ids('soviet');
const clone=x=>JSON.parse(JSON.stringify(x));
const payoff=x=>x==='german'?1:x==='draw'?.5:0;
function cleanRows(rows){
 if(!Array.isArray(rows))throw Error('Expected an array of game results');
 const seen=new Map();
 for(const r of rows){if(!r||r.complete!==true||r.adaptiveBook===true||r.ply!==14||!G.includes(r.germanId)||!S.includes(r.sovietId)||!Number.isInteger(r.seed)||!['german','soviet','draw'].includes(r.winner))continue;
  if(!r.ruleset||r.ruleset==='oberlabs_2009_web')seen.set(`${r.seed}:${r.deploymentSeed||0}:${r.germanId}:${r.sovietId}`,r);
 }
 return [...seen.values()].sort((a,b)=>a.seed-b.seed||a.germanId.localeCompare(b.germanId)||a.sovietId.localeCompare(b.sovietId));
}
function train(rows, opts={}){
 const clean=cleanRows(rows),prior=Math.max(.01,Number(opts.prior??2)),risk=Math.min(1,Math.max(0,Number(opts.risk??.65)));
 const cells=G.map(g=>S.map(s=>{
  const rs=clean.filter(r=>r.germanId===g&&r.sovietId===s);
  const sum=rs.reduce((a,r)=>a+payoff(r.winner),0);
  return {germanId:g,sovietId:s,count:rs.length,wins:rs.filter(r=>r.winner==='german').length,draws:rs.filter(r=>r.winner==='draw').length,losses:rs.filter(r=>r.winner==='soviet').length,observed:rs.length?sum/rs.length:null,smoothed:(sum+.5*prior)/(rs.length+prior)};
 })).flat();
 const ranking=G.map(g=>{
  const vs=cells.filter(c=>c.germanId===g),worst=vs.reduce((a,b)=>a.smoothed<b.smoothed?a:b);
  const average=vs.reduce((a,b)=>a+b.smoothed,0)/vs.length;
  return {germanId:g,observations:vs.reduce((a,b)=>a+b.count,0),worstSoviet:worst.sovietId,worstSmoothed:worst.smoothed,meanSmoothed:average,score:risk*worst.smoothed+(1-risk)*average};
 }).sort((a,b)=>(b.observations>0)-(a.observations>0)||b.score-a.score||a.germanId.localeCompare(b.germanId));
 const bySoviet=S.map(s=>({sovietId:s,bestGerman:cells.filter(c=>c.sovietId===s&&c.count>0).sort((a,b)=>b.smoothed-a.smoothed||a.germanId.localeCompare(b.germanId))[0]?.germanId||'G2',byGerman:cells.filter(c=>c.sovietId===s)}));
 const qualified=ranking.filter(x=>x.observations>=5);
 const recommended=qualified[0]?.germanId||'G2';
 return {games:clean.length,distinctSeeds:[...new Set(clean.map(r=>r.seed))].sort((a,b)=>a-b),prior,risk,recommended,ranking,cells,bySoviet,warning:clean.length<250?'Sparse observations: untested German variants are excluded from recommendation. No calibrated win probability.':''};
}
function crossValidateBySeed(rows,opts={}){
 const clean=cleanRows(rows),seeds=[...new Set(clean.map(r=>r.seed))].sort((a,b)=>a-b);let folds=[];
 for(const seed of seeds){const held=clean.filter(r=>r.seed===seed),training=clean.filter(r=>r.seed!==seed);if(!training.length)continue;
  const model=train(training,opts),byOpponent=[],recom=model.recommended;
  for(const sov of S){const available=held.filter(r=>r.sovietId===sov),chosen=available.find(r=>r.germanId===recom),fixed=available.find(r=>r.germanId==='G2');if(!chosen||!fixed)continue;
   const conditionalId=model.bySoviet.find(x=>x.sovietId===sov).bestGerman;
   const conditional=available.find(r=>r.germanId===conditionalId);
   byOpponent.push({sovietId:sov,globalOpening:recom,globalPayoff:payoff(chosen.winner),conditionalOpening:conditionalId,conditionalPayoff:conditional?payoff(conditional.winner):null,referenceOpening:'G2',referencePayoff:payoff(fixed.winner)});
  }
  folds.push({heldOutSeed:seed,trainingSeeds:model.distinctSeeds,globalOpening:recom,pairs:byOpponent});
 }
 const pairs=folds.flatMap(f=>f.pairs),avg=k=>pairs.length?pairs.reduce((n,p)=>n+(p[k]??0),0)/pairs.length:null;
 return {folds,heldOutPairs:pairs.length,globalMeanPayoff:avg('globalPayoff'),conditionalMeanPayoff:avg('conditionalPayoff'),fixedG2MeanPayoff:avg('referencePayoff'),warning:'Every fold excludes its entire held-out combat seed. Very few seeds: this is a diagnostic, not a win-rate forecast.'};
}
function trace(c,seed,germanId='G2',sovietId='S2'){
 let s=B.setup(c,germanId,seed),states=[],decisions=[];
 while(!s.over&&s.ply<14){states.push(clone(s));const policy=B.selectedPolicy(s,B.get(s.side,s.side==='german'?germanId:sovietId));decisions.push({ply:s.ply,side:s.side,turn:s.turn,policy});s=B.play(c,s,germanId,sovietId);E.validate(c,s);}
 return {seed,germanId,sovietId,states,decisions,final:B.summary(c,s,{seed,germanId,sovietId}),finalState:s};
}
function finishFrom(c,checkpoint,germanId,sovietId,firstPolicy,prngSeed=null,experimentalCombatSeed=null){
 let state=clone(checkpoint),initialSide=state.side,initialPly=state.ply;
 if(prngSeed!==null)state.seed=prngSeed>>>0||1;
 if(experimentalCombatSeed!==null)state.experimentalCombatSeed=experimentalCombatSeed>>>0||1;
 let first=E.playSide(c,state,firstPolicy);E.validate(c,first);
 const pivotEvents=first.log.slice(state.log.length).filter(e=>['move','combat','replacement','sweep-stage','shock-reinforcement'].includes(e.type));
 const afterPivot={moscowOwner:first.control['10,2'],moscowGarrison:E.occupant(first,10,2)?.id||null,germanDenied:E.sweepMetrics(c,first).germanDenied,moves:pivotEvents.filter(e=>e.type==='move').length,combats:pivotEvents.filter(e=>e.type==='combat').length,events:pivotEvents};
 let s=first;
 while(!s.over&&s.ply<14){s=B.play(c,s,germanId,sovietId);E.validate(c,s);}
 return {...B.summary(c,s),firstPolicy,initialSide,initialPly,afterPivot};
}
function fork(c,t,ply,alternatives,opts={}){
 const state=t.states[ply];if(!state||state.side!=='german')throw Error('Fork must begin on an existing German side-turn');
 const scheduled=t.decisions[ply].policy;
 const unique=[scheduled,...alternatives.filter(p=>p!==scheduled)].filter((p,i,a)=>a.indexOf(p)===i);
 const n=Math.max(1,Math.min(8,Math.floor(opts.samples??1)));
 const rows=[];
 for(let k=0;k<n;k++){
  // Same initial RNG state for each policy at a given fork. After actions diverge,
  // combat rolls are no longer necessarily coupled to identical battles.
  const rng=k===0?state.seed:(Math.imul(state.seed^(k*0x9e3779b9),1664525)+1013904223)>>>0||1;
  for(const policy of unique){const r=finishFrom(c,state,t.germanId,t.sovietId,policy,rng,opts.pairedDice?rng:null);rows.push({...r,trial:k,prngSeed:rng,germanPayoff:payoff(r.winner)});}
 }
 const baseline=rows.filter(x=>x.firstPolicy===scheduled),average=x=>x.reduce((n,r)=>n+r.germanPayoff,0)/x.length;
 const summaries=unique.map(p=>{const rs=rows.filter(x=>x.firstPolicy===p),wins=rs.filter(r=>r.winner==='german').length;return {policy:p,samples:rs.length,wins,draws:rs.filter(r=>r.winner==='draw').length,losses:rs.filter(r=>r.winner==='soviet').length,meanPayoff:average(rs),deltaVsScheduled:average(rs)-average(baseline),moscowHeldAfterSovietTurn:rs.filter(r=>r.moscowOwner==='german').length,meanGermanCities:rs.reduce((a,r)=>a+r.germanCities,0)/rs.length};});
 return {checkpointPly:ply,turn:state.turn,side:state.side,scheduledPolicy:scheduled,baselineWinner:t.final.winner,rows,summaries,pairedDice:!!opts.pairedDice,warning:opts.pairedDice?'Experimental encounter-keyed dice: identical turn/side/defender battles share a die across policies. Different battles, odds columns, and resulting board states still prevent a fully controlled causal comparison.':'Sequential PRNG: same initial state, but divergent numbers of battles change subsequent dice. Not a causal guarantee.'};
}
return {cleanRows,payoff,train,crossValidateBySeed,trace,finishFrom,fork};
});
