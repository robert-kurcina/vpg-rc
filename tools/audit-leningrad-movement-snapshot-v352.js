#!/usr/bin/env node
'use strict';
/* Inspect an actual (synthetic-unit) historical movement controller snapshot.
 * No historical counter, save file, or canonical gameplay is activated.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const T=require('../core/terrain_tiles');
const C=require('../core/canonical_hex_projection');
const M=require('../core/canonical_state_migration');
const H=require('../core/historical_movement_lifecycle');
const B=require('../core/movement_binding');
const map=require('../maps/leningrad.json');
const movement=require('../maps/movement-configs/leningrad.json');
const phases=require('../maps/phase-configs/leningrad.json');
const root=path.resolve(__dirname,'..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const projection=C.project(map,c=>T.formatHexNumber(c,T.numberStyle(map,{})));
const translator=M.create(projection.record);
const board=B.build(map,movement).board;
const edge=board.edges.find(e=>e.verified&&!e.impassable&&!e.rail&&board.cells[e.a].verified&&board.cells[e.b].verified&&board.cells[e.b].terrain==='open');
if(!edge)throw Error('No source-certified movement edge available');
const state={scenarioId:'leningrad',units:{fixture:{id:'fixture',owner:'german',class:'infantry',size:'corps',nationality:'german',hex:edge.a,mp:4}}};
const pilot=H.create({map,profile:movement,config:phases,cursor:{scenarioId:'leningrad',turn:2,index:1,complete:false},actor:'german',state});
const moved=pilot.move({unitId:'fixture',path:[edge.a,edge.b]});if(!moved.ok)throw Error('Unable to exercise verified movement edge');
const finish=moved.session.finish();if(!finish.ok)throw Error('Unable to finish permitted movement phase');
const input=finish.session.snapshot();
const candidate=translator.translateMovementSnapshot(input,{direction:'toCanonical',allowUnmarkedLegacy:true,phaseConfig:phases});
const reversed=translator.translateMovementSnapshot(candidate,{direction:'toPhysical',phaseConfig:phases});
const normalized=structuredClone(input);normalized.state.hexIdSpace='legacy-physical';
for(const h of normalized.history)h.state.hexIdSpace='legacy-physical';
if(JSON.stringify(normalized)!==JSON.stringify(reversed))throw Error('Real movement snapshot failed round trip');
const report={schemaVersion:1,status:'PREVIEW_ONLY',checkpoint:118,scenarioId:'leningrad',
 canonicalRegistrationAuthority:'candidate from current printed-label translation; NOT independently historical-certified',
 productionSaveIntegration:false,canonicalIDsActivated:false,
 sourceMapSHA256:sha('maps/leningrad.json'),sharedRendererSHA256:sha('core/terrain_tiles.js'),
 physicalFrom:edge.a,physicalTo:edge.b,canonicalFrom:projection.record.physicalToCanonical[edge.a],canonicalTo:projection.record.physicalToCanonical[edge.b],
 phaseAfterFinish:phases.phases[input.cursor.index].id,undoEntries:input.history.length,
 priorPhase:phases.phases[input.history.at(-1).cursor.index].id,
 currentStateAndPriorCursorPreserved:true,roundTripPassed:true,
 certifiedPhysicalBoardCells:map.cells.length,candidateCanonicalCells:projection.record.canonicalCellCount,
 visualOnlyCells:projection.record.visualOnlyCellCount,
 blockers:['historical coordinate certification','visual-only water rendering composition','full game references','production save/restore versioning','combat consequences and Undo integration']};
const out=path.join(root,'rules/audit/leningrad-movement-snapshot-migration-v352.json');
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,from:report.physicalFrom,to:report.physicalTo,undoEntries:report.undoEntries,roundTrip:report.roundTripPassed,output:path.relative(root,out)}));
