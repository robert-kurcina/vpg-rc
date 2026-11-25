#!/usr/bin/env node
'use strict';
/* Repeatable PREVIEW audit; synthetic identifiers, never historical counters. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const T=require('../core/terrain_tiles');
const C=require('../core/canonical_hex_projection');
const M=require('../core/canonical_state_migration');
const root=path.resolve(__dirname,'..');
const src=path.join(root,'maps/leningrad.json');
const board=JSON.parse(fs.readFileSync(src,'utf8'));
const projection=C.project(board,c=>T.formatHexNumber(c,T.numberStyle(board,{})));
const m=M.create(projection.record);
const locations=board.cells.flatMap(c=>(c.tileMarkers||[]).filter(x=>['cross','star'].includes(x.kind)).map(x=>({hex:c.id,kind:x.kind,owner:x.faction})));
if(locations.length!==10)throw Error('Approved deployment marker count changed');
const units=Object.fromEntries(locations.map((v,i)=>{const id='synthetic-'+(i+1);return [id,{id,hex:v.hex,owner:v.owner,kind:v.kind==='cross'?'infantry':'army'}]}));
const state={scenarioId:'leningrad',hexIdSpace:'legacy-physical',units};
const draft={scenarioId:'leningrad',cursor:{scenarioId:'leningrad',turn:1,index:0,complete:false},state,usedUnitIds:[],history:[{state,usedUnitIds:[]}]};
const migrated=m.translateDraft(draft,{direction:'toCanonical'});
const restored=m.translateDraft(migrated,{direction:'toPhysical'});
if(JSON.stringify(draft)!==JSON.stringify(restored))throw Error('Canonical draft round-trip failed');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report={schemaVersion:1,status:'PREVIEW_ONLY',sourceMap:'maps/leningrad.json',sourceMapSHA256:sha(src),coordinateAuthority:'candidate from existing printed-coordinate translation, NOT independently source-certified',sourceSvg:'maps/source/user-svg/leningrad-main.svg',sourceSvgSHA256:sha(path.join(root,'maps/source/user-svg/leningrad-main.svg')),scenarioId:'leningrad',
 physicalCellCount:projection.record.sourceCellCount,canonicalCellCount:projection.record.canonicalCellCount,visualOnlyCellCount:projection.record.visualOnlyCellCount,
 physicalEdgesRetained:projection.record.canonicalPhysicalEdges,syntheticTestUnits:locations.length,syntheticTestHistoryEntries:1,
 deploymentTranslations:locations.map((x,i)=>({sourcePhysicalId:x.hex,candidateCanonicalId:migrated.state.units['synthetic-'+(i+1)].hex,kind:x.kind})),
 stateRoundTripVerified:true,historyRoundTripVerified:true,
 failClosedCases:['unmapped physical sea hex','unknown position reference','nested unit fields','double conversion','invalid projection registry','unknown historic draft fields'],
 productionMapChanged:false,historicalSetupAuthorized:false,saveFormatActivated:false,
 remainingBlockers:['independent historical-coordinate certification','visual-only sea composition','source feature and scenario reference activation','runtime-save-format integration']};
const output=path.join(root,'rules/audit/leningrad-canonical-state-migration-v351.json');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,units:report.syntheticTestUnits,historyRoundTrip:report.historyRoundTripVerified,output:path.relative(root,output)}));
