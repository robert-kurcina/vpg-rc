'use strict';
// Source-evidence audit; no random deployment is treated as historical fact.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),read=x=>JSON.parse(fs.readFileSync(path.join(ROOT,x),'utf8'));
const h=x=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,x))).digest('hex');
const T=require('../core/scenario_starting_setup');
const Face=require('../core/historical_source_face_inventory');
const map=read('maps/arduous.json'),counter=read('maps/counter-configs/arduous.json');
const setup=read('maps/setup/arduous.json'),plan=read('maps/setup/arduous-inventory.json'),fixed=read('maps/setup/arduous-fixed-pieces.json');
const inventory=Face.create(plan).inspect(counter);
const slots=T.slots(map,setup);
if(!inventory.valid||slots.errors.length)throw Error('Source-backed Arduous roster/slots failed validation');
const groupCounts=Object.fromEntries(Object.entries(plan.groups).map(([k,v])=>[k,v.count]));
const printedCityNames=['Minsk','Baranovichi','Velikie Luki','Gomel','Brest-Litovsk'];
const cities={};for(const cell of map.cells)for(const t of cell.tileMarkers||[])
 if(t.kind==='city'&&printedCityNames.includes(t.label))cities[t.label]={hex:cell.id,sourceSvgId:t.sourceSvgId};
if(Object.keys(cities).length!==printedCityNames.length)throw Error('Unregistered named source cities');
const contradictingMarkers=[];
for(const c of map.cells)for(const t of c.tileMarkers||[]){
 if(t.kind==='fixedMechanized'&&c.id==='0211')contradictingMarkers.push({hex:c.id,kind:t.kind,reason:'Brest has a Garrison, not a Mechanized Corps; rule §6.0'});
 if(t.kind==='fixedMechanized'&&t.faction==='german')contradictingMarkers.push({hex:c.id,kind:t.kind,reason:'Named Soviet rear fixed setup in rule §6.0'});
}
const output={schemaVersion:1,checkpoint:179,version:'v413',scenario:'The Arduous Beginning',
 referenceRules:'references/rules/arduous-rules.pdf §6.0 printed page 2, §11.0 printed page 6',
 sourceHashes:Object.fromEntries(['maps/arduous.json','maps/source/user-svg/arduous-map-temp(3).svg',
  'maps/counter-configs/arduous.json','maps/setup/arduous.json','maps/setup/arduous-inventory.json',
  'maps/setup/arduous-fixed-pieces.json'].map(p=>[p,h(p)])),
 mapSourceSvgMatchesOriginal:map.authoredSourceVectors.sourceSvgSha256===h('maps/source/user-svg/arduous-map-temp(3).svg'),
 counterPoolCounts:inventory.counts,allocationCounts:groupCounts,
 namedCityAnchors:cities,sourceMarkerSlots:Object.fromEntries(Object.entries(slots.slots).map(([kind,items])=>[kind,items.map(item=>item.hex)])),
 namedCityOverrideUsedForMechanized:['Minsk','Baranovichi','Gomel'],
 annotationsRequiringCorrection:contradictingMarkers,
 missingAuthoredMechanizedGlyphAtBaranovichi:!map.cells.find(c=>c.id==='0609').tileMarkers.some(m=>m.kind==='fixedMechanized'),
 reverseOnlyBrest:{hex:fixed.pieces[0].hex,owner:fixed.pieces[0].owner,sourceFaceId:fixed.pieces[0].sourceFaceId,
 reverseFaceId:fixed.pieces[0].reverseFaceId,printedValues:fixed.pieces[0].expectedBackPrintedValues},
 expectedOpeningUnits:30,expectedGerman:16,expectedSoviet:14,
 expectedReinforcements:{sovietArmy:4,sovietMechanized:3,byTurn:plan.reinforcementSchedule},
 sharedSetupImplementation:'core/scenario_starting_setup.js + core/historical_deployment_session.js + core/scenario_opening_bridge.js',
 sharedExceptionalPieceImplementation:'core/historical_fixed_source_pieces.js',
 campaignStatus:'NOT_ACTIVE',movementGraphStatus:'source-geometry-not-gameplay-certified',
 crtStatus:'unchanged B4M common CRT',renderStatus:'unchanged accepted v373 renderer and five map exports',
 limitations:[
  'Named-city anchors are sourced from the rulebook and authored city labels; misleading fixed unit SVG glyph metadata is not accepted as game rules.',
  'No board grid/river hexside combat certification is asserted by this setup audit.',
  'The test chooses deterministic counter faces solely as a legal fixture; source does not prescribe the player-selected starting identity assignment.',
  'The browser route for Arduous remains unactivated until movement/phase/combat integration.'
 ]};
if(!output.mapSourceSvgMatchesOriginal)throw Error('Source SVG digest disagrees');
fs.writeFileSync(path.join(ROOT,'rules/audit/arduous-opening-source-v413.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',setupSlots:Object.fromEntries(Object.entries(slots.slots).map(([k,v])=>[k,v.length])),
 sourceCounterFaces:Object.values(inventory.counts).reduce((a,b)=>a+b,0),openingUnits:output.expectedOpeningUnits,unresolvedVisualAnnotations:contradictingMarkers.length},null,2));
