/* Battle for Moscow v1.1 -- conditional pivot doctrine.
   The Oberlabs rules engine is unchanged. This module only selects a legal,
   existing German side-turn policy using observable board-state features.
   Profiles are predeclared hypotheses, NOT policies proven by self-play. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B4MPivot=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const E=typeof B4MEngine!=='undefined'?B4MEngine:require('./engine.js');
const B=typeof B4MOpeningBook!=='undefined'?B4MOpeningBook:require('./opening-book.js');
const POLICIES={
  fixed:{name:'Fixed G2 opening book',description:'Baseline: G2 prescribed schedule'},
  guarded:{name:'Conditional infantry-relief pivot',description:'Requires credible Moscow proximity plus screen/relief before turn 6'},
  early:{name:'Early opportunity pivot',description:'Switches at lower screen and proximity thresholds'},
  late:{name:'Late screening pivot',description:'Requires heavier interdiction and keeps the screen longer'}
};
function features(c,s){const m=c.profile.victory.moscow,near=(radius,type)=>E.units(s,'german').filter(u=>(!type||u.type===type)&&E.dist(u.position.x,u.position.y,...m)<=radius).length;
 const metrics=E.sweepMetrics(c,s),holder=E.occupant(s,...m);
 const neighbors=E.neighbours(c,m[0],m[1]);
 const sovietScreen=E.units(s,'soviet').filter(u=>E.dist(u.position.x,u.position.y,...m)<=2).length;
 const occupiedAdjacent=neighbors.filter(h=>E.occupant(s,h.x,h.y)?.army==='german').length;
 return {turn:s.turn,remainingGermanTurns:Math.max(0,8-s.turn),moscowOwner:s.control[E.key(...m)],moscowGarrison:holder?.id||null,moscowGarrisonCF:holder?.army==='soviet'?E.strength(holder):0,
  germanAdjacent:occupiedAdjacent,germanNear2:near(2),panzerNear2:near(2,'tank'),panzerNear3:near(3,'tank'),infantryNear3:E.units(s,'german').filter(u=>u.type!=='tank'&&E.dist(u.position.x,u.position.y,...m)<=3).length,
  sovietScreen,suppressedEast:metrics.germanDenied,entryTotal:metrics.total,infantryEast:metrics.infantryEast,panzerEast:metrics.tanksEast,
  infantryScreenHexes:metrics.infantryBlockers,panzerScreenHexes:metrics.tankBlockers};}
function decide(c,s,profile='guarded'){
 if(s.side!=='german')throw Error('Conditional pivot only selects German side-turns');
 if(!POLICIES[profile])throw Error('Unknown pivot profile '+profile);
 const f=features(c,s);
 if(profile==='fixed')return {policy:B.selectedPolicy(s,B.get('german','G2')),reason:'fixed G2 schedule',features:f,profile};
 let policy=B.selectedPolicy(s,B.get('german','G2')),reason='retain scheduled southern sweep policy until a pivot condition is met';
 if(f.moscowOwner==='german') {policy='envelop';reason='reinforce captured Moscow and defend against recapture';}
 else if(f.turn<=2){policy='sweep';reason='first two turns: panzer breakthrough';}
 else if(f.turn>=7){policy='envelop';reason='last German chance to take and hold Moscow';}
 else if(f.turn>=6){
   if(profile==='late'&&f.suppressedEast<14&&f.panzerNear2<2){policy='sweep';reason='late profile maintains screen until late pivot prerequisites';}
   else{policy='envelop';reason='turn-6 urgency: capital outweighs further eastern coverage';}
 }else if(profile==='early'){
   if(f.turn>=3 && (f.panzerNear3>=2 || f.germanAdjacent>=1 || (f.suppressedEast>=7&&f.panzerNear3>=1))){policy='envelop';reason='early: exploitable capital approach';}
 }else if(profile==='guarded'){
   if(f.turn>=4 && ((f.panzerNear3>=2&&f.suppressedEast>=8) || (f.germanAdjacent>=2&&f.panzerNear2>=1) || (f.turn>=5&&f.panzerNear3>=2&&f.infantryEast>=1))){
     policy='envelop';reason='guarded: armoured approach with coverage or infantry relief';
   }
 }else if(profile==='late'){
   if(f.turn>=5&&f.panzerNear2>=2&&f.infantryEast>=2&&f.suppressedEast>=13){policy='envelop';reason='late: established screen and infantry relief';}
 }
 return {policy,reason,features:f,profile};
}
function play(c,base,germanId='G2',sovietId='S2',profile='guarded'){
 if(base.side==='soviet')return B.play(c,base,germanId,sovietId);
 const d=decide(c,base,profile),next=E.playSide(c,base,d.policy);E.validate(c,next);
 next.log.push({t:base.turn,side:'german',type:'pivot-decision',profile,policy:d.policy,reason:d.reason,features:d.features});
 return next;
}
function run(c,seed=1,germanId='G2',sovietId='S2',profile='guarded',onTurn){
 if(germanId!=='G2')throw Error('Controlled pivot comparisons require the same G2 German setup');
 let s=B.setup(c,germanId,seed),decisions=[];
 while(!s.over&&s.ply<14){let before=s,source=s.log.length;s=profile==='fixed'?B.play(c,s,germanId,sovietId):play(c,s,germanId,sovietId,profile);
  const d=s.log.slice(source).find(x=>x.type==='pivot-decision');if(d)decisions.push({turn:before.turn,policy:d.policy,reason:d.reason,features:d.features});
  if(onTurn)onTurn(s,decisions.at(-1));}
 return {...B.summary(c,s,{seed,germanId,sovietId,profile,ruleset:'oberlabs_2009_web'}),decisions};
}
// Explicit local sensitivity diagnostic. Compute *a German side-turn and a
// Soviet reply*, not a final victory forecast. User-triggered only.
function probe(c,s,sovietResponses=['fortress','screen']){
 if(s.side!=='german')throw Error('Probe requires German-to-move state');
 const variants=['sweep','envelop'];let rows=[];
 for(const policy of variants){const gs=E.playSide(c,s,policy);E.validate(c,gs);for(const soviet of sovietResponses){let after=gs.over?gs:E.playSide(c,gs,soviet);E.validate(c,after);let f=features(c,after);
  rows.push({policy,sovietResponse:soviet,score:E.strategicValue(c,after,'german'),moscowOwner:f.moscowOwner,panzerNear2:f.panzerNear2,entryDenied:f.suppressedEast,completed:after.over,winner:after.winner});}}
 return {turn:s.turn,scheduled:decide(c,s,'fixed').policy,conditional:decide(c,s,'guarded'),rows,warning:'One German side-turn and one Soviet response with shared initial RNG state; not a win probability or matched battle-level dice comparison.'};
}
return {POLICIES,features,decide,play,run,probe};
});
