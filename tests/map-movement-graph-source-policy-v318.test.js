'use strict';
const assert=require('node:assert/strict');
const G=require('../core/map_movement_graph.js');
const registry=require('../maps/movement-configs/graph-sources.json');
const maps=['leningrad','arduous','kiev'];
const inputs=maps.map(x=>require('../maps/'+x+'.json'));
let n=0;
const ok=(v,msg)=>{assert.ok(v,msg);n++};
const denied=(map,reason)=>{assert.throws(()=>G.build(map),new RegExp(reason));n++};
ok(registry.schemaVersion===1,'registry schema');
ok(Object.keys(registry.maps).length===3,'three explicitly described maps');
const leningrad=inputs[0];
const g=G.build(leningrad);
ok(g.edges.length===533 && g.metadata.railEdges===80 && Object.keys(g.cells).length===197,'existing graph unchanged');
ok(registry.maps[leningrad.id].status==='verified','verified source');
const ard=inputs[1],kiev=inputs[2];
ok(registry.maps[ard.id].status==='verified','Arduous certified source-reviewed topology');
ok(G.build(ard).metadata.riverEdges===45,'45 approved river sides enter the executable graph');
ok(registry.maps[kiev.id].status==='verified','Kiev source-verified experimental graph');
ok(G.build(kiev).edges.length===442,'source-reviewed Kiev graph now exposed for experimental play');
denied({...kiev,sourceImageSHA256:'untrusted-v485-test'},'source-geometry-not-gameplay-certified');
for(const [field,value] of [['id','fake-map'],['sourceGame','Objective: Kiev'],['sourceImageSHA256','bad']]){
 const changed=structuredClone(leningrad); changed[field]=value;denied(changed,'source-geometry-not-gameplay-certified');
}
{const m=structuredClone(leningrad);m.geometry.calibrationStatus='visual-candidate';denied(m,'source-geometry-not-gameplay-certified');}
{const m=structuredClone(leningrad);m.cells[0].terrainStatus='source-resampled-provisional';denied(m,'unverified-terrain');}
{const m=structuredClone(leningrad);m.hexCenterRailConnections[0].status='candidate';denied(m,'unverified-rail-link');}
// Callers may not forge a locally provided source policy to promote candidate data.
{const m=structuredClone(ard);m.cells[0].terrain='forest'===m.cells[0].terrain?'open':'forest';denied(m,'fingerprint-mismatch');}
console.log('PASS source-policy registry',n,'assertions');
