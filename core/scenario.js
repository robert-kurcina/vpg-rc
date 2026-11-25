/* Universal scenario descriptor validator. Metadata contract; not a replacement gameplay resolver. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameScenario=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const statuses=new Set(['baseline-source','unmapped','source-bound-non-executable','pending-source-mapping']);
function validate(registry){
 if(!registry||registry.schemaVersion!==1||registry.contract!=='universal-scenario-domains-v1')throw Error('Unsupported scenario contract');
 if(!registry.policy?.oneEngine||!registry.policy?.onePresentationFramework||registry.policy?.defaultInheritance!=='forbidden'||!registry.policy?.typedModulesOnly)throw Error('Unsafe shared-engine policy');
 const domainKeys=Object.keys(registry.domains||{});
 if(domainKeys.length!==14||new Set(domainKeys).size!==14)throw Error('Invalid scenario domain catalog');
 const ids=new Set();
 for(const game of registry.games||[]){
  if(!game.id||ids.has(game.id))throw Error('Duplicate or missing scenario ID');ids.add(game.id);
  if(!['baseline-executable','historical-non-executable'].includes(game.mode))throw Error('Invalid executable mode '+game.id);
  if(JSON.stringify(Object.keys(game.domains||{}).sort())!==JSON.stringify(domainKeys.slice().sort()))throw Error('Missing/extra domains for '+game.id);
  for(const [key,d] of Object.entries(game.domains)){
   if(!d||!statuses.has(d.status))throw Error('Unrecognized domain status '+game.id+'/'+key);
   if(d.source!==null&&(typeof d.source!=='string'||!d.source))throw Error('Invalid source '+game.id+'/'+key);
   if((d.status==='baseline-source'||d.status==='source-bound-non-executable')&&!d.source)throw Error('Missing source '+game.id+'/'+key);
   if(d.status==='pending-source-mapping'&&d.source!==null)throw Error('Unexpected unverified source '+game.id+'/'+key);
  }
 }
 for(const game of registry.games){
  if(game.extends&&(!ids.has(game.extends)||game.extends===game.id))throw Error('Invalid scenario extension '+game.id);
  for(const d of Object.values(game.domains))if(d.inherits&&d.inherits!==game.extends)throw Error('Inconsistent overlay inheritance '+game.id);
 }
 return true;
}
function get(registry,id){validate(registry);const game=registry.games.find(g=>g.id===id);if(!game)throw Error('Unknown scenario '+id);return game;}
function requireExecutable(registry,id){const game=get(registry,id);if(game.mode!=='baseline-executable')throw Error('Scenario not executable: '+id);return game;}
return {validate,get,requireExecutable};
});
