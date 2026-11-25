/* Shared, source-constrained pregame deployment session (v404).
 * Placement/identity choices are validated by the SAME scenario setup and
 * inventory modules used by the campaign opening bridge. No scenario-ID
 * branching or alternative gameplay rules. A local browser cannot guarantee
 * adversarial secrecy of unrevealed counter faces.
 */
'use strict';
const crypto=require('node:crypto');
const Setup=require('./scenario_starting_setup');
const Bridge=require('./scenario_opening_bridge');
const Fixed=require('./historical_fixed_source_pieces');
const clone=x=>JSON.parse(JSON.stringify(x));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const FORMAT='historical-source-deployment',VERSION=1;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function make(source,allocation,placements,mixed=false){
 if(typeof mixed!=='boolean')throw Error('Invalid concealed-counter mixing status');
 const concealed=source.setupSpec?.concealedSetup;
 if(concealed&&(!Array.isArray(concealed.groups)||!concealed.groups.length||!Number.isInteger(concealed.count)||concealed.count<1))
  throw Error('Invalid scenario-configured concealed setup');
 const {map,setupSpec,counterConfig,inventory,phaseConfig,movementProfile,phaseFactories,supportPolicy,fixedPolicy}=source;
 if(!map||!setupSpec||!counterConfig||!inventory||!phaseConfig||!movementProfile)
  throw Error('Source-verified deployment configuration required');
 const checked=Setup.validate({map,spec:setupSpec,counterConfig,inventory,allocation,placements});
 if(!checked.valid)throw Error('Illegal historical deployment: '+checked.errors.join('; '));
 const alloc=clone(allocation),pos=clone(placements);
 const preview=fixedPolicy?Fixed.initialize({map,counterConfig,policy:fixedPolicy,state:checked.state}).state:checked.state;
 const slotList=Setup.slots(map,setupSpec).slots;
 const groupByFace=new Map();
 for(const [g,ids] of Object.entries(alloc))if(own(setupSpec.groups,g))for(const id of ids)groupByFace.set(id,g);
 const allFaces=new Map(counterConfig.faces.front.map(f=>[f.faceId,f]));
 function choices(id){
  const group=groupByFace.get(id);if(!group)throw Error('Not a starting source counter '+id);
  const g=setupSpec.groups[group];
  // A symbol shared by multiple armies is not a universal placement region.
  // Example: Kiev's 11 Axis crosses comprise separate Polish and Romanian
  // setup groups. Do not advertise foreign-country hexes as destinations.
  const allowed=g.allowedHexes?new Set(g.allowedHexes):null;
  return slotList[g.marker].map(x=>x.hex).filter(id=>!allowed||allowed.has(id)).sort();
 }
 function move(id,to){
  if(!groupByFace.has(id))throw Error('Not a starting source counter');
  if(!choices(id).includes(to))throw Error('Destination is not a source-approved deployment marker');
  const proposed=clone(pos);proposed[id]=to;
  return make(source,alloc,proposed,mixed);
 }

 function swapPositions(a,b){
  if(a===b||!groupByFace.has(a)||!groupByFace.has(b))throw Error('Two distinct starting units required');
  const groupA=setupSpec.groups[groupByFace.get(a)],groupB=setupSpec.groups[groupByFace.get(b)];
  if(groupA.marker!==groupB.marker)throw Error('Starting units must use the same deployment marker');
  const proposed=clone(pos);proposed[a]=pos[b];proposed[b]=pos[a];
  return make(source,alloc,proposed,mixed);
 }
 function swapFaces(a,b){
  if(typeof a!=='string'||typeof b!=='string'||a===b||!allFaces.has(a)||!allFaces.has(b))
   throw Error('Two distinct source-face identities required');
  const next=clone(alloc),locA=pos[a],locB=pos[b];
  let foundA=0,foundB=0;
  for(const ids of Object.values(next))for(let i=0;i<ids.length;i++){
   if(ids[i]===a){ids[i]=b;foundA++}else if(ids[i]===b){ids[i]=a;foundB++}
  }
  if(foundA!==1||foundB!==1)throw Error('Both faces must have exactly one source allocation');
  const proposed=clone(pos);delete proposed[a];delete proposed[b];
  if(locA!==undefined)proposed[b]=locA;
  if(locB!==undefined)proposed[a]=locB;
  return make(source,next,proposed,mixed);
 }
 function permute(groupNames,newOrder){
  if(!Array.isArray(groupNames)||!groupNames.length||!Array.isArray(newOrder))throw Error('Explicit groups and permutation required');
  const old=groupNames.flatMap(g=>{
   if(!(own(setupSpec.groups,g)||own(inventory.policy?.groups||{},g))||!Array.isArray(alloc[g]))throw Error('Invalid source deployment group');
   return alloc[g];
  });
  if(newOrder.length!==old.length||new Set(newOrder).size!==old.length||
    !equal([...newOrder].sort(),[...old].sort()))throw Error('Permutation must use exactly the source-deployed counters');
  const next=clone(alloc),proposed=clone(pos);let index=0;
  for(const g of groupNames){next[g]=alloc[g].map(()=>newOrder[index++])}
  for(const id of old)delete proposed[id];
  for(let i=0;i<old.length;i++)if(own(pos,old[i]))proposed[newOrder[i]]=pos[old[i]];
  return make(source,next,proposed,concealed&&equal([...groupNames].sort(),[...concealed.groups].sort())&&old.length===concealed.count?true:mixed);
 }
 function commit({requireMixed=false}={}){
  if(requireMixed&&concealed?.requireMixBeforeCampaign&&!mixed)throw Error('The concealed source counters must be mixed before play');
  const bridge=Bridge.create({map,setupSpec,counterConfig,inventory,
   allocation:alloc,placements:pos,phaseConfig,movementProfile,
   phaseFactories:phaseFactories||{combat:()=>({})},supportPolicy,fixedPolicy});
  return Object.freeze({opening:bridge.snapshot(),allocation:clone(alloc),placements:clone(pos),audit:bridge.setupAudit()});
 }
 function save(){
  const payload={format:FORMAT,version:VERSION,scenarioId:setupSpec.scenarioId,allocation:clone(alloc),placements:clone(pos),concealedMixed:mixed};
  return {...payload,integrity:{algorithm:'SHA-256',digest:sha(payload)}};
 }
 return Object.freeze({choices,move,swapPositions,swapFaces,permute,commit,save,
  snapshot:()=>clone({allocation:alloc,placements:pos,units:preview.units,
   disagreements:checked.printedAnchorDisagreements,concealedMixed:mixed,valid:true}),
  groups:()=>clone(setupSpec.groups)});
}
function create(args={}){
 if(!object(args))throw Error('Source deployment inputs required');
 const {allocation,placements,...source}=args;
 return make(source,allocation,placements);
}
function restore(saved,source){
 if(!object(saved)||!object(saved.integrity)||saved.format!==FORMAT||saved.version!==VERSION||
  saved.integrity.algorithm!=='SHA-256'||typeof saved.integrity.digest!=='string'||
  !/^[a-f0-9]{64}$/.test(saved.integrity.digest)||
  Object.keys(saved).sort().join(',')!==['format','version','scenarioId','allocation','placements','concealedMixed','integrity'].sort().join(','))
  throw Error('Invalid deployment save');
 const {integrity,...payload}=saved;
 if(!crypto.timingSafeEqual(Buffer.from(integrity.digest,'hex'),Buffer.from(sha(payload),'hex')))
  throw Error('Deployment save checksum mismatch');
 if(saved.scenarioId!==source.setupSpec?.scenarioId)throw Error('Deployment source scenario mismatch');
 return make(source,saved.allocation,saved.placements,saved.concealedMixed);
}
module.exports=Object.freeze({FORMAT,VERSION,create,restore});
