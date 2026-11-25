/* Read-only optional victory scoring from a declarative tournament ruleset.
 * Never selects a game mode, moves counters, changes city ownership or
 * adjudicates the standard end-of-campaign engine result.
 */
(function(root,factory){
 const E=(typeof module==='object'&&module.exports)?require('./engine.js'):root.WargameCore;
 const api=factory(E);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameNativeTournamentScoring=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E){
'use strict';
const id=(x,y)=>`${x},${y}`;
function fail(message){throw Error('Tournament scoring: '+message);}
function registeredCity(g,cell){
 if(!Array.isArray(cell)||cell.length!==2||!cell.every(Number.isInteger))fail('invalid city coordinate');
 const h=g.cells.get(id(...cell));
 if(!h||!h.city||h.city==='none')fail('scored city is missing: '+id(...cell));
 return h;
}
function validateNode(g,p,sides,depth=0){
 if(!p||typeof p!=='object'||depth>12)fail('invalid predicate or excessive nesting');
 if(p.type==='all'||p.type==='any'){
  if(!Array.isArray(p.children)||!p.children.length)fail('empty boolean predicate');
  p.children.forEach(c=>validateNode(g,c,sides,depth+1));return;
 }
 if(p.type==='not'){validateNode(g,p.child,sides,depth+1);return;}
 if(p.type==='controls'||p.type==='communicates'){
  if(!sides.includes(p.faction))fail('unknown predicate faction');
  registeredCity(g,p.cell);return;
 }
 fail('unsupported predicate '+p.type);
}
function validate(g,variant){
 if(!variant||variant.enabled!==false||variant.status!=='reference-scoring-only'||
    !['reserve-redeployment-not-implemented','candidate-redeployment-unverified'].includes(variant.setupStatus))fail('not a gated reference profile');
 const p=variant.profile,sides=g.game.factions.map(f=>f.id);
 if(p?.format!=='conditional-points-v1'||!Array.isArray(p.decisions)||!p.decisions.length||!Array.isArray(p.bonuses))
  fail('invalid scoring profile');
 if(!g.rules.specialRules.some(e=>e.module==='communication-path-v1'))fail('missing communication-path module');
 if(new Set(p.decisions.map(d=>d.id)).size!==p.decisions.length)fail('duplicate outcomes');
 if(!Array.isArray(variant.allowedOverlaps)||variant.allowedOverlaps.some(a=>!Array.isArray(a)||a.length<2||a.some(id=>!p.decisions.some(d=>d.id===id))||new Set(a).size!==a.length))
  fail('invalid rule-text overlap registration');
 for(const d of p.decisions){
  if(!/^[a-z0-9-]+$/.test(d.id||'')||!sides.includes(d.winner)||!Number.isInteger(d.points)||d.points<0)fail('invalid outcome');
  validateNode(g,d.if,sides);
 }
 for(const b of p.bonuses){
  if(!/^[a-z0-9-]+$/.test(b.id||'')||!sides.includes(b.side)||!sides.includes(b.beneficiary)||
     typeof b.unitType!=='string'||!b.unitType||!Number.isInteger(b.points)||b.points<0||
     !Number.isInteger(b.fullSteps)||b.fullSteps<=0||!Number.isInteger(b.reducedSteps)||b.reducedSteps<=0||
     [b.minSteps,b.maxSteps].filter(v=>v!==undefined).length!==1||
     (b.minSteps??b.maxSteps)<0||!Number.isInteger(b.minSteps??b.maxSteps))fail('invalid step bonus');
 }
 if(new Set(p.bonuses.map(b=>b.id)).size!==p.bonuses.length)fail('duplicate bonuses');
 return p;
}
function read(g,s,variant=g.objectives?.tournamentVariant){
 const p=validate(g,variant),sides=g.game.factions.map(f=>f.id),connections={};
 const link=(side,cell)=>{
  const k=side+':'+id(...cell);
  if(!(k in connections))connections[k]=E.communication(g,s,{position:{x:cell[0],y:cell[1]},faction:side},side,
   {ignoreCapitalException:true});
  return connections[k];
 };
 function check(predicate){
  switch(predicate.type){
   case 'all':return predicate.children.every(check);
   case 'any':return predicate.children.some(check);
   case 'not':return !check(predicate.child);
   case 'controls':return s.control[id(...predicate.cell)]===predicate.faction;
   case 'communicates':return link(predicate.faction,predicate.cell);
   default:fail('invalid predicate during evaluation');
  }
 }
 // Do not impose a priority that the published Tournament Rules do not state:
 // German minor and Soviet minor overlap when Soviet-controlled Moscow is cut
 // off. Without the original executable we may present *eligible* outcomes,
 // but must not silently select a winner or total the primary scores.
 const matched=p.decisions.filter(d=>check(d.if));
 if(!matched.length)fail('no matching tournament outcome (incomplete city control)');
 const ambiguous=matched.length!==1;
 if(ambiguous){
  const sig=a=>[...a].sort().join('|'),key=sig(matched.map(d=>d.id));
  if(!variant.allowedOverlaps.some(a=>sig(a)===key))fail('unregistered overlapping outcomes');
 }
 const primary=ambiguous?null:matched[0],scores=ambiguous?null:Object.fromEntries(sides.map(side=>[side,0]));
 if(primary)scores[primary.winner]+=primary.points;
 const bonusPoints=Object.fromEntries(sides.map(side=>[side,0]));
 const bonuses=[],steps={},stepCounts=[];
 for(const b of p.bonuses){
  const k=b.side+':'+b.unitType+':'+b.fullSteps+':'+b.reducedSteps;
  if(!(k in steps)){
   steps[k]=s.units.filter(u=>E.unitSide(u)===b.side&&u.type===b.unitType&&u.position&&u.strength!=='dead'&&!E.support(u))
    .reduce((n,u)=>n+(u.strength==='full'?b.fullSteps:u.strength==='reduced'?b.reducedSteps:0),0);
   stepCounts.push({side:b.side,unitType:b.unitType,count:steps[k]});
  }
  const count=steps[k];
  if(b.minSteps!==undefined?count>=b.minSteps:count<=b.maxSteps){
   if(scores)scores[b.beneficiary]+=b.points;bonusPoints[b.beneficiary]+=b.points;
   bonuses.push({id:b.id,side:b.beneficiary,points:b.points});
  }
 }
 return {status:'reference-only',adjudicated:false,observedAtStandardTerminal:!!s.over,ambiguous,
  primary:primary?{id:primary.id,side:primary.winner,points:primary.points}:null,
  eligible:matched.map(d=>({id:d.id,side:d.winner,points:d.points})),
  points:scores,bonusPoints,bonuses,stepCounts,connections,
  setupAvailable:false,gameplayEnabled:false};
}
return {validate,read};
});
