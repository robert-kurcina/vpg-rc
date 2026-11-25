'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const crypto=require('node:crypto');const cp=require('node:child_process');
const R=require('../core/map_certification_readiness'),G=require('../core/map_movement_graph');
const src=require('../rules/audit/arduous-kiev-svg-first-rail-graph-v318.json'),snapshot=require('../rules/audit/arduous-kiev-certification-readiness-v318.json');
let checks=0;function check(...args){assert.ok(...args);checks++;}
for(const [name,expectedHexes,expectedReview,missing,extra] of [['arduous',155,0,3,0],['kiev',165,16,0,0]]){
 const raw=fs.readFileSync(`maps/${name}.json`),map=JSON.parse(raw),ext=src.maps[name];
 check(crypto.createHash('sha256').update(raw).digest('hex')===ext.sourceMapSha256,'current map extraction SHA');
 const report=R.inspect(map,ext);assert.deepEqual(report,snapshot.maps[name]);checks++;
 check(report.authorizedForMovement===false);check(report.coverage.hexes===expectedHexes);
 check(report.coverage.terrainReviewHexes===expectedReview);
 if(name==='arduous')check(!report.blockers.includes('terrain-classification-incomplete'));check(report.coverage.railMissingFromRegistration===missing);
 check(report.coverage.registeredRailNotDerived===extra);
 for(const h of Object.values(report.hexes)){check(h.terrainCertified===false);check(h.sides.length===6);}
 for(const side of report.sharedSides){check(side.members.length===2);check(side.gameplayCertified===false);
  const [a,b]=side.key.split(':');check(report.hexes[a]&&report.hexes[b]);}
 if(name==='arduous')assert.equal(G.build(map).metadata.riverEdges,45);
 else assert.throws(()=>G.build(map),/not-gameplay-certified/);checks++;
 const bad=structuredClone(ext);bad.adjacencyPairs.push(['nonexistent','0101']);assert.throws(()=>R.inspect(map,bad),/invalid-derived-rail/);checks++;
 const removed=structuredClone(ext);removed.adjacencyPairs=removed.adjacencyPairs.slice(1);
 const rec=R.inspect(map,removed);check(rec.coverage.derivedRailLinks===ext.adjacencyPairs.length-1);
 const invalid=structuredClone(map);invalid.hexCenterRailConnections.push({...invalid.hexCenterRailConnections[0]});assert.throws(()=>R.inspect(invalid,ext),/duplicate-rail-(link|candidate)/);checks++;
}
const run=cp.spawnSync(process.execPath,['tools/audit-map-certification-readiness-v318.js'],{encoding:'utf8'});
assert.equal(run.status,0,run.stderr);checks++;
console.log('PASS map certification readiness',checks,'assertions');
