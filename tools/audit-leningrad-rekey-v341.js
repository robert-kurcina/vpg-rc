#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const board=require('../maps/leningrad.json');const T=require('../core/terrain_tiles');const A=require('../core/hex_coordinate_migration_audit');
const report=A.analyze(board,c=>T.formatHexNumber(c,T.numberStyle(board,{})),{candidateParityDown:'even'});
if(require.main===module){if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({numbered:report.numberedCandidateCells,unnumbered:report.unnumberedCells.length,originalEdges:report.originalEdges,candidateEdges:report.candidateEdges,removedEdges:report.missingEdges.length,addedEdges:report.addedEdges.length,ready:report.readyForAuthoritativeRekey},null,2));}
module.exports={audit:()=>report};
