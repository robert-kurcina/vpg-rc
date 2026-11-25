/* Source-face inventory driven entirely by per-scenario counter-pool and
 * allocation configuration. Not a gameplay engine and never auto-selects units.
 * The caller supplies the counter sheets, allocation and the source rule policy.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameHistoricalSourceFaceInventory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const fail=m=>{throw Error('source-face-inventory: '+m);};
const clone=v=>JSON.parse(JSON.stringify(v));
function create(policy){
 if(!policy||policy.schemaVersion!==1||!policy.scenarioId||!policy.source||!policy.pools||!policy.groups||!Array.isArray(policy.groundPools))fail('invalid-policy');
 const pools=Object.entries(policy.pools),groups=Object.entries(policy.groups);
 for(const [name,p] of pools)if(!name||!p||!Number.isInteger(p.count)||p.count<1||!p.affiliation||
    !(typeof p.kind==='string'&&p.kind||Array.isArray(p.kinds)&&p.kinds.length>1&&p.kinds.every(k=>typeof k==='string'&&k)&&new Set(p.kinds).size===p.kinds.length)||
    typeof p.printedValuesPattern!=='string')fail('invalid-pool:'+name);
 for(const [name,g] of groups)if(!name||!g||!policy.pools[g.pool]||!Number.isInteger(g.count)||g.count<1)fail('invalid-group:'+name);
 function inspect(config){
  if(config?.mapId!==policy.scenarioId||!Array.isArray(config.faces?.front)||!Array.isArray(config.faces?.back))fail('counter-source-mismatch');
  const errors=[],fronts=config.faces.front,backs=new Map(config.faces.back.map(f=>[f.faceId,f]));
  const result=Object.fromEntries(pools.map(([n])=>[n,[]]));
  if(backs.size!==config.faces.back.length||new Set(fronts.map(f=>f.faceId)).size!==fronts.length)errors.push('Duplicate counter-face IDs');
  const paired=new Set();
  for(const face of fronts){
   const back=backs.get(face.pairedFaceId),t=face.visualTranscription||{};
   if(!back||back.pairedFaceId!==face.faceId||paired.has(face.pairedFaceId)){errors.push('Invalid face pairing '+face.faceId);continue;}
   paired.add(face.pairedFaceId);
   let matching=[];
   for(const [name,p] of pools){
    const rx=new RegExp(p.printedValuesPattern);
    if(t.printedAffiliation===p.affiliation&&(p.kinds?p.kinds.includes(t.kind):t.kind===p.kind)&&rx.test(t.printedValues||''))matching.push(name);
   }
   if(matching.length!==1){errors.push('Unclassified or ambiguous front face '+face.faceId);continue;}
   const name=matching[0],spec=policy.pools[name];
   if(spec.reverseKind && back.visualTranscription?.kind!==spec.reverseKind)errors.push('Reverse kind mismatch '+face.faceId);
   if(spec.reverseMatchesFrontKind===true&&back.visualTranscription?.kind!==t.kind)errors.push('Reverse kind does not match photographed front '+face.faceId);
   if(spec.reverseAffiliation && back.visualTranscription?.printedAffiliation!==spec.reverseAffiliation)errors.push('Reverse affiliation mismatch '+face.faceId);
   result[name].push(face.faceId);
  }
  if(paired.size!==backs.size)errors.push('Unpaired reverse faces');
  for(const [name,p] of pools)if(result[name].length!==p.count)errors.push('Wrong pool '+name+': '+result[name].length+' expected '+p.count);
  for(const name of policy.groundPools)if(!policy.pools[name])errors.push('Missing ground pool '+name);
  return Object.freeze({valid:errors.length===0,errors,counts:Object.fromEntries(pools.map(([n])=>[n,result[n].length])),pools:clone(result),historicalSetupAuthorized:false});
 }
 function validateAllocation(config,allocation){
  const scanned=inspect(config),errors=[...scanned.errors],seen=new Set();
  if(!allocation||typeof allocation!=='object'||Array.isArray(allocation))fail('allocation-required');
  for(const key of Object.keys(allocation))if(!policy.groups[key])errors.push('Unknown group '+key);
  for(const [name,g] of groups){
   const values=allocation[name];
   if(!Array.isArray(values)||values.length!==g.count){errors.push('Invalid count '+name);continue;}
   for(const id of values){
    if(!scanned.pools[g.pool]?.includes(id))errors.push('Invalid face for '+name+': '+id);
    const trans=config.faces.front.find(face=>face.faceId===id)?.visualTranscription;
    if(g.printedValuesPattern&&(!trans||!new RegExp(g.printedValuesPattern).test(trans.printedValues||'')))
     errors.push('Wrong rulebook strength for '+name+': '+id);
    if(g.printedKinds&&(!Array.isArray(g.printedKinds)||!g.printedKinds.includes(trans?.kind)))
     errors.push('Wrong rulebook unit kind for '+name+': '+id);
    if(seen.has(id))errors.push('Duplicated allocated face '+id);
    seen.add(id);
   }
  }
  for(const name of policy.groundPools)for(const id of scanned.pools[name])if(!seen.has(id))errors.push('Unallocated ground face '+id);
  return Object.freeze({valid:errors.length===0,errors,allGroundAssigned:errors.length===0,sourceRule:policy.source,historicalSetupAuthorized:false});
 }
 return Object.freeze({inspect,validateAllocation,policy:clone(policy)});
}
return Object.freeze({create});
});
