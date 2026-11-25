const assert=require('assert');
const fs=require('fs');
const crypto=require('crypto');
const E=require('../core/terrain_evidence');
const report=require('../rules/audit/arduous-kiev-terrain-evidence-v318.json');
const cases=[['arduous',155,50,0,85,0],['kiev',165,149,16,93,230]];
for(const [name,total,marked,unresolved,rails,featureMarks] of cases){
 const data=JSON.parse(fs.readFileSync(`maps/${name}.json`));
 const a=E.inspect(data);
 assert.deepStrictEqual(a,report.maps[name]);
 assert.strictEqual(a.authorizedForMovement,false);
 assert.strictEqual(a.coverage.markedTerrainHexes,marked);
 assert.strictEqual(a.coverage.unresolvedTerrainHexes,unresolved);
 assert.strictEqual(a.coverage.railCandidateLinks,rails);
 assert.strictEqual(a.coverage.candidateHexsideFeatureMarks,featureMarks);
 assert.strictEqual(marked+unresolved+(name==='arduous'?105:0),total);
 assert.strictEqual(a.coverage.reviewedOpenTerrainHexes,name==='arduous'?105:0);
 assert.strictEqual(new Set([...a.verifiedAuthoredTerrainHexes,...a.reviewedOpenTerrainHexes,...a.terrainReviewHexes]).size,total);
 assert.throws(()=>E.inspect({...data,cells:[...data.cells,data.cells[0]]}),/duplicate/);
 const edited=structuredClone(data);const target=edited.cells.find(c=>c.terrainStatus.startsWith(name==='kiev'?'definitive-user-svg-':'user-svg-authored-'));
 target.terrain=target.terrain==='forest'?'swamp':'forest';
 assert.throws(()=>E.inspect(edited),/authored-status-disagrees|definitive-terrain-evidence-disagrees/);
 const damaged=structuredClone(data);damaged.hexCenterRailConnections[0].to='nonexistent';
 assert.throws(()=>E.inspect(damaged),/rail-references-missing-hex/);
 // Only Arduous has received a separate source-reviewed gameplay binding.
 const G=require('../core/map_movement_graph');
 if(name==='arduous')assert.equal(G.build(data).metadata.riverEdges,45);
 else assert.throws(()=>G.build(data),/source-geometry-not-gameplay-certified/);
 console.log(`${name}: ${marked} authored cells, ${unresolved} review cells, ${rails} rail candidates`);
}
console.log('terrain evidence audit PASS');
