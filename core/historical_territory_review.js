/* Shared diagnostic-only territory review model. The original source markers
 * are immutable; manual labels are evidence proposals, never gameplay policy.
 * No scenario-specific branches, inferred borders, or automatic classification.
 */
(function(root,factory){
 const SHA=typeof module==='object'&&module.exports?require('./sync_sha256'):root.WargameSyncSha256;
 const api=factory(SHA);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalTerritoryReview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(SHA){'use strict';
 const FORMAT='wargame-territory-review-draft',VERSION=2;
 const citationText=x=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=500&&!/[\x00-\x08\x0b-\x1f\x7f]/.test(x);
 const sorted=x=>Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)));
 const STATES=['romanian','outside','unreviewed'];
 const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const exact=(v,keys)=>isObject(v)&&Object.keys(v).sort().join('|')===keys.slice().sort().join('|');
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function create({map,setup,config}={}){
  if(!map||!setup||!config||!Array.isArray(map.cells)||map.cells.length===0||
   config.schemaVersion!==1||config.scenarioId!==setup.scenarioId||
   map.id!==config.mapId||map.sourceGame!==config.sourceGame||
   !/^[a-f0-9]{64}$/.test(config.sourceRuleSha256)||
   !/^[a-f0-9]{64}$/.test(map.sourceImageSHA256||'')||
   !/^[a-f0-9]{64}$/.test(map.definitiveTerrainAudit?.sourceSvgSha256||'')||
   !['positiveSetupGroups','negativeSetupGroups'].every(k=>Array.isArray(config[k])&&config[k].length))
   throw Error('Territory source context is incomplete');
  const ids=map.cells.map(c=>c.id).sort();
  if(new Set(ids).size!==ids.length||ids.some(x=>!/^[0-9]{4}$/.test(x)))throw Error('Invalid map cell inventory');
  const all=new Set(ids);
  function fromGroups(names){
   const results=new Set();
   for(const name of names){
    const g=setup.groups?.[name];
    if(!g||!Array.isArray(g.allowedHexes)||!g.allowedHexes.length)
     throw Error('Missing source-approved setup marker group: '+name);
    for(const hex of g.allowedHexes){if(!all.has(hex))throw Error('Source setup marker is not on map');results.add(hex);}
   }
   return [...results].sort();
  }
  const positive=fromGroups(config.positiveSetupGroups),negative=fromGroups(config.negativeSetupGroups);
  const plus=new Set(positive),minus=new Set(negative);
  if(positive.length!==config.expectedPositiveCount||negative.length!==config.expectedNegativeCount||
   positive.some(x=>minus.has(x))||setup.status?.includes('gameplay-authorized'))
   throw Error('Unreviewed or conflicting source territory markers');
  const source=Object.freeze({mapId:map.id,sourceGame:map.sourceGame,
   sourceImageSHA256:map.sourceImageSHA256,sourceSvgSHA256:map.definitiveTerrainAudit.sourceSvgSha256,
   rulebookSHA256:config.sourceRuleSha256,rulebookSection:config.rulebookSection});
  function controller(labels,citations={}){
   const assigned=Object.freeze({...labels}),references=Object.freeze({...citations});
   function classification(hex){
    if(!all.has(hex))throw Error('Unknown source hex');
    if(plus.has(hex))return {value:'romanian',evidence:'printed-Romanian-setup'};
    if(minus.has(hex))return {value:'outside',evidence:'printed-Polish-setup'};
    if(assigned[hex])return {value:assigned[hex],evidence:'manual-draft'};
    return {value:'unreviewed',evidence:'none'};
   }
   function stats(){
    const tally={romanian:0,outside:0,unreviewed:0,sourcePositive:positive.length,sourceNegative:negative.length,manual:Object.keys(assigned).length,total:ids.length};
    for(const hex of ids)tally[classification(hex).value]++;
    return {...tally,coverage:tally.unreviewed===0?'draft-complete-pending-independent-source-approval':'incomplete-draft',gameplayAuthorized:false};
   }
   function evidenceStats(){
    return {manual:Object.keys(assigned).length,cited:Object.keys(references).length,
     uncited:Object.keys(assigned).length-Object.keys(references).length,
     independentlyVerified:false,gameplayAuthorized:false};
   }
   function citation(hex){classification(hex);return references[hex]||null;}
   // Source locators document the reviewer's evidence. They never certify it.
   function set(hex,value){
    if(!all.has(hex)||!STATES.includes(value))throw Error('Invalid draft territory classification');
    if(plus.has(hex)||minus.has(hex))throw Error('Source-anchored territory marker cannot be edited');
    const next={...assigned},refs={...references};
    if(value==='unreviewed'){delete next[hex];delete refs[hex];}
    else {if(next[hex]&&next[hex]!==value)delete refs[hex];next[hex]=value;}
    return controller(next,refs);
   }
   function cite(hex,text){
    if(!all.has(hex)||!assigned[hex])throw Error('Only manually labeled hexes can have draft source citations');
    if(!citationText(text))throw Error('A source locator between 1 and 500 characters is required');
    return controller(assigned,{...references,[hex]:text.trim()});
   }
   function clearCitation(hex){
    if(!all.has(hex)||!assigned[hex])throw Error('Only manually labeled hexes can have draft source citations');
    const next={...references};delete next[hex];return controller(assigned,next);
   }
   function snapshot(){return {source:clone(source),sourcePositive:[...positive],sourceNegative:[...negative],labels:clone(assigned),citations:clone(references),stats:stats(),evidenceStats:evidenceStats(),status:'DIAGNOSTIC-DRAFT-ONLY-NOT-RULES'};}
   function exportDraft(){
    const payload={format:FORMAT,version:VERSION,source:clone(source),sourcePositive:[...positive],sourceNegative:[...negative],
     labels:sorted(assigned),citations:sorted(references),status:'UNAPPROVED-CANDIDATE-NOT-GAMEPLAY-POLICY',
     coverage:stats().coverage,gameplayAuthorized:false};
    return {...payload,integrity:{algorithm:'SHA-256',digest:SHA.sha256(JSON.stringify(payload))}};
   }
   return Object.freeze({classification,set,cite,clearCitation,citation,stats,evidenceStats,snapshot,exportDraft,reset:()=>controller({})});
  }
  function restore(saved){
   const v2=saved?.version===VERSION,legacy=saved?.version===1;
   const keys=['format','version','source','sourcePositive','sourceNegative','labels','status','coverage','gameplayAuthorized','integrity'];
   if(!(v2||legacy)||!exact(saved,v2?[...keys,'citations']:keys)||
    saved.format!==FORMAT||saved.status!=='UNAPPROVED-CANDIDATE-NOT-GAMEPLAY-POLICY'||
    saved.gameplayAuthorized!==false||!exact(saved.integrity,['algorithm','digest'])||
    saved.integrity.algorithm!=='SHA-256'||typeof saved.integrity.digest!=='string'||
    !/^[a-f0-9]{64}$/.test(saved.integrity.digest))throw Error('Not a territory review draft');
   const {integrity,...payload}=saved;
   if(SHA.sha256(JSON.stringify(payload))!==integrity.digest)throw Error('Territory draft checksum mismatch');
   if(!equal(saved.source,source)||!equal(saved.sourcePositive,positive)||!equal(saved.sourceNegative,negative)||
    !isObject(saved.labels)||(v2&&!isObject(saved.citations)))throw Error('Territory draft source provenance mismatch');
   const next={},refs={};
   for(const [hex,value] of Object.entries(saved.labels)){
    if(!all.has(hex)||plus.has(hex)||minus.has(hex)||!['romanian','outside'].includes(value))
     throw Error('Territory draft contains unapproved or source-anchored hex');
    next[hex]=value;
   }
   if(v2)for(const [hex,text] of Object.entries(saved.citations)){
    if(!Object.hasOwn(next,hex)||!citationText(text)||text!==text.trim())
     throw Error('Territory draft contains an invalid or unpaired source citation');
    refs[hex]=text;
   }
   const review=controller(next,refs);
   if(saved.coverage!==review.stats().coverage)throw Error('Territory draft coverage mismatch');
   return review;
  }
  return Object.freeze({create:()=>controller({}),restore,source:clone(source),ids:[...ids],positive:[...positive],negative:[...negative]});
 }
 return Object.freeze({FORMAT,VERSION,create});
});
