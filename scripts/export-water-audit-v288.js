#!/usr/bin/env node
const fs=require('fs'),path=require('path'),T=require('../core/terrain_tiles'),C=require('../maps/composer');
const base=require('../maps/kiev.json'),extra=require('../maps/odessa-extension.json');
const board=C.compose(base,extra),audit=T.shorelineRegistrationAudit(board,...T.gridRadii(board.geometry));
const report={version:288,status:'source-registered visual geometry only; not gameplay-certified',source:extra.sourceWaterScanContours.sourceScan,
 seaScanSha256:extra.sourceWaterScanContours.sha256,coastlineEdges:20,renderedWaveletEdges:audit.filter(e=>e.sourceRegistered!==false).length,
 quarantined:audit.filter(e=>e.sourceRegistered===false),allEdges:audit,
 riverVertices:extra.sourceBitmapRiverInk?.points?.length||null,
 notes:['Provisional coast edges farther than 12 source pixels from printed sea boundary are not painted.',
 'All 20 entries remain available for correction; no rules topology is inferred from scan ink.',
 'Source sea fill is clipped to playable hex cells but the original polygon paths are preserved.']};
const out=path.resolve(process.argv[2]||'evidence-v288/water-registration-audit.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(out);
