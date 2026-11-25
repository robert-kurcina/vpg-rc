'use strict';
/* Kiev §10.8 manual-source workbench qualification. A complete proposed draft
 * MUST remain insufficient to activate the historical game. */
const A=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const M=require('../maps/kiev.json');
const Setup=require('../maps/setup/kiev.json');
const C=require('../tools/territory-review/kiev.json');
const R=require('../core/historical_territory_review');
const G=require('../core/map_movement_graph');
const previous=require('../PACKAGE_MANIFEST.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(require('node:path').resolve(__dirname,'..',p))).digest('hex');
let n=0;
function eq(actual,expected,message){A.deepEqual(actual,expected,message);n++;}
function yes(actual,message){A.ok(actual,message);n++;}
function fail(f,pattern,message){A.throws(f,pattern,message);n++;}
const model=R.create({map:M,setup:Setup,config:C});
const initial=model.create();
eq(model.ids.length,165,'all source hexes');
eq(model.positive,['0709','0809','0910','1010'],'source §6 Romanian markers');
eq(model.negative,['0105','0203','0204','0301','0302','0303','0402'],'source §6 Polish markers');
eq(initial.stats(),{romanian:4,outside:7,unreviewed:154,sourcePositive:4,sourceNegative:7,manual:0,total:165,
 coverage:'incomplete-draft',gameplayAuthorized:false});
eq(model.source.rulebookSHA256,sha('references/rules/kiev-rules.pdf'),'original rulebook source pin');
eq(model.source.sourceSvgSHA256,sha('maps/source/user-svg/kiev-odessa-main.svg'),'source geometry pin');
for(const h of model.positive){eq(initial.classification(h),{value:'romanian',evidence:'printed-Romanian-setup'});
 fail(()=>initial.set(h,'outside'),/cannot be edited/,'Romanian marker immutable');}
for(const h of model.negative){eq(initial.classification(h),{value:'outside',evidence:'printed-Polish-setup'});
 fail(()=>initial.set(h,'romanian'),/cannot be edited/,'Polish source marker immutable');}
const origin='0708';
eq(initial.classification(origin),{value:'unreviewed',evidence:'none'},'Soviet border origin not assumed a country');
const candidate=initial.set(origin,'romanian');
eq(candidate.classification(origin),{value:'romanian',evidence:'manual-draft'});
eq(initial.classification(origin).value,'unreviewed','source model immutable');
const cleared=candidate.set(origin,'unreviewed');
eq(cleared.snapshot(),initial.snapshot(),'explicit clear removes draft label');
fail(()=>candidate.set('9999','romanian'),/Invalid draft/);
fail(()=>candidate.set('0111','unrecognized'),/Invalid draft/);
const saved=candidate.exportDraft();
eq(saved.format,R.FORMAT);eq(saved.status,'UNAPPROVED-CANDIDATE-NOT-GAMEPLAY-POLICY');
eq(saved.gameplayAuthorized,false);
eq(model.restore(saved).exportDraft(),saved,'byte-semantic save/restore consistency');
const changed=clone(saved);changed.labels[origin]='outside';
fail(()=>model.restore(changed),/checksum mismatch/,'tamper detected');
const mismatched=clone(saved);mismatched.source.sourceImageSHA256='0'.repeat(64);
// Even a correctly recomputed untrusted checksum may not override source pins.
mismatched.integrity.digest=require('../core/sync_sha256').sha256(JSON.stringify(Object.fromEntries(Object.entries(mismatched).filter(([k])=>k!=='integrity'))));
fail(()=>model.restore(mismatched),/source provenance mismatch/,'source cannot be replaced by checksum');
const forged=clone(saved);forged.labels['0709']='outside';
forged.integrity.digest=require('../core/sync_sha256').sha256(JSON.stringify(Object.fromEntries(Object.entries(forged).filter(([k])=>k!=='integrity'))));
fail(()=>model.restore(forged),/source-anchored hex/,'even signed source anchor edits refused');
const full=model.ids.reduce((r,hex)=>model.positive.includes(hex)||model.negative.includes(hex)?r:r.set(hex,'outside'),initial);
eq(full.stats().unreviewed,0,'a fully manually classified candidate is possible');
eq(full.stats().manual,154,'all unknown hexes explicitly reviewed');
eq(full.exportDraft().coverage,'draft-complete-pending-independent-source-approval');
eq(full.exportDraft().gameplayAuthorized,false,'completed draft still cannot enable gameplay');
eq(model.restore(full.exportDraft()).stats(),full.stats(),'full-draft restore');
fail(()=>G.build({...M,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/,'true Kiev game remains gated');
// Only immutable source/setup/render exports remain pinned to v469. The
// shared gameplay modules evolve by later checkpoints (v471 retreat policy
// and v472 source-guarded combat), so historical engine hashes are not an
// appropriate source-preservation assertion.
for(const file of ['maps/kiev.json','maps/setup/kiev.json',
 'exports/kiev.svg',
 'exports/arduous.svg','exports/leningrad.svg','exports/kiev-odessa.svg']){
 const old=previous.files[file];
 yes(old&&sha(file)===old.sha256,'protected source/setup/export remains identical to v469: '+file);
}
const report={checkpoint:236,version:'v470',assertions:n,initial:initial.stats(),
 sourcePinnedRomania:model.positive,sourcePinnedPoland:model.negative,unreviewed:154,
 fullManualDraftStillGameplayAuthorized:false,productionStatus:'closed',
 scope:'read-only browser territory review; manually classified full-map drafts stay unapproved'};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/kiev-territory-review-v470.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS v470 Kiev territory review source/checksum/gate:',n,'assertions');
