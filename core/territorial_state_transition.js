/* Optional source-qualified territory lifecycle: immutable annexation state.
 * The candidate 261-hex Odessa graph has NO certified country coverage;
 * this module cannot authorize or fabricate missing country boundaries.
 */
(function(root,factory){
 const Rules=typeof module==='object'&&module.exports?require('./movement_rules.js'):root.WargameMovementRules;
 const api=factory(Rules);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameTerritorialStateTransition=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Rules){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 function commit({profile,board,state}={}){
  if(!profile||!board||!state||!state.units||typeof state.units!=='object'||Array.isArray(state.units))
   return {ok:false,reason:'invalid-territorial-commit-context'};
  if(!profile.territorialPolicy)return {ok:true,state,event:null};
  const status=Rules.bessarabiaAnnexation({profile,board,units:state.units,territory:state.territory});
  if(!status.ok)return {ok:false,reason:status.reason};
  const next=clone(state);next.territory=status.territory;
  return {ok:true,state:next,event:status.changed?{
   kind:'bessarabia-annexed',region:'bessarabia',permanent:true}:null};
 }
 function retreatStep({profile,board,state,unit,from,to}){
  const access=Rules.territorialAccess({profile,board,territory:state?.territory},unit,to,'retreat',from);
  if(access.ok)return true;
  if(['national-territory-exclusion','home-army-territory-restricted'].includes(access.reason))return false;
  throw Error('Retreat country identity/coverage unverified: '+access.reason);
 }
 return Object.freeze({commit,retreatStep});
});
