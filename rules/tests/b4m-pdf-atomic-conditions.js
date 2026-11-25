'use strict';
// This verifies bounded source indexing, not executable rule compliance.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const read=x=>JSON.parse(fs.readFileSync(path.join(root,x),'utf8'));
const atomic=read('rules/audit/b4m-pdf-atomic-conditions.json');
const heading=read('rules/audit/b4m-pdf-clause-index.json');
const manifest=read('rules/audit/b4m-manifest.json');
const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'references/rules/b4m-rules.pdf'))).digest('hex');
assert.equal(atomic.sourceSha256,hash,'PDF source changed; invalidate transcription');
assert.equal(atomic.sourceSha256,heading.sourceSha256);
assert.equal(atomic.count,atomic.conditions.length);
assert(atomic.conditions.length>=90);
const seen=new Set(), sections=new Set(heading.headings.map(h=>h.section));
const legacyIds=new Set(manifest.rules.map(x=>x.id));
for(const c of atomic.conditions){
 assert(!seen.has(c.id),'Duplicate condition '+c.id);seen.add(c.id);
 assert.match(c.id,/^pdf\.\d+\.\d+(?:\.\d+)?\.[a-z0-9-]+$/);
 assert(sections.has(c.source.section),'No section heading: '+c.id);
 assert.equal(c.source.document,'references/rules/b4m-rules.pdf');
 assert([1,2].includes(c.source.pdfSheet));
 assert(c.condition.length>=18);
 assert(['source-indexed-unverified','source-tested','source-conflict'].includes(c.auditStatus));
 for(const id of c.linkedLegacyMappings)assert(legacyIds.has(id),'Unknown mapped ID: '+id);
 for(const t of c.targetedTests)assert(fs.existsSync(path.join(root,t)),'Missing referenced test: '+t);
}
for(const s of ['4.0','5.0','6.0','7.0','7.1','7.2','7.3','8.0','8.1','8.2.1','8.2.2','8.3','9.0','9.1','9.2','9.3','10.0','10.1','10.2','10.3','10.4','11.0','12.0','12.1','12.2'])assert(atomic.conditions.some(c=>c.source.section===s),'Missing source section '+s);
const ledger=read('rules/audit/b4m-atomic-evidence.json');
const byId=new Map(atomic.conditions.map(c=>[c.id,c]));
const ledgerIds=new Set();
for(const item of ledger.entries){
 assert(!ledgerIds.has(item.id),'Duplicate evidence '+item.id);ledgerIds.add(item.id);
 const c=byId.get(item.id);assert(c,'Evidence references nonexistent clause '+item.id);
 assert.equal(c.auditStatus,'source-tested','Evidence requires tested condition: '+item.id);
 assert.deepEqual(c.targetedTests,[item.test]);
 assert.equal(c.evidenceClaim,item.claim);
 assert.equal(c.evidenceScope,'bounded-fixture-not-exhaustive');
 const testText=fs.readFileSync(path.join(root,item.test),'utf8');
 assert(item.assertionAnchor.startsWith('assert.'),'Anchor must be direct executable assertion');
 assert(testText.includes(item.assertionAnchor),'Assertion removed or renamed for '+item.id);
}
for(const c of atomic.conditions){
 if(c.auditStatus==='source-tested')assert(ledgerIds.has(c.id),'Missing evidence '+c.id);
 if(c.auditStatus==='source-indexed-unverified')assert.equal(c.targetedTests.length,0,'Unverified condition must not assert test evidence: '+c.id);
}
const counts=atomic.conditions.reduce((acc,c)=>(acc[c.auditStatus]=(acc[c.auditStatus]||0)+1,acc),{});
assert.equal(counts['source-tested'],ledger.entries.length);
assert.equal((counts['source-indexed-unverified']||0)+(counts['source-tested']||0),atomic.count);
console.log(`PASS PDF atomic evidence ledger ${counts['source-tested']} bounded source-tested / ${atomic.count} first-pass conditions; ${counts['source-indexed-unverified']} unverified; NO full compliance claim`);
