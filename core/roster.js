/* Shared scenario roster contract, v1.  Source identity is not playable identity.
 * Browser / CommonJS compatible; read-only source adaptation until engine migration.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameRoster=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const fail=message=>{throw new Error('Roster: '+message);};
function normalize(record){
 const r=copy(record);
 return {schemaVersion:1,id:r.id,scenario:r.scenario,sourceKind:r.sourceKind,sourceKey:r.sourceKey||null,
 historicalUnitId:r.historicalUnitId??null,side:r.side||null,nationality:r.nationality||null,unitClass:r.unitClass||null,
 artwork:r.artwork||{front:null,back:null,display:null,singleSided:false,colors:null},
 characteristics:r.characteristics||null,deployment:r.deployment||{kind:'unverified'},
 executable:r.executable===true,evidence:r.evidence||null,rawRef:r.rawRef||null};
}
function validate(units,options={}){
 const errors=[],ids=new Set(),faces=new Set();
 for(const r of units){
  if(r.schemaVersion!==1)errors.push('Unsupported schema for '+r.id);
  if(!r.id||typeof r.id!=='string'||ids.has(r.id))errors.push('Missing or duplicate ID '+r.id);
  ids.add(r.id);
  if(!r.scenario||!r.sourceKind)errors.push('Missing scenario/source '+r.id);
  if(!r.artwork||!r.artwork.display)errors.push('Missing display artwork '+r.id);
  if(r.artwork?.singleSided&&r.artwork.back!==null&&r.artwork.front!==null)errors.push('Single-sided unit has two artwork faces '+r.id);
  if(r.executable&&(!r.side||!r.characteristics||!r.deployment||r.deployment.kind==='unverified'))errors.push('Incomplete executable unit '+r.id);
  if(r.executable&&r.characteristics?.combatFull==null&&r.characteristics?.specialState==null)errors.push('No executable strength/state '+r.id);
  if(r.sourceKind==='printed-pair'&&r.executable)errors.push('Printed-pair identity cannot be executable without roster corroboration '+r.id);
  if(r.artwork?.display){const k=r.scenario+'|'+r.artwork.display;if(faces.has(k)&&!options.allowSharedFaces)errors.push('Duplicate display face '+k);faces.add(k);}
 }
 return {ok:errors.length===0,errors,count:units.length,executable:units.filter(r=>r.executable).length};
}
function fromB4M(units,sourceFaces){
 const faces=[...(sourceFaces.faces?.front||[]),...(sourceFaces.faces?.back||[])];
 const byId=new Map(faces.map(f=>[f.faceId,f]));
 const result=units.units.map(u=>{
  const front=u.counter?.sourceFaces?.front||null,back=u.counter?.sourceFaces?.back||null;
  if(!front||!back||!byId.has(front)||!byId.has(back))fail('B4M missing source faces '+u.id);
  if(byId.get(front).unitId!==u.id||byId.get(back).unitId!==u.id)fail('B4M printed ID mismatch '+u.id);
  return normalize({id:'battle-for-moscow/'+u.id,scenario:'battle-for-moscow',sourceKind:'canonical-engine-unit',sourceKey:u.id,
   historicalUnitId:u.id,side:u.army,unitClass:u.type,artwork:{front,back,display:u.strength==='reduced'?back:front,singleSided:false,colors:copy(u.counter?.colors||null)},
   characteristics:{combatFull:u.combatFull,combatReduced:u.combatReduced,movement:u.movement,size:u.size,strength:u.strength},
   deployment:u.position?{kind:'fixed',position:copy(u.position)}:{kind:'engine-managed',pos:u.pos},executable:true,evidence:'games/battle-for-moscow/units.json',rawRef:u.id});
 });
 const v=validate(result);if(!v.ok)fail(v.errors.join('; '));return result;
}
function fromPrintedPairs(scenario,cfg){
 const faces=[...(cfg.faces?.front||[]),...(cfg.faces?.back||[])];const byId=new Map(faces.map(f=>[f.faceId,f]));
 const result=Object.entries(cfg.sourcePrintedUnitPairs||{}).map(([key,p])=>{
  const front=byId.get(p.front),back=byId.get(p.back);
  if(!front||!back||front.pairedFaceId!==p.back||back.pairedFaceId!==p.front)fail('Bad mirrored faces '+key);
  const trans=front.visualTranscription||{};
  return normalize({id:scenario+'/print/'+encodeURIComponent(key),scenario,sourceKind:'printed-pair',sourceKey:key,
   historicalUnitId:null,side:trans.printedAffiliation||null,unitClass:trans.kind||null,
   artwork:{front:p.front,back:p.back,display:p.front,singleSided:false,
    colors:{front:front.observedFieldColor||null,back:back.observedFieldColor||null}},
   characteristics:null,deployment:{kind:'unverified'},executable:false,
   evidence:'maps/counter-configs/'+scenario+'.json',rawRef:key});
 });
 const v=validate(result);if(!v.ok)fail(v.errors.join('; '));return result;
}
function fromOverlay(scenario,overlay,cfg){
 const faces=[...(cfg.faces?.front||[]),...(cfg.faces?.back||[])];const byId=new Map(faces.map(f=>[f.faceId,f]));
 const result=(overlay.units||[]).map(u=>{
  const face=byId.get(u.art?.displayFaceId),alternate=u.art?.alternateFaceId?byId.get(u.art.alternateFaceId):null;
  if(!face||u.art?.alternateFaceId&&!alternate)fail('Missing Odessa face '+u.id);
  if(u.art?.singleSided&&alternate)fail('Odessa single-sided unit given alternate face '+u.id);
  return normalize({id:u.id,scenario,sourceKind:'scenario-design',sourceKey:u.designKey,
   historicalUnitId:u.historicalUnitId??null,side:u.side,unitClass:u.class,
   artwork:{front:u.art.displayFaceId,back:alternate?alternate.faceId:null,display:u.art.displayFaceId,
    singleSided:!!u.art.singleSided,colors:{display:face.observedFieldColor||null,alternate:alternate?.observedFieldColor||null}},
   characteristics:null,deployment:copy(u.initial),executable:false,
   evidence:u.identityEvidence,rawRef:u.id});
 });
 const v=validate(result);if(!v.ok)fail(v.errors.join('; '));return result;
}
/* Reconcile a verified roster to the existing executable unit data without
 * reconstructing or guessing game attributes. A failed binding is atomic.
 * The legacy Oberlabs behavior remains the source of runtime semantics.
 */
function bindExecutable(roster,gameUnits,scenario){
 if(!Array.isArray(roster)||!Array.isArray(gameUnits))fail('Executable binding requires two unit arrays');
 const audit=validate(roster);
 if(!audit.ok)fail(audit.errors.join('; '));
 if(roster.some(u=>!u.executable))fail('Unverified roster cannot become executable');
 if(roster.length!==gameUnits.length)fail('Roster/game unit count mismatch');
 const sources=new Map();
 for(const u of roster){
  if(u.scenario!==scenario)fail('Scenario mismatch '+u.id);
  if(u.sourceKind!=='canonical-engine-unit'||!u.rawRef||u.sourceKey!==u.rawRef)fail('Missing executable unit provenance '+u.id);
  if(u.id!==scenario+'/'+u.rawRef)fail('Incorrect gameplay namespace '+u.id);
  if(sources.has(u.rawRef))fail('Duplicate executable source key '+u.rawRef);
  sources.set(u.rawRef,u);
 }
 const seen=new Set();
 for(const raw of gameUnits){
  if(!raw?.id||seen.has(raw.id))fail('Duplicate/empty gameplay unit ID '+raw?.id);
  seen.add(raw.id);
  const unit=sources.get(raw.id);
  if(!unit)fail('Missing executable roster source '+raw.id);
  const c=unit.characteristics||{};
  if(unit.side!==(raw.faction||raw.army)||unit.unitClass!==raw.type||
     c.combatFull!==raw.combatFull||c.combatReduced!==raw.combatReduced||
     c.movement!==raw.movement||c.size!==raw.size||c.strength!==raw.strength)
   fail('Executable attributes disagree '+raw.id);
  if(unit.artwork.front!==raw.counter?.sourceFaces?.front||
     unit.artwork.back!==raw.counter?.sourceFaces?.back||
     JSON.stringify(unit.artwork.colors)!==JSON.stringify(raw.counter?.colors||null))
   fail('Counter identity/color discrepancy '+raw.id);
  const expected=raw.position?{kind:'fixed',position:raw.position}:{kind:'engine-managed',pos:raw.pos};
  if(JSON.stringify(unit.deployment)!==JSON.stringify(expected))fail('Deployment mismatch '+raw.id);
 }
 return copy(gameUnits);
}
function compose(base,additions){const result=[...copy(base),...copy(additions)];const v=validate(result);if(!v.ok)fail(v.errors.join('; '));return result;}
function select(units,criteria={}){return units.filter(u=>Object.entries(criteria).every(([k,v])=>u[k]===v));}
return {normalize,validate,fromB4M,fromPrintedPairs,fromOverlay,compose,select,bindExecutable};
});
