#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(__dirname,'..');
const board=require('../maps/leningrad.json');
const terrain=require('../core/terrain_tiles');
const registry=require('../core/printed_coordinate_registry');
const style=terrain.numberStyle(board,{});
const printed=registry.resolve(board,c=>terrain.formatHexNumber(c,style));
const cells=new Map(board.cells.map(c=>[c.id,c]));
const center=id=>cells.get(id)?.pixelCenter;
const columns=[...new Set(board.cells.map(c=>c.column))].sort((a,b)=>a-b);
const firstRow=columns.filter(col=>cells.has(String(col).padStart(2,'0')+'01')).map(col=>{
 const internal=String(col).padStart(2,'0')+'01', c=cells.get(internal);
 return {internal,printed:terrain.formatHexNumber(c,style),centerY:c.pixelCenter[1],column:col};
});
const pairwise=[];
for(let i=1;i<firstRow.length;i++){
 const left=firstRow[i-1],right=firstRow[i];
 pairwise.push({internal:[left.internal,right.internal],printed:[left.printed,right.printed],differenceY:Number((right.centerY-left.centerY).toFixed(3))});
}
const markers=board.cells.flatMap(c=>(c.tileMarkers||[]).filter(m=>['cross','star'].includes(m.kind)).map(m=>({kind:m.kind,faction:m.faction,internal:c.id,printed:terrain.formatHexNumber(c,style)})));
const labelClaims={leningrad:{internal:'1701',expected:'1601'},liepaja:{internal:'0208',expected:'0107'},riga:{internal:'0707',expected:'0607'}};
const landmarkResults=Object.fromEntries(Object.entries(labelClaims).map(([name,v])=>[name,{...v,actual:printed.internalToPrinted(v.internal),matches:printed.internalToPrinted(v.internal)===v.expected}]));
const zeroColumn=board.cells.filter(c=>terrain.formatHexNumber(c,style).startsWith('00')).map(c=>c.id);
const noChangeEvidence={physicalFirstRowSample:firstRow.slice(0,6),physicalEvenColumnsHigher: center('0201')[1]<center('0101')[1]&&center('0401')[1]<center('0301')[1],
 sourceFacingEvenColumnsHigher: center('0301')[1]<center('0201')[1],
 geometryParitySetting:board.geometry.columnParityDown};
const alternativeStyles={
 current:style,
 removePrintedOffsets:{...style,printedColumnOffset:0,printedRowOffset:0,printedRowOffsetsByColumn:null},
};
const alternatives=Object.fromEntries(Object.entries(alternativeStyles).map(([name,f])=>{
 const r=registry.resolve(board,c=>terrain.formatHexNumber(c,f));
 return [name,{invalid:r.invalid.length,duplicates:r.duplicates.length,complete:r.complete,
  leningradLabel:terrain.formatHexNumber(cells.get('1701'),f),
  southwestCellLabel:terrain.formatHexNumber(cells.get('0511'),f)}];
}));
const issues=[];
if(!printed.complete)issues.push('Source-facing printed coordinates are not a complete positive, unique bijection');
if(zeroColumn.length)issues.push('Internal first column produces invalid source-facing 00xx printed coordinates');
if(!noChangeEvidence.physicalEvenColumnsHigher)issues.push('Physical grid unexpectedly not even-column-high');
if(!noChangeEvidence.sourceFacingEvenColumnsHigher)issues.push('Source-facing numbered grid does not implement Even Column High');
const output={schemaVersion:1,scope:'non-mutating parity and source-facing registry audit',source:'maps/leningrad.json',
 mapSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'maps/leningrad.json'))).digest('hex'),
 geometry:board.geometry,cellCount:board.cells.length,numberedCount:printed.byPrinted.size,
 invalidPrintedCoordinates:printed.invalid,duplicatePrintedCoordinates:printed.duplicates,
 zeroColumnInternalCells:zeroColumn,parity:noChangeEvidence,pairwiseFirstRowY:pairwise.slice(0,8),landmarks:landmarkResults,
 currentDeployment:markers,alternatives,readyForHistoricalRekey:false,blockers:issues,
 limitation:'No source-backed global mapping from original printed hexes to the current 197 physical cells has been established; do not flip parity, renumber cells, alter geography, or use a marker shift as a substitute.'};
if(require.main===module){const file=process.argv[2];if(file)fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({cellCount:output.cellCount,physicalEvenHigh:noChangeEvidence.physicalEvenColumnsHigher,printedEvenHigh:noChangeEvidence.sourceFacingEvenColumnsHigher,invalid:printed.invalid.length,issues:issues},null,2));}
module.exports={audit:()=>output};
