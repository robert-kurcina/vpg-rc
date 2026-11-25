'use strict';
/* Source-vetted diagnostic edge review; production graph must still fail shut. */
const A=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const C=require('node:child_process');
const Reviewed=require('../core/source_reviewed_movement_graph');
const Graph=require('../core/map_movement_graph');
const map=require('../maps/kiev.json');
const candidate=require('../maps/movement-configs/kiev-source-reviewed-candidate-v435.json');
const ledger=require('../maps/movement-configs/source-reviewed-edge-ledgers.json').maps[map.id];
const audit=require('../rules/audit/kiev-movement-edge-review-v478.json');
const config=require('../tools/movement-review/kiev.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const load=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p));
let assertions=0;const eq=(x,y,m)=>{A.deepEqual(x,y,m);assertions++};
const yes=(x,m)=>{A.ok(x,m);assertions++};
const bad=(f,re,m)=>{A.throws(f,re,m);assertions++};
eq(config.candidateOnly,true);eq(config.scenarioId,'kiev');
eq(config.expectedAuditDigest,audit.integrity.digest);eq(config.expectedSourceSvgSHA256,audit.source.sourceSvgSHA256);
eq(audit.scope,'READ-ONLY-SOURCE-REVIEW-NOT-HISTORICAL-CERTIFICATION');
eq(audit.gameplayAuthorized,false);eq(audit.source.currentGraphAuthorization,'source-verified-experimental-not-historically-certified');
const {integrity,...payload}=audit;
eq(integrity.digest,hash(JSON.stringify(payload)));eq(integrity.algorithm,'SHA-256');
eq(audit.source.mapSHA256,hash(load('maps/kiev.json')));
eq(audit.source.sourceSvgSHA256,hash(load('maps/source/user-svg/kiev-odessa-main.svg')));
eq(audit.source.sourceEdgeLedgerSHA256,hash(JSON.stringify(ledger)));
eq(audit.source.sourceCandidateSHA256,hash(load('maps/movement-configs/kiev-source-reviewed-candidate-v435.json')));
bad(()=>Graph.build({...map,sourceImageSHA256:'untrusted-v485-test'}),/not-gameplay-certified/);
const board=Reviewed.build(map,candidate);
eq(audit.coverage,{cells:165,edges:442,rails:93,river:72,majorRiver:10});
eq(board.edges.length,audit.edges.length);
const edges=new Map(board.edges.map(e=>[[e.a,e.b].sort().join(':'),e]));
const cells=new Map(map.cells.map(c=>[c.id,c]));
const keys=new Set();
for(const e of audit.edges){
 yes(e.id===[e.a,e.b].sort().join(':'),'canonical edge');yes(!keys.has(e.id),'unique edge');keys.add(e.id);
 const reference=edges.get(e.id);yes(reference,'source edge present');
 for(const f of ['rail','river','majorRiver'])eq(e[f],reference[f],f+' source parity');
 const a=cells.get(e.a).pixelCenter,b=cells.get(e.b).pixelCenter;
 const middle=[(a[0]+b[0])/2,(a[1]+b[1])/2];
 const sample=[(e.side[0][0]+e.side[1][0])/2,(e.side[0][1]+e.side[1][1])/2];
 yes(Math.hypot(sample[0]-middle[0],sample[1]-middle[1])<1.2,'diagnostic line on actual hexside midpoint');
 yes(Math.hypot(e.side[0][0]-e.side[1][0],e.side[0][1]-e.side[1][1])>35,'hexside visible');
}
const cp=C.spawnSync(process.execPath,['tools/build-kiev-movement-edge-review-v478.js'],{cwd:require('node:path').join(__dirname,'..'),encoding:'utf8',timeout:15000});
eq(cp.status,0,'deterministic source generator');yes(cp.stdout.includes('442 source-reviewed Kiev edges'));
for(const p of ['maps/movement-configs/graph-sources.json','maps/combat-configs/kiev.json','maps/movement-configs/kiev.json']){
 const obj=JSON.parse(load(p));if(p.includes('graph-sources'))eq(obj.maps[map.id].status,'verified');
 if(p.includes('combat-configs')){eq(obj.firstTurnTerritorialRestriction.targetHexes,['0709','0809','0910','1010']);eq(obj.requireFirstTurnTerritorialRestriction,true)}
}
console.log('PASS Kiev movement review v478:',assertions,'source+graph assertions, reviewer draft still not historical certification');
