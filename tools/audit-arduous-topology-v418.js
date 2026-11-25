#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const Probe=require('../core/source_topology_probe');
const map=require('../maps/arduous.json');
const rails=require('../rules/audit/arduous-rail-reconciliation-v411.json');
const rivers=require('../rules/audit/arduous-river-candidates-v418.json');
const exactHash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceMapSha=exactHash(path.join(ROOT,'maps/arduous.json'));
if(sourceMapSha!==rails.sourceMapSha256||sourceMapSha!==rivers.sourceMapSha256)
 throw Error('Source map changed since rail/river measurements');
const svgPath=path.join(ROOT,'maps/source/user-svg/arduous-map-temp(3).svg');
if(exactHash(svgPath)!==rivers.sourceSvgSha256)throw Error('Original vector source changed');
const sourceFingerprint=Probe.fingerprint(map);
const result=Probe.build({map,railAudit:rails,riverAudit:rivers,sourceFingerprint});
if(result.metadata.components!==1||result.metadata.hexCount!==155||result.metadata.edgeCount!==413||
 result.metadata.railCandidates!==85||result.metadata.riverSideFollowCandidates!==45||
 result.metadata.riverExteriorObservations!==2)
 throw Error('Source topology totals changed; requires review');
const output={schemaVersion:2,checkpoint:184,version:'v418',status:result.status,
 movementAuthorized:false,combatAuthorized:false,
 source:{mapSHA256:sourceMapSha,svgSHA256:rivers.sourceSvgSha256,sourceImageSHA256:map.sourceImageSHA256,
  topologyFingerprint:sourceFingerprint,railAudit:'rules/audit/arduous-rail-reconciliation-v411.json',
  riverAudit:'rules/audit/arduous-river-candidates-v418.json',
  referenceMap:'maps/arduous.json'},
 geometry:{...result.metadata,registrationStatus:map.geometry.calibrationStatus},
 sourceRailExclusions:rails.excludedCrossings,
 riverCandidatePairs:result.edges.filter(x=>x.riverEvidence==='side-follow-candidate').map(x=>[x.a,x.b]),
 riverExteriorObservations:rivers.sideObservations.filter(x=>!x.internalPair).map(x=>({edgeKey:x.edgeKey,classification:x.classification,sources:x.sources})),
 assertedNotToBeLegality:['Observed vector-follow does not alone establish combat river modifier','Incidental vector contacts are not river hexsides','No provisional edge is promoted to verified=true','MapMovementGraph.build(arduous) must continue to reject unverified geography'],
 nextActions:['Review 45 side-follow river candidates and exterior endpoints','Verify source-specific river combat attribution before enabling full campaign','Use reconciled adjacency and 85 rail links in shared MapMovementGraph once policy is source-certified']};
if(process.argv.includes('--write'))fs.writeFileSync(path.join(ROOT,'rules/audit/arduous-topology-v418.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.geometry,null,2));
