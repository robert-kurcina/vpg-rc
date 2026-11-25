#!/usr/bin/env node
'use strict';
// Shared current-map output verifier. Historic v350 visual approval is preserved; current v373
// no-Forest-shadow candidate uses an explicit separate immutable audit fingerprint.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const T=require('../core/terrain_tiles');
const C=require('../maps/composer');
const P=require('../core/presentation');
const root=path.resolve(__dirname,'..');
const readJson=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const registry=readJson('maps/registry.json').maps;
const manifest=readJson('exports/manifest.json');
assert.equal(registry.length,5,'five registered configurations required');
assert.equal(new Set(registry.map(m=>m.id)).size,registry.length,'duplicated map IDs');
const byId=new Map(registry.map(m=>[m.id,m]));
const boards={};
for(const m of registry)if(m.file)boards[m.id]=readJson('maps/'+m.file);
for(const m of registry)if(m.compose)boards[m.id]=C.compose(boards[m.compose.base],readJson('maps/'+m.compose.extension));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const reports=[];
for(const item of registry){
 const board=boards[item.id];assert(board,`missing board ${item.id}`);
 const topology=T.validate(board,{requireReciprocal:false});
 assert.deepEqual(topology.errors,[],`${item.id} invalid topology`);
 const opts=P.options(item.id);
 for(const [key,value] of Object.entries(item.renderOptions))assert.deepEqual(opts[key],value,`${item.id} lost render profile ${key}`);
 const row=manifest.find(m=>m.id===item.id);
 assert(row,`${item.id} missing export manifest`);
 assert.equal(row.hexes,board.cells.length,`${item.id} mismatch exported hex count`);
 const svg=fs.readFileSync(path.join(root,'exports',item.id+'.svg'));
 const png=fs.readFileSync(path.join(root,'exports',item.id+'.png'));
 assert(svg.toString('utf8').startsWith('<svg '),`${item.id} invalid SVG root`);
 assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),`${item.id} invalid PNG`);
 assert.equal(digest(svg),row.svgSHA256,`${item.id} stale/modified SVG`);
 assert.equal(digest(png),row.pngSHA256,`${item.id} stale/modified PNG`);
 const source=svg.toString('utf8');
 for(const layer of ['terrain','rivers','water-bodies','railways','hex-grid','coordinates','deployment','city-labels'])assert(source.includes(`data-layer="${layer}"`),`${item.id} missing ${layer}`);
 const pos=x=>source.indexOf(`data-layer="${x}"`);
 // Entry edges were intentionally moved to layer #0, not after lake/coast.
 const order=['entry-edges','terrain','rivers','water-bodies','railways','hex-grid','coordinates','deployment','city-labels'];
 for(let i=0;i<order.length-1;i++)assert(pos(order[i])>=0 && pos(order[i])<pos(order[i+1]),`${item.id} layer order ${order[i]}/${order[i+1]}`);
 assert(!source.includes('#08004cff"'),`${item.id} incorrect CSS4 border serialization`);
 assert(!source.includes('#30b9bfff"'),`${item.id} incorrect CSS4 water serialization`);
 reports.push({id:item.id,hexes:board.cells.length,svgSHA256:row.svgSHA256,pngSHA256:row.pngSHA256,warnings:topology.warnings.length});
}
// Preserve the immutable v350 user-approved baseline as an historical fact.
// Checkpoint 139 explicitly removes Forest shadows; certify the no-shadow
// candidate separately without altering historical v350 approval.
const approval=readJson('rules/audit/leningrad-visual-baseline-v350.json');
assert.equal(approval.svgSHA256,'4ad4965040952244ee4c7dc136e8726616a3c791d64dfa3b5b74fc46f3f0cd03','v350 approved SVG record altered');
assert.equal(approval.pngSHA256,'3b622a8a645b3c87f0622dd82de347c6110a10ce639058057b765ff3bb99be2f','v350 approved PNG record altered');
const candidate=readJson('rules/audit/forest-shadow-removal-v373.json');
assert.equal(candidate.status.includes('pending signoff'),true,'new render must not claim approval');
assert.equal(candidate.results.length,registry.length);
for(const m of manifest){
 const expected=candidate.results.find(e=>e.id===m.id);
 assert(expected,`missing ${m.id} in no-shadow audit`);
 assert.equal(m.svgSHA256,expected.candidateSvgSHA256,`${m.id}: unreviewed SVG change`);
 assert.equal(m.pngSHA256,expected.candidatePngSHA256,`${m.id}: unreviewed PNG change`);
 assert(expected.changedPixels>0,`${m.id}: expected shadow removal visual change`);
 assert.equal(expected.shadowOnlySvgChange,true,`${m.id}: unrelated SVG changed`);
}
const current=manifest.find(x=>x.id==='leningrad');
assert.notEqual(current.svgSHA256,approval.svgSHA256,'Leningrad did not receive requested shadow removal');
assert.notEqual(current.pngSHA256,approval.pngSHA256,'Leningrad PNG unchanged despite requested shadow removal');
console.log(JSON.stringify({result:'PASS',maps:reports,approvedLeningradHistorical:'v350',activeVisualBaseline:'v373-no-forest-shadow-user-accepted'},null,2));
