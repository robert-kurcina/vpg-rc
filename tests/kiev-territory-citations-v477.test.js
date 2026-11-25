'use strict';
/* Checkpoint 243 / v477: territory-review evidence attribution, NOT a claim of
 * country-boundary certification or permission to activate Kiev gameplay. */
const A=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const SHA=require('../core/sync_sha256');
const Review=require('../core/historical_territory_review');
const Graph=require('../core/map_movement_graph');
const map=require('../maps/kiev.json');
const setup=require('../maps/setup/kiev.json');
const cfg=require('../tools/territory-review/kiev.json');
const combat=require('../maps/combat-configs/kiev.json');
const manifest=require('../PACKAGE_MANIFEST.json');
let n=0;
const eq=(a,b,msg)=>{A.deepEqual(a,b,msg);n++;};
const yes=(a,msg)=>{A.ok(a,msg);n++;};
const bad=(f,re,msg)=>{A.throws(f,re,msg);n++;};
const clone=x=>JSON.parse(JSON.stringify(x));
const checksum=o=>SHA.sha256(JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k])=>k!=='integrity'))));
const model=Review.create({map,setup,config:cfg});
let r=model.create();
eq(Review.VERSION,2,'citation-capable format version');
eq(r.stats().unreviewed,154,'no invented classification');
eq(r.evidenceStats(),{manual:0,cited:0,uncited:0,independentlyVerified:false,gameplayAuthorized:false});
eq(model.positive,['0709','0809','0910','1010']);
eq(model.negative,['0105','0203','0204','0301','0302','0303','0402']);
const target='0708';
for(const hex of [...model.positive,...model.negative]){
 bad(()=>r.cite(hex,'scan p1'),/Only manually labeled/,'source pins cannot be cited as manual evidence');
 bad(()=>r.set(hex,'outside'),/cannot be edited/,'source pins cannot be edited');
}
bad(()=>r.cite(target,'scan p1'),/Only manually labeled/,'unreviewed has no citation');
r=r.set(target,'romanian');
eq(r.citation(target),null);
eq(r.evidenceStats().uncited,1,'unsubstantiated draft visibly flagged');
r=r.cite(target,'  Original scan, south margin, boundary trace — reviewer note  ');
eq(r.citation(target),'Original scan, south margin, boundary trace — reviewer note');
eq(r.evidenceStats().cited,1);
eq(r.evidenceStats().uncited,0);
eq(r.stats().gameplayAuthorized,false,'citation must not authorize gameplay');
const before=r;
for(const candidate of ['', '  ', 'x'.repeat(501), 55, null, 'unsafe\u0000source']){
 bad(()=>r.cite(target,candidate),/source locator between/,'invalid citation rejected');
 eq(r.exportDraft(),before.exportDraft(),'invalid citation cannot modify model');
}
let saved=r.exportDraft();
eq(saved.version,2);
eq(saved.citations,{[target]:r.citation(target)});
eq(saved.integrity.digest,checksum(saved),'integrity includes citations');
eq(model.restore(saved).exportDraft(),saved,'v2 source citation roundtrip');
eq(model.restore(saved).evidenceStats().cited,1);
let tampered=clone(saved);tampered.citations[target]='Invented alternative evidence';
bad(()=>model.restore(tampered),/checksum mismatch/,'citation tampering detected');
tampered.integrity.digest=checksum(tampered);
eq(model.restore(tampered).stats().gameplayAuthorized,false,'digest alone is not historical source validation');
let forged=clone(saved);forged.citations['0709']='pretend pinned source';forged.integrity.digest=checksum(forged);
bad(()=>model.restore(forged),/unpaired source citation/,'citation cannot attach to source-pinned hex');
forged=clone(saved);forged.citations['0808']='uncited invented label';forged.integrity.digest=checksum(forged);
bad(()=>model.restore(forged),/unpaired source citation/,'citation must match a manual label');
forged=clone(saved);forged.citations[target]=''.padEnd(501,'a');forged.integrity.digest=checksum(forged);
bad(()=>model.restore(forged),/unpaired source citation/,'citation size validated on restore');
const opposite=r.set(target,'outside');
eq(opposite.classification(target).value,'outside');
eq(opposite.citation(target),null,'reversal must discard outdated evidence');
eq(opposite.evidenceStats().uncited,1);
eq(r.classification(target).value,'romanian','immutable predecessor survives');
const same=r.set(target,'romanian');
eq(same.citation(target),r.citation(target),'unchanged classification retains citation');
const cleared=r.clearCitation(target);
eq(cleared.citation(target),null);
eq(cleared.evidenceStats().uncited,1);
bad(()=>cleared.clearCitation('9999'),/Only manually labeled/);
const unreviewed=r.set(target,'unreviewed');
eq(unreviewed.citation(target),null,'unreview removes citation');
eq(unreviewed.evidenceStats().manual,0);
// Legacy v1 source-matched drafts migrate to v2 with explicit uncited status.
const v1=clone(saved);v1.version=1;delete v1.citations;v1.integrity.digest=checksum(v1);
const migrated=model.restore(v1);
eq(migrated.classification(target).value,'romanian');
eq(migrated.citation(target),null);
eq(migrated.evidenceStats().uncited,1,'legacy drafts carry no unverified citation');
eq(migrated.exportDraft().version,2,'legacy export upgraded');
const complete=model.ids.reduce((current,id)=>
 model.positive.includes(id)||model.negative.includes(id)?current:current.set(id,'outside'),model.create());
eq(complete.stats().unreviewed,0);
eq(complete.evidenceStats().uncited,154);
eq(complete.stats().gameplayAuthorized,false);
const fullyCited=model.ids.filter(id=>!model.positive.includes(id)&&!model.negative.includes(id))
 .reduce((current,id)=>current.cite(id,'review proposal only; no independent approval'),complete);
eq(fullyCited.evidenceStats().cited,154);
eq(fullyCited.evidenceStats().uncited,0);
eq(fullyCited.exportDraft().gameplayAuthorized,false,'fully cited is still not verified');
eq(fullyCited.evidenceStats().independentlyVerified,false);
eq(model.restore(fullyCited.exportDraft()).exportDraft(),fullyCited.exportDraft());
eq(combat.requireFirstTurnTerritorialRestriction,true);
eq(combat.firstTurnTerritorialRestriction.targetHexes,['0709','0809','0910','1010']);
eq(combat.firstTurnTerritorialRestriction.targetRegionEvidence.coverage,'setup-hexes-adjudicated');
bad(()=>Graph.build({...map,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/,'live Kiev remains source-gated');
for(const file of ['maps/kiev.json','maps/setup/kiev.json',
 'maps/combat-configs/kiev.json','references/rules/kiev-rules.pdf','exports/kiev.svg']){
 const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 yes(manifest.files[file]&&actual===manifest.files[file].sha256,'protected immutable '+file);
}
const report={checkpoint:243,version:'v477',assertions:n,status:'PASS',
 formatVersion:Review.VERSION,sourcePositive:model.positive,sourceNegative:model.negative,
 untouchedUnreviewed:154,sourceCitationRoundtrip:true,legacyV1Import:true,
 staleCitationDroppedOnOppositeLabel:true,manualFullCitedStillCertified:false,
 productionKievPlayable:false,scope:'Review-source traceability only; no national boundary inferred'};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/kiev-territory-citations-v477.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS Kiev territory citation review v477:',n,'assertions; historical Kiev still gated');
