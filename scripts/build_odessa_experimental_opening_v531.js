#!/usr/bin/env node
/* Reproducible, source-validated experimental Kiev–Odessa opening artifact.
 * Build once in Node; browser consumes data with the SAME campaign engine.
 * This fixture is a disclosed player-choice example, not canonical history. */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const Compose=req('maps/composer');
const base=req('maps/kiev.json'),extension=req('maps/odessa-extension.json');
const combinedMap=Compose.compose(base,extension);
const candidate=req('games/kiev/setup-preview/candidate.json');
const extraPlacements={'soviet-cavalry-corps-a':'1215','soviet-cavalry-corps-b':'1111','soviet-coastal-army':'1513','soviet-black-sea-fleet':'1513','romanian-home-army':'0709','romanian-4th-army':'0809','romanian-cavalry-corps':'1010'};
const sources={root,combinedMap,baseMap:base,extension,setupPolicy:req('maps/setup-configs/kiev-odessa-source-setup-v522.json'),sourceBindingPolicy:req('maps/setup-configs/kiev-odessa-source-face-bindings-v523.json'),overlay:req('maps/roster-overlays/kiev-odessa.json'),kievInventory:req('maps/setup/kiev-inventory.json'),kievCounters:req('maps/counter-configs/kiev.json'),odessaCounters:req('maps/counter-configs/odessa-extension.json'),kievSetupPolicy:req('maps/setup/kiev.json')};
const profile=req('maps/movement-configs/kiev-odessa-experimental-v531.json'),phaseConfig=req('maps/phase-configs/kiev-odessa.json'),counterConfig=req('maps/counter-configs/kiev-odessa-experimental-v531.json'),combatPolicy=req('maps/combat-configs/kiev-odessa-experimental-v531.json');
const Opening=req('core/composite_experimental_campaign_opening'),Campaign=req('core/historical_campaign_session');
const state=Opening.create({sources,allocation:candidate.allocation,basePlacements:candidate.placements,extraPlacements,profile,phaseConfig,counterConfig,combatPolicy,housekeepingPolicy:req('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')});
// The resulting context must *actually* instantiate the authoritative shared
// campaign, otherwise the browser fixture is not publishable.
const session=Campaign.create(state.context);
if(session.snapshot().phaseId!=='german-combat'||session.snapshot().phaseSupported!==true)throw Error('Opening campaign phase is not playable');
const src=Object.fromEntries(['maps/kiev.json','maps/odessa-extension.json','maps/roster-overlays/kiev-odessa.json','games/kiev/setup-preview/candidate.json'].map(rel=>[rel,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex')]));
const manifest={schemaVersion:1,status:'source-pinned-experimental-opening-not-historically-certified',source:'original Kiev and Odessa photographed counter sheets and setup rules; sample selection from Kiev setup-preview/candidate.json',mapId:combinedMap.id,profileScope:profile.experimentalGraphScope,
  audit:state.audit,sourceHashes:src,contextStart:{cursor:state.context.cursor,actor:state.context.actor,state:state.context.state}};
const serialized=JSON.stringify(manifest,null,2)+'\n';
const out=path.join(root,'games/kiev-odessa/experimental-preview/opening-v531.json');
if(process.argv.includes('--check')){
 if(!fs.existsSync(out)||fs.readFileSync(out,'utf8')!==serialized)throw Error('Experimental opening fixture not regenerated from current source');
 console.log('PASS experimental opening manifest matches source, 36 ground + 1 Fleet');
}else{
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,serialized);console.log('Wrote',out,'source-bound ground units',Object.keys(state.context.state.units).length);
}
