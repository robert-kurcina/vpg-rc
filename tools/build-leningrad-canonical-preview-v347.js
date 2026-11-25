#!/usr/bin/env node
'use strict';
/* Pure v347 canonicalization PREVIEW: never writes maps/leningrad.json.
 * Canonical printed numbers become true IDs, preserving physical coordinates
 * and all numbered-hex neighbor edges via the universal explicit graph mode.
 * Gameplay activation is blocked until all source-linked map references have
 * been remapped and 11 unnumbered source sea cells get a visual-only layer.
 */
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const T=require('../core/terrain_tiles');const P=require('../core/canonical_hex_projection');
const ROOT=path.resolve(__dirname,'..');
const source=path.join(ROOT,'maps/leningrad.json');
const svg=path.join(ROOT,'maps/source/user-svg/leningrad-main.svg');
const board=JSON.parse(fs.readFileSync(source,'utf8'));
const format=c=>T.formatHexNumber(c,T.numberStyle(board,{}));
const result=P.project(board,format);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={...result.record,
 inputMapSha256:sha(source),inputSvgSha256:sha(svg),
 referencesAwaitingAtomicRekey:{authoredShoreHexsides:board.authoredShoreHexsides.length,hexCenterRailConnections:board.hexCenterRailConnections.length,railwayBoundaryExits:board.railwayBoundaryExits.length,entryBoundaryEdges:board.entryBoundarySelections.paths.reduce((n,p)=>n+p.edges.length,0),authoritativeSeaHexes:board.authoritativeSeaHexes.length},
 geometryInvariant:'Canonical pixelCenter is copied exactly; physical side adjacency uses explicit neighbors instead of inferred stagger arithmetic.',
 rendererContract:'Production renderer and maps/leningrad.json remain unchanged; approved v345 image is the visual baseline.',
 legacyIdContract:'Legacy IDs in gameplay rules, source feature arrays, save states and historic provenance are NOT yet atomically re-keyed.'};
const out=path.join(ROOT,'rules/audit/leningrad-canonical-preview-v347.json');
const projected=path.join(ROOT,'maps/canonical/leningrad-preview-v347.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.mkdirSync(path.dirname(projected),{recursive:true});
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(projected,JSON.stringify({...result.board,
  projectionStatus:'PREVIEW_ONLY',
  activationBlockedBy:['unmigrated-scenario-references','visual-only-sea-render-layer','save-file-compatibility','historical-number-source-certification']},null,2)+'\n');
console.log(JSON.stringify({canonicalCells:report.canonicalCellCount,visualSeaCells:report.visualOnlyCellCount,physicalEdges:report.canonicalPhysicalEdges,errors:report.errors,activation:report.activationStatus},null,2));
