'use strict';
/* Kiev §12 rule bound to revealed counter identifier; generic shared buildup
 * transaction is exercised on certified Leningrad only as an isolated fixture. */
const A=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs');
const Build=require('../core/historical_buildup_phase');
const policy=require('../maps/buildup-configs/kiev.json');
const kievCounters=require('../maps/counter-configs/kiev.json');
const kievInventory=require('../maps/setup/kiev-inventory.json');
const KievInv=require('../core/historical_source_face_inventory');
const lMap=require('../maps/leningrad.json'),lProfile=require('../maps/movement-configs/leningrad.json');
const lPhase=require('../maps/phase-configs/leningrad.json'),lCounters=require('../maps/counter-configs/leningrad.json');
const lPolicy=require('../maps/buildup-configs/leningrad.json');
const lSetup=require('../maps/setup/leningrad.json'),lInv=require('../core/leningrad_starting_inventory');
const f=require('./fixtures/leningrad-source-setup-v357');
const Setup=require('../core/scenario_starting_setup');
const clone=x=>JSON.parse(JSON.stringify(x));let n=0;
const eq=(a,b,m)=>{A.deepEqual(a,b,m);n++};
const ok=(x,m)=>{A.ok(x,m);n++};
const fail=(fn,re,m)=>{A.throws(fn,re,m);n++};
const excluded=policy.replacementExcludedFaces;
eq(excluded.length,1);
const sourceId=excluded[0].faceId;
const front=kievCounters.faces.front.find(x=>x.faceId===sourceId);
const back=kievCounters.faces.back.find(x=>x.faceId===front.pairedFaceId);
ok(front&&back&&back.pairedFaceId===sourceId);
eq(front.visualTranscription.kind,'mechanized');eq(front.visualTranscription.printedValues,'?-6');
eq(front.visualTranscription.printedIdentifier,'*');
eq(back.visualTranscription.kind,'mechanized');eq(back.visualTranscription.printedIdentifier,'4');
eq(back.visualTranscription.printedValues,'8·4·6');eq(excluded[0].revealedIdentifier,'4');
ok(excluded[0].ruleSource.includes('§12.0'));
const source=KievInv.create(kievInventory).inspect(kievCounters);
ok(source.valid);ok(source.pools.sovietMechanized.includes(sourceId));
ok(source.pools.sovietMechanized.filter(id=>kievCounters.faces.back.find(x=>x.faceId===
 kievCounters.faces.front.find(f=>f.faceId===id).pairedFaceId).visualTranscription.printedIdentifier==='4').length===1);
// A certified board and different counter sheet are deliberately used to
// execute the SAME source-verified generic policy without admitting Kiev.
const choices=f.selected.sovietRearMechanizedCorps;
const frontL=lCounters.faces.front.find(x=>x.faceId===choices[0]);
const backL=lCounters.faces.back.find(x=>x.faceId===frontL.pairedFaceId);
const synthetic=clone(lPolicy);
synthetic.replacementExcludedFaces=[{faceId:choices[0],kind:'mechanized',owner:'soviet',
 revealedIdentifier:backL.visualTranscription.printedIdentifier,
 ruleSource:'synthetic transaction test only — no historical Leningrad restriction'}];
const cfg={map:lMap,profile:lProfile,config:lPhase,counterConfig:lCounters,allocation:f.selected};
const engine=Build.create({...cfg,policy:synthetic});
const initial=Setup.validate({map:lMap,spec:lSetup,counterConfig:lCounters,inventory:lInv,
 allocation:f.selected,placements:f.placements});
ok(initial.valid);
const full=engine.initialize(initial.state);
const sourceOriginal=full.units[choices[0]];
ok(sourceOriginal?.strengthStatus==='untried');
const removed=clone(full);delete removed.units[choices[0]];
const request=(u,state=removed)=>({state,cursor:{turn:4},actor:'soviet',phase:engine.openingPhase(),unitId:u,
 hex:lPolicy.entryEdge.soviet[0]});
fail(()=>engine.replace(request(choices[0])),/Source-excluded unit cannot receive replacements/,
 'special formation must never be reintroduced after destruction');
// An unrelated Soviet one-step Mechanized Corps still has a legal rebuild.
const allowed=clone(full);delete allowed.units[choices[1]];
const permitted=engine.replace(request(choices[1],allowed));
eq(permitted.event.kind,'replacement-rebuilt');eq(permitted.state.units[choices[1]].strengthStatus,'revealed-one-step');
eq(permitted.phase.replacedMechanized,1);
fail(()=>Build.create({...cfg,policy:{...synthetic,replacementExcludedFaces:[{...synthetic.replacementExcludedFaces[0],revealedIdentifier:'FAKE'}]}}),
 /Replacement exclusion lacks exact printed source-face identity/);
fail(()=>Build.create({...cfg,policy:{...synthetic,replacementExcludedFaces:[synthetic.replacementExcludedFaces[0],synthetic.replacementExcludedFaces[0]]}}),
 /Replacement exclusion lacks exact printed source-face identity/);
fail(()=>Build.create({...cfg,policy:{...synthetic,replacementExcludedFaces:[{...synthetic.replacementExcludedFaces[0],faceId:'fake'}]}}),
 /Replacement exclusion lacks exact printed source-face identity/);
fail(()=>Build.create({...cfg,policy:{...synthetic,replacementExcludedFaces:[{...synthetic.replacementExcludedFaces[0],kind:'infantry'}]}}),
 /Replacement exclusion lacks exact printed source-face identity/);
fail(()=>Build.create({...cfg,policy:{...synthetic,replacementExcludedFaces:'incorrect'} }),/Invalid source replacement exclusion list/);
const h=crypto.createHash('sha256').update(fs.readFileSync('references/rules/kiev-rules.pdf')).digest('hex');
const audit={checkpoint:203,version:'v437',assertions:n,feature:'source-excluded replacement: Soviet 4th Mechanized Corps',
 sourceRule:'references/rules/kiev-rules.pdf §12.0',ruleSha256:h,
 sourceCounterFace:sourceId,concealedFront:front.visualTranscription.printedIdentifier,
 revealedIdentifier:back.visualTranscription.printedIdentifier,
 sourceStatus:'configured-for-Kiev-but-only-exercised-on-certified-board-synthetic-test',
 KievCampaignAuthorized:false};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/kiev-fourth-mech-replacement-v437.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v437 source-identified Soviet 4th Mechanized replacement ban:',n,'assertions; Kiev remains gated');
