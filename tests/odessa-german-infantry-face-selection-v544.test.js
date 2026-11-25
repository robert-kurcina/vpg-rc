'use strict';
/* The exact original 11 photographed Kiev German infantry fronts constrain one
 * optional Turn-3 source face exchange in the shared Kiev–Odessa editor. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const E=require('../core/historical_source_setup_editor');
const Campaign=require('../core/historical_campaign_session');
const Human=require('../core/historical_campaign_human');
const opening=require('../games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const policy=require('../games/kiev-odessa/experimental-preview/setup-policy-v534.json');
const map=require('../maps/kiev-odessa-composite-experimental-v531.json');
const counterConfig=require('../maps/counter-configs/kiev-odessa-experimental-v531.json');
const buildupAllocation=require('../games/kiev-odessa/experimental-preview/allocation-v533.json');
const source={opening,policy,map,counterConfig,buildupAllocation};
const base=E.create(source),baseline=base.snapshot(),selection=baseline.infantryFaceSelection;
let n=0;const eq=(a,b,label)=>{assert.deepStrictEqual(a,b,label);n++};
const ok=(v,label)=>{assert.ok(v,label);n++};
const reject=(f,re,label)=>{assert.throws(f,re,label);n++};
const originalReserve='kiev-front-r01c07';
const expected=['kiev-front-r01c08',...Array.from({length:6},(_,i)=>`kiev-front-r02c0${i+1}`)];
eq(selection.eligibleDeployedSlots,expected,'exact seven source 6-4 initially deployed slots');
eq(selection.reserveFaceId,originalReserve,'source Turn 3 reserve 29 before changes');
eq(base.selectedAllocation(),buildupAllocation,'unmodified allocation preserved');
eq(base.commit(),opening,'unmodified physical opening preserved');
const fronts=new Map(counterConfig.faces.front.map(f=>[f.faceId,f]));
const backs=new Map(counterConfig.faces.back.map(f=>[f.faceId,f]));
const other=Object.keys(opening.state.units).filter(id=>!expected.includes(id));
for(const slot of expected){
 const x=base.selectInfantryReserve(slot),v=x.snapshot();
 ok(v.infantryFaceSelection.swappedDeployedSlot===slot,'selected approved physical 6-4 source '+slot);
 eq(v.infantryFaceSelection.reserveFaceId,slot,'exact selected 6-4 reserve identity '+slot);
 eq(v.units[slot].sourceFaceId,originalReserve,'preview shows actual 29 source at substituted slot '+slot);
 eq(v.units[slot].id,slot,'preview retains slot-only interaction identifier '+slot);
 eq(v.placements,baseline.placements,'face swap never moves any source position '+slot);
 const committed=x.commit(),units=committed.state.units,allocation=x.selectedAllocation();
 eq(Object.keys(units).length,36,'physical ground roster count stays at 36 '+slot);
 eq(units[originalReserve].hex,baseline.placements[slot],'29 physical face takes selected 6-4 setup hex '+slot);
 eq(units[originalReserve].id,originalReserve,'physical counter ID rekeyed accurately '+slot);
 eq(units[originalReserve].sourceFaceId,originalReserve,'photographed front identity retained '+slot);
 eq(units[originalReserve].reverseFaceId,fronts.get(originalReserve).pairedFaceId,'printed 29 reverse paired '+slot);
 eq(units[originalReserve].printedCombatStrength,6,'printed 29 6-4 strength restored '+slot);
 ok(!units[slot],'original selected physical 6-4 absent from opening until Turn 3 '+slot);
 eq(allocation.germanReinforcementInfantry,[slot],'only selected source counter reserved '+slot);
 eq(allocation[buildupAllocation.germanPolandInfantry.includes(slot)?'germanPolandInfantry':'germanRomaniaInfantry'].includes(originalReserve),true,'29 assigned correct starting nationality group '+slot);
 eq(new Set(Object.values(allocation).flat()).size,Object.values(allocation).flat().length,'all allocated physical faces remain unique '+slot);
 for(const id of other.filter(id=>id!==originalReserve))eq(units[id],opening.state.units[id],'unaffected source counter byte-identical '+slot+':'+id);
 eq(x.selectInfantryReserve(null).commit(),opening,'reset reverts to original opening '+slot);
 const oldSave=x.save();eq(oldSave.version,3,'changed source assignment uses version-3 save '+slot);
 eq(E.restore(oldSave,source).commit(),committed,'version 3 editor save restores identical game opening '+slot);
 eq(E.restore(oldSave,source).selectedAllocation(),allocation,'version 3 editor save restores Turn 3 allocation '+slot);
 const context={...committed,map,profile:require('../maps/movement-configs/kiev-odessa-experimental-v531.json'),
  config:require('../maps/phase-configs/kiev-odessa.json'),counterConfig,combatPolicy:require('../maps/combat-configs/kiev-odessa-experimental-v531.json'),
  rosterOverlay:require('../maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,
  buildupPolicy:require('../maps/buildup-configs/kiev-odessa-experimental-v533.json'),buildupAllocation:allocation,
  housekeepingPolicy:require('../maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
 const game=Campaign.create(context);eq(game.snapshot().state.units[originalReserve].hex,baseline.placements[slot],'same actual engine starts source selected face '+slot);
 const human=Human.create({session:game,context});
 const first=human.choose({type:'combat',action:{type:'finish-air-sea'}});
 eq(first.snapshot().actionCount,1,'source selected combat action journals '+slot);
 eq(Human.restore(first.save(),context).snapshot(),first.snapshot(),'source selected campaign save restores '+slot);
 eq(first.undo().session.snapshot(),game.snapshot(),'source selected campaign Undo returns exact physical opening '+slot);
}
reject(()=>base.selectInfantryReserve('kiev-front-r01c04'),/invalid-infantry-reserve/,'8-4 face cannot be held for Turn 3');
reject(()=>base.selectInfantryReserve('kiev-front-r01c07'),/invalid-infantry-reserve/,'existing reserve is not a deployed slot');
reject(()=>base.selectInfantryReserve('kiev-front-r02c08'),/invalid-infantry-reserve/,'Romanian nationality cannot be German reserve');
reject(()=>base.selectInfantryReserve('odessa-front-r01c01'),/invalid-infantry-reserve/,'Fleet cannot be German reserve');
reject(()=>base.selectInfantryReserve('kiev-front-r05c02'),/invalid-infantry-reserve/,'Soviet Mechanized cannot be German reserve');
const chosen=base.selectInfantryReserve('kiev-front-r02c06');
const mixed=chosen.mixConcealed([...baseline.concealedSlots.slice(1),baseline.concealedSlots[0]]);
eq(mixed.selectedAllocation().germanReinforcementInfantry,['kiev-front-r02c06'],'reserve selection survives the concealed mixer');
eq(mixed.commit().state.units[originalReserve].hex,baseline.placements['kiev-front-r02c06'],'both independent physical counter substitutions apply');
const saved=chosen.save();
const bad=structuredClone(saved);bad.infantryReserveSlot='kiev-front-r01c04';
reject(()=>E.restore(bad,source),/checksum/i,'unsigned 8-4 substitution rejected');
function sign(v){const {integrity,...data}=v;v.integrity.digest=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');return v}
reject(()=>E.restore(sign(bad),source),/invalid-infantry-reserve/i,'self-signed invalid 8-4 source still rejected');
const foreign=structuredClone(saved);foreign.infantryReserveSlot='kiev-front-r02c08';
reject(()=>E.restore(sign(foreign),source),/invalid-infantry-reserve/i,'self-signed Romanian substitution rejected');
const noSource={opening,map,policy};
reject(()=>E.restore(saved,noSource),/invalid-infantry-reserve/i,'v3 reserve change cannot restore without actual photo/allocation source');
const old=base.save();eq(old.version,2,'unmodified v543 save version stays unchanged');
eq(E.restore(old,source).commit(),opening,'old version-2 source setup save accepted with new pool');
const changedSource=structuredClone(counterConfig);
changedSource.faces.back.find(f=>f.faceId===fronts.get(originalReserve).pairedFaceId).pairedFaceId='kiev-front-r02c01';
reject(()=>E.create({...source,counterConfig:changedSource}),/unverified-infantry-source-face/,'corrupt photographed reverse pair rejected at source check');
const wrongSource=structuredClone(buildupAllocation);wrongSource.germanReinforcementInfantry=['kiev-front-r01c04'];
reject(()=>E.create({...source,buildupAllocation:wrongSource}),/invalid-verified-infantry-face-allocation|unverified-infantry-source-face/,'8-4 cannot be source-bound Turn 3 reinforcement');
console.log('PASS v544 German 6-4 infantry source-face selection:',n,'assertions');
