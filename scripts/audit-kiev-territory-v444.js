'use strict';
/* Provenance audit, not a political-border reconstruction or live rules mask.
 * The source §10.8 identifies four Romanian STARTING POSITIONS, not all
 * hexes that could contain a Turn-1 defending Axis unit in Romania.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const M=require('../maps/kiev.json');
const T=require('../core/terrain_tiles');
const setup=require('../maps/setup/kiev.json');
const rule=require('../maps/combat-configs/kiev-turn-rules-v443.json');
const sha=filename=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,filename))).digest('hex');
const ROMANIA=Object.freeze(['0709','0809','0910','1010']);
const SOVIET_BORDER=Object.freeze(['0708','0808','1110']);
function audit(){
 const cells=new Map(M.cells.map(c=>[c.id,c]));
 if(cells.size!==M.cells.length)throw Error('Duplicate Kiev hostCells');
 if(sha('references/rules/kiev-rules.pdf')!==rule.sourceSha256)throw Error('Kiev rulebook source hash drift');
 if(JSON.stringify(ROMANIA)!==JSON.stringify(rule.firstTurnCombatRestriction.setupHexes))throw Error('Romanian starting position mismatch');
 if(JSON.stringify(SOVIET_BORDER)!==JSON.stringify(rule.firstTurnTerritorialOriginCandidate.allowedOpeningHexes))throw Error('Soviet border origin mismatch');
 if(Object.hasOwn(rule,'firstTurnTerritorialRestriction')||Object.hasOwn(rule.firstTurnTerritorialOriginCandidate,'targetHexes'))
  throw Error('Source candidate improperly declares a complete territory');
 const crosses=new Set(M.cells.filter(c=>(c.tileMarkers||[]).some(m=>m.kind==='cross')).map(c=>c.id));
 const stars=new Set(M.cells.filter(c=>(c.tileMarkers||[]).some(m=>m.kind==='star')).map(c=>c.id));
 for(const id of ROMANIA){if(!cells.has(id)||!crosses.has(id))throw Error('Romania named setup hex lacks source cross: '+id);}
 for(const id of SOVIET_BORDER){if(!cells.has(id)||!stars.has(id))throw Error('Soviet named origin lacks source star: '+id);}
 const sides=['N','NE','SE','S','SW','NW'];
 const physicalContacts=[];
 for(const origin of SOVIET_BORDER){
  const c=cells.get(origin);
  for(const side of sides){
   const to=T.neighbor(c,side,M.geometry);
   if(ROMANIA.includes(to))physicalContacts.push({sovietBorderOrigin:origin,romanianInitialAxisHex:to,side});
  }
 }
 if(!SOVIET_BORDER.every(id=>physicalContacts.some(c=>c.sovietBorderOrigin===id)))
  throw Error('A source-named Soviet border origin lacks adjacency to Romanian initial deployment');
 const unclassified=[...cells.keys()].filter(id=>!ROMANIA.includes(id)).sort();
 return {
  schemaVersion:1,checkpoint:210,version:'v444',scenarioId:'kiev',
  status:'source-certified-initial-setup-positions-only; national-territory-mask-unresolved',
  governingRule:'references/rules/kiev-rules.pdf printed page 5 §10.8',
  source:{rulesPdfSha256:rule.sourceSha256,mapScanSha256:sha('maps/source/kiev-map-scan.jpg'),
   mapJsonSha256:sha('maps/kiev.json'),setupJsonSha256:sha('maps/setup/kiev.json')},
  certifiedFromPrintedSetupAndApprovedMap:{romanianInitialAxisHexes:[...ROMANIA],sovietEligibleOpeningHexes:[...SOVIET_BORDER],
   adjacentInitialLineContacts:physicalContacts},
  targetTerritory:{coverage:'incomplete',completeMaskAvailable:false,unclassifiedHostCells:unclassified,
   unclassifiedCount:unclassified.length,sourceBorderGeometry:'not present as a certified national-border layer',
   caution:'These four Romanized setup positions are NOT the full Romanian territory. Other cells may be in Romania; do not activate firstTurnTerritorialRestriction.'},
  mapHexCount:cells.size,sourcePolicy:'read-only evidence: does not write map, setup, combat config or gameplay state'
 };
}
if(require.main===module){
 const out=path.join(ROOT,'rules/audit/kiev-romania-territory-evidence-v444.json');
 fs.writeFileSync(out,JSON.stringify(audit(),null,2)+'\n');
 console.log(`PASS Kiev §10.8 source territory audit; ${ROMANIA.length} Romanian starting hexes, ${SOVIET_BORDER.length} Soviet border origins; no full national mask`);
}
module.exports=Object.freeze({audit,ROMANIA,SOVIET_BORDER});
