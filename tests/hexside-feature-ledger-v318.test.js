'use strict';
const assert=require('node:assert/strict');
const F=require('../core/hexside_features'),C=require('../maps/composer'),G=require('../core/map_movement_graph');
const L=require('../maps/leningrad.json'),A=require('../maps/arduous.json'),K=require('../maps/kiev.json'),O=require('../maps/odessa-extension.json');
const copy=o=>JSON.parse(JSON.stringify(o));let n=0;
const verified=F.inspect(L),previous=G.build(L);
assert.equal(verified.metadata.certified,true);n++;
assert.equal(verified.metadata.hexCount,197);n++;
assert.equal(verified.metadata.edgeCount,533);n++;
assert.equal(verified.metadata.certifiedRailEdges,80);n++;
for(const p of previous.edges){const actual=F.edge(verified,p.a,p.b);assert.ok(actual);assert.equal(actual.rail,p.rail);assert.equal(actual.river,p.river);assert.equal(actual.impassable,p.impassable);assert.equal(actual.movementAuthorized,!p.impassable);n+=5;}
const approved=F.inspect(A);assert.equal(approved.metadata.certified,true);assert.equal(approved.metadata.certifiedRailEdges,85);assert.equal(approved.metadata.certifiedRiverEdges,45);n+=3;
for(const map of [K]){const r=F.inspect(map);assert.equal(r.metadata.certified,true);assert.equal(r.metadata.edgeCount,442);assert.equal(r.metadata.certifiedRailEdges,93);assert.equal(r.metadata.certifiedRiverEdges,72);assert.ok(r.edges.every(e=>e.evidence==='certified-movement'&&e.movementAuthorized));n+=5;}
const combined=C.compose(K,O),composite=F.inspect(combined);
assert.equal(composite.metadata.certified,false);assert.equal(composite.metadata.hexCount,261);n+=2;
assert.equal(composite.metadata.authoredShoreSides,32);n++;
const kIds=new Set(K.cells.map(c=>c.id)),oIds=new Set(O.cells.map(c=>c.id));
const seam=composite.edges.filter(e=>(kIds.has(e.a)&&oIds.has(e.b))||(kIds.has(e.b)&&oIds.has(e.a)));
assert.equal(seam.length,24);assert.ok(seam.every(e=>!e.movementAuthorized));n+=2;
assert.throws(()=>G.build(combined),/source-geometry-not-gameplay-certified/);n++;
const altered=copy(L);altered.cells[0].terrainStatus='provisional';assert.throws(()=>F.inspect(altered),/unverified-terrain/);n++;
const invalid=copy(combined);invalid.authoredShoreHexsides.push({cellId:'9999',dir:'NE'});assert.throws(()=>F.inspect(invalid),/invalid-shore-side/);n++;
const duplicate=copy(combined);duplicate.authoredShoreHexsides.push({...duplicate.authoredShoreHexsides[0]});assert.throws(()=>F.inspect(duplicate),/duplicate-shore-side/);n++;
assert.equal(F.edge(composite,'0000','9999'),null);n++;
console.log('PASS hexside feature ledger',n,'assertions; Leningrad',JSON.stringify(verified.metadata),'Kiev-Odessa',JSON.stringify(composite.metadata));
