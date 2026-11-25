'use strict';
// Contract test for source-index integrity. This does NOT declare game-rule compliance.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.resolve(__dirname,'../..');
const index=JSON.parse(fs.readFileSync(path.join(root,'rules/audit/b4m-pdf-clause-index.json'),'utf8'));
const mapped=JSON.parse(fs.readFileSync(path.join(root,'rules/audit/b4m-manifest.json'),'utf8'));
const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'references/rules/b4m-rules.pdf'))).digest('hex');
assert.strictEqual(index.sourceSha256,sha,'Bundled PDF has changed: redo source-index review');
assert.strictEqual(index.indexedHeadings,index.headings.length);
assert.strictEqual(new Set(index.headings.map(h=>h.section)).size,index.headings.length);
const known=new Set(mapped.rules.map(r=>r.id));
for(const heading of index.headings){
 assert(/^\d+\.\d+(?:\.\d+)?$/.test(heading.section));
 assert([1,2].includes(heading.pdfSheet));
 for(const id of heading.legacyMappings)assert(known.has(id),`Orphan mapping ${id}`);
 const expected=mapped.rules.filter(r=>r.source?.some(s=>s.section===heading.section)).map(r=>r.id).sort();
 assert.deepStrictEqual(heading.legacyMappings.slice().sort(),expected,`Section ${heading.section} mapping drift`);
}
for(const section of ['4.0','5.0','6.0','7.1','7.2','7.3','8.1','8.2.1','8.2.2','8.3','9.1','9.2','9.3','10.1','10.2','10.3','10.4','11.0','12.1','12.2'])assert(index.headings.some(h=>h.section===section),`Missing printed heading ${section}`);
console.log(`PASS B4M indexed ${index.indexedHeadings} printed PDF headings, source SHA and 28 legacy-mapping crossrefs (coverage NOT certified)`);
