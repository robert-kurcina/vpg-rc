#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const T=require('../core/terrain_tiles');
const Compose=require('../maps/composer');
const map=Compose.compose(require('../maps/kiev.json'),require('../maps/odessa-extension.json'));
const cells=new Map(map.cells.map(c=>[c.id,c]));
const result={schemaVersion:1, id:'odessa-composite-entry-boundary-topology-v527',
 source:'maps/kiev.json + maps/odessa-extension.json → maps/composer.js',
 mapId:map.id, sourceSvgSha256:map.entryBoundarySelections.sourceSvgSha256,
 sourceStatus:map.entryBoundarySelections.status,
 certification:'GEOMETRIC_TOPOLOGY_ONLY_NOT_REINFORCEMENT_OR_VICTORY_AUTHORITY',
 explanation:'Projected source SVG snapped boundary marks, classified against present composite hostCell adjacency. Physical exterior is not equivalent to approved rules entry.',
 activeSourceSvgSha256:map.authoritativeSourceGeometry?.sha256,
 activeComposite: {status:'USER_SVG_REGISTERED_COMPOSITE_EXTERIOR_GEOMETRY_NO_RULES_AUTHORITY',
  orderedSides:map.compositeEntryEdges.map(e=>({hex:e.cellId,dir:e.dir,side:e.side,sourceSvgId:e.sourceSvgId,offsetPx:e.offsetPx}))},
 paths:map.entryBoundarySelections.paths.map(p=>({side:p.side,sourceSvgId:p.sourceSvgId,sourceStatus:p.status,
  orderedSides:p.edges.map(e=>{const adjacentHex=T.neighbor(cells.get(e.cellId),e.dir,map.geometry);return {hex:e.cellId,dir:e.dir,topology:cells.has(adjacentHex)?'internal':'exterior',...(cells.has(adjacentHex)?{adjacentHex}:{})};})
 }))};
const file=path.join(root,'maps/movement-configs/odessa-entry-border-geometry-v527.json');
fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');
console.log(file,result.paths.map(p=>[p.side,p.orderedSides.length,p.orderedSides.filter(s=>s.topology==='internal').length]));
