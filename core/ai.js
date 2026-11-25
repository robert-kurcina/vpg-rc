/* Rules-safe generic side-turn executor. Uses current game configuration;
   does not infer legality or modify combat, phase, victory or exception rules.
   Strategy is a baseline heuristic, not a certified competitive opponent. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameAI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function playSide(E,g,s,{maxPhases=32,minAttackOdds=1}={}){
 if(!E||!g||!s)throw Error('Missing AI adapter, game or state');
 if(s.over)return {side:s.side,phases:0,moves:0,combats:0,replacements:0,finished:true};
 const initialSide=s.side,turn=s.turn;let steps=0,moves=0,combats=0,replacements=0;
 while(!s.over&&s.side===initialSide&&steps++<maxPhases){
  const p=E.currentPhase(g,s);
  if(!p)throw Error('Missing phase for '+initialSide);
  if(p.kind==='replacement'){
   for(let i=0;i<24;i++){
    const opts=E.replacementOptions(g,s);
    if(!opts.length)break;
    if(!E.applyReplacement(g,s,opts.find(c=>c.type==='restore')||opts[0]))break;
    replacements++;
   }
  }else if(p.kind==='move'){
   const controlGoals=(g.objectives.points||[]).filter(x=>x.type==='control').map(x=>x.cell);
   const ownUnits=s.units.filter(u=>u.position&&!E.support(u)&&E.unitSide(u)===s.side);
   for(const u of ownUnits){
    let destinations=E.legalMoves(g,s,u.id);
    if(!destinations.length)continue;
    // Navigate toward scenario-authored VP goals, never arbitrary named cities.
    if(controlGoals.length)destinations=destinations.sort((a,b)=>{
      const evalDest=d=>Math.min(...controlGoals.map(t=>E.distance(d.x,d.y,t[0],t[1])))+(d.cost||0)*.04;
      return evalDest(a)-evalDest(b)||a.x-b.x||a.y-b.y;
    });
    const dst=destinations[0];if(dst&&E.move(g,s,u.id,dst.x,dst.y))moves++;
   }
  }else if(p.kind==='combat'){
   const enemies=s.units.filter(u=>u.position&&!E.support(u)&&E.unitSide(u)!==s.side);
   for(const d of enemies){
    const candidates=s.units.filter(u=>u.position&&!E.support(u)&&E.unitSide(u)===s.side&&E.distance(u.position.x,u.position.y,d.position.x,d.position.y)===1&&!s.committed.includes(u.id));
    const seen=new Set();const attackerIds=candidates.filter(u=>{const key=`${u.position.x},${u.position.y}`;if(seen.has(key))return false;seen.add(key);return true;}).map(u=>u.id);
    if(attackerIds.length&&E.combatOdds(g,s,attackerIds,d.id)?.odds>=minAttackOdds){
      if(p.declarationMode==='simultaneous'){
       if(!attackerIds.some(id=>s.declarations.some(a=>a.attackers.includes(id)))&&E.declareCombat(g,s,attackerIds,d.id))combats++;
      }else if(E.combat(g,s,attackerIds,d.id))combats++;
    }
   }
   if(p.declarationMode==='simultaneous'){
    E.lockDeclarations(g,s);
    let resolveSteps=0;while(s.declarations.length&&resolveSteps++<50){if(!E.resolveDeclared(g,s))throw Error('Unresolved declared battle');}
    if(s.declarations.length)throw Error('Combat resolution limit exceeded');
   }
  }
  if(!E.endPhase(g,s))throw Error('Phase did not advance: '+p.id);
  E.checkState(g,s);
 }
 if(!s.over&&s.side===initialSide)throw Error('AI side-turn exceeded phase limit');
 return {side:initialSide,turn,phases:steps,moves,combats,replacements,finished:s.over,winningSide:s.over?s.winner:null};
}
return {playSide};
});
