'use strict';
/* The setup preview is a source-constrained editor, NOT Kiev game activation. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const fixture=require('./fixtures/kiev-source-opening-v437');
const Projection=require('../core/historical_counter_face_projection');
const Inventory=require('../core/historical_source_face_inventory');
const Deployment=require('../core/historical_deployment_session');
const P=require('../maps/movement-configs/kiev.json');
const root=path.resolve(__dirname,'..');
const config=require('../games/kiev/setup-preview/config.json');
const candidate=require('../games/kiev/setup-preview/candidate.json');
const projectionSource=fixture.counterConfig;
let assertions=0;
function eq(x,y,m){assert.deepEqual(x,y,m);assertions++}
function yes(x,m){assert.ok(x,m);assertions++}
function throws(fn,re,m){assert.throws(fn,re,m);assertions++}
eq(config.mode,undefined,'Kiev uses shared experimental historical browser mode');
eq(config.scenarioId,'kiev','source scenario correct');
yes(config.status.includes('experimental-human-campaign')&&config.status.includes('not-historically-certified'),'scenario labels incomplete historical certification');
eq(candidate.allocation,fixture.allocation,'sample allocations derive from existing source-reviewed opening fixture');
eq(candidate.placements,fixture.placements,'sample locations derive from same source-reviewed fixture');
eq(candidate.status,'synthetic-legal-sample-not-historical-starting-allocation','candidate is not claimed as historical order');
eq(Object.keys(candidate.placements).length,30,'thirty starting counters');
yes(P.executableStatus==='source-reviewed-experimental-browser','source-reviewed movement available for experimental play');
const html=fs.readFileSync(path.join(root,'games/kiev/setup-preview/index.html'),'utf8');
yes(html.includes('Experimental gameplay')&&html.includes('historical certification incomplete'),'experimental warning is visible on page');
yes(html.includes('Begin Turn 1'),'setup can begin campaign after concealed mixing');
yes(html.includes('core/historical_browser_app.js'),'uses same browser controls as historic games');
yes(html.includes('core/historical_engine_browser_bundle.js'),'uses same engine bundle as historic games');
const source={map:fixture.map,setupSpec:fixture.setupSpec,counterConfig:projectionSource,
 inventory:Inventory.create(require('../maps/setup/kiev-inventory.json')),
 phaseConfig:require('../maps/phase-configs/kiev.json'),movementProfile:P,
 phaseFactories:{combat:()=>({})}};
const d=Deployment.create({...source,allocation:candidate.allocation,placements:candidate.placements});
eq(d.choices(candidate.allocation.germanInitialPanzer[0]),['0105','0203','0204','0301','0302','0303','0402'],'Poland only');
eq(d.choices(candidate.allocation.romanianInitialArmy[0]),['0709','0809','0910','1010'],'Romania only');
// Kiev has a photographed Mountain Infantry unit. The universal counter
// renderer uses an infantry glyph but must retain its source-printed values,
// counter identity, and verified front/back pairing rather than dropping it.
const id='kiev-front-r02c06';
const face=projectionSource.faces.front.find(x=>x.faceId===id);
yes(face&&face.visualTranscription.kind==='mountain-infantry','source identifies a mountain infantry');
const opening={...d.snapshot().units[id]};
yes(opening.sourceFaceId===id,'source face is in starting sample');
const art=Projection.project(opening,projectionSource);
eq(art.printedIdentifier,'49 Mtn','mountain identity is printed on counter');
eq(art.printedValues,'6-4','mountain combat/movement values preserved');
eq(art.art.counter.nato,'infantry','standard infantry glyph fallback documented');
const reversed=Projection.project({...opening,strengthStatus:'printed-reduced',activeFaceId:face.pairedFaceId},projectionSource);
eq(reversed.printedValues,'3-4','printed reverse source values retained');
eq(reversed.printedIdentifier,'49 Mtn','printed reverse source identity retained');
console.log('PASS v469 Kiev setup preview source, safety and mountain art:',assertions,'assertions');
