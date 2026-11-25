/* Generic combat-declaration view model. No rules are evaluated here:
 * all candidates and chosen combinations are accepted only via WargameSession.legal.
 * Does not roll dice, mutate sessions, or depend on a scenario identifier.
 */
(function(root,factory){
 const E=(typeof module==='object'&&module.exports)?require('./engine.js'):root.WargameCore;
 const S=(typeof module==='object'&&module.exports)?require('./session.js'):root.WargameSession;
 const api=factory(E,S);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameNativeCombatUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E,S){
'use strict';
function adjacent(session,defenderId){
 const s=session?.state,g=session?.config;
 if(!g||!s||s.over||E.currentPhase(g,s)?.kind!=='combat'||s.declarationLocked)return [];
 const defender=s.units.find(u=>u.id===defenderId);
 if(!defender?.position||defender.strength==='dead'||E.unitSide(defender)===s.side||E.support(defender))return [];
 const used=new Set(s.declarations.flatMap(d=>d.attackers));
 return s.units.filter(u=>u.position&&u.strength!=='dead'&&!E.support(u)&&E.unitSide(u)===s.side&&!used.has(u.id)&&
  E.distance(u.position.x,u.position.y,defender.position.x,defender.position.y)===1).map(u=>u.id);
}
function legal(session,defenderId,attackers){
 if(!Array.isArray(attackers)||!attackers.length||new Set(attackers).size!==attackers.length)return false;
 const options=adjacent(session,defenderId);
 if(!attackers.every(id=>options.includes(id)))return false;
 return S.legal(session,{type:'declare-battle',defender:defenderId,attackers}).length>0;
}
function suggestions(session,defenderId,max=8){
 const ids=adjacent(session,defenderId);
 if(ids.length>12)return {options:[],total:0,manualOnly:true};
 const options=[];
 for(let mask=1;mask<(1<<ids.length);mask++){
  const attackers=ids.filter((_,i)=>mask&(1<<i));
  if(!legal(session,defenderId,attackers))continue;
  const odds=E.combatOdds(session.config,session.state,attackers,defenderId)?.odds??null;
  options.push({defender:defenderId,attackers,odds});
 }
 options.sort((a,b)=>(b.odds??-1)-(a.odds??-1)||a.attackers.length-b.attackers.length||a.attackers.join(',').localeCompare(b.attackers.join(',')));
 return {options:options.slice(0,max),total:options.length,manualOnly:false};
}
return {adjacent,legal,suggestions};
});
