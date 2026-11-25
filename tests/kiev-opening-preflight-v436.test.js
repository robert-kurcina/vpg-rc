'use strict';
/* Checkpoint 202: Kiev source-grounded inventory and reinforcement preflight.
 * Deliberately does NOT certify the disputed front-line star setup or activate Kiev.
 * Test face allocation exercises constraints; it is NOT a historical deployment. */
const A=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const M=require('../maps/kiev.json'),K=require('../maps/counter-configs/kiev.json');
const I=require('../maps/setup/kiev-inventory.json'),S=require('../maps/setup/kiev.json');
const B=require('../maps/buildup-configs/kiev.json'),F=require('../maps/phase-configs/kiev.json');
const Inv=require('../core/historical_source_face_inventory'),Setup=require('../core/scenario_starting_setup');
const Phase=require('../core/phase_runtime'),Building=require('../core/historical_buildup_phase');
const Graph=require('../core/map_movement_graph');
const clone=x=>JSON.parse(JSON.stringify(x));
let n=0;
const eq=(x,y,label)=>{A.deepEqual(x,y,label);n++;};
const yes=(x,label)=>{A.ok(x,label);n++;};
const fails=(fn,re,label)=>{A.throws(fn,re,label);n++;};
const hash=x=>crypto.createHash('sha256').update(fs.readFileSync(x)).digest('hex');
const sourceIndex=require('../references/rules/SOURCE_INDEX.json');
for(const filename of ['kiev-rules.pdf','kiev-player-aid.webp']){
 const source=sourceIndex.items.find(x=>x.file===filename);
 eq(hash('references/rules/'+filename),source.sha256,'pinned rules and turn track '+filename);
}
const official=K.faceSource;
for(const side of ['front','back'])eq(hash(official[side].file),official[side].sha256,'unchanged source counter '+side);
eq(hash('maps/source/user-svg/kiev-odessa-main.svg'),M.definitiveTerrainAudit.sourceSvgSha256,'authoritative Kiev source SVG pin');
eq(K.mapId,'kiev');eq(M.sourceGame,'Objective: Kiev');
const inventory=Inv.create(I),read=inventory.inspect(K);
yes(read.valid,read.errors.join('; '));
eq(read.counts,{germanPanzer:3,germanInfantry:11,romanianArmy:1,hungarianInfantry:1,
 slovakInfantry:1,italianMotorized:1,sovietArmies:9,sovietMechanized:10,airSupport:2,gameTurn:1});
eq(Object.values(read.counts).reduce((sum,x)=>sum+x,0),40);
eq(I.groundPools.reduce((sum,p)=>sum+read.counts[p],0),37);
eq(I.groundPools.every(p=>read.pools[p].every(f=>f.startsWith('kiev-front-'))),true);
eq(read.pools.germanInfantry.filter(id=>K.faces.front.find(x=>x.faceId===id).visualTranscription.kind==='mountain-infantry').length,1);
const front=new Map(K.faces.front.map(f=>[f.faceId,f]));
const backs=new Map(K.faces.back.map(f=>[f.faceId,f]));
for(const f of K.faces.front){const b=backs.get(f.pairedFaceId);yes(b,'complete counter reverse');eq(b.pairedFaceId,f.faceId);}
for(const id of read.pools.sovietMechanized){
 eq(front.get(id).visualTranscription.printedValues,'?-6');
 yes(/^\d+·\d+·6$/.test(backs.get(front.get(id).pairedFaceId).visualTranscription.printedValues));
}
// All 37 photographed ground faces must be allocated exactly once. This explicit
// example has NO historical authority; the starting map remains blocked.
const selected={},used=new Set();
const pick=(group,override)=>{
 const g=I.groups[group],options=override||read.pools[g.pool].filter(id=>!used.has(id));
 const ids=options.slice(0,g.count);
 eq(ids.length,g.count,'source pool has enough faces '+group);
 for(const id of ids){yes(!used.has(id),'not previously assigned '+id);used.add(id);}
 selected[group]=ids;
};
const reinfCandidate=read.pools.germanInfantry.find(id=>{
 const t=front.get(id).visualTranscription;return t.kind==='infantry'&&t.printedValues==='6-4';
});
yes(Boolean(reinfCandidate));
selected.germanReinforcementInfantry=[reinfCandidate];used.add(reinfCandidate);
for(const group of Object.keys(I.groups).filter(g=>g!=='germanReinforcementInfantry'))pick(group);
yes(inventory.validateAllocation(K,selected).valid,'no fabricated ground faces');
eq(Object.values(selected).flat().length,37);
const cloned=clone(selected);cloned.germanReinforcementInfantry=[selected.germanPolandInfantry[0]];
yes(!inventory.validateAllocation(K,cloned).valid,'duplicate German face blocked');
const wrongStrength=clone(selected);
const eight=selected.germanPolandInfantry.find(id=>front.get(id).visualTranscription.printedValues==='8-4');
wrongStrength.germanReinforcementInfantry=[eight];
wrongStrength.germanPolandInfantry[wrongStrength.germanPolandInfantry.indexOf(eight)]=reinfCandidate;
yes(inventory.validateAllocation(K,wrongStrength).errors.some(s=>s.includes('Wrong rulebook strength')),'6-4 reinforcement role source-validated');
const changedKinds=clone(I);changedKinds.pools.germanInfantry.kinds=['infantry'];
fails(()=>Inv.create(changedKinds),/invalid-pool/,'cannot silently erase source mountain face by malformed multi-kind pool');
const fchanged=clone(K);fchanged.faces.back.find(f=>f.faceId===front.get(reinfCandidate).pairedFaceId).visualTranscription.kind='tank';
yes(!inventory.inspect(fchanged).valid,'mixed infantry reverse source tamper rejected');
// Rule §6: 30 ground units start: 14 Axis (including Romanian) + 16 Soviet.
eq(S.expectedStartingUnits,30);
eq(Object.values(S.groups).reduce((sum,g)=>sum+g.count,0),30);
eq(Object.values(S.groups).filter(g=>g.owner==='german').reduce((sum,g)=>sum+g.count,0),14);
eq(Object.values(S.groups).filter(g=>g.owner==='soviet').reduce((sum,g)=>sum+g.count,0),16);
eq(S.concealedSetup.count,10);
const ss=Setup.slots(M,S);
eq(ss.slots.cross.length,11);
eq(ss.slots.fixedInfantry.map(x=>x.hex).sort(),['0406','1007']);
eq(ss.slots.fixedMechanized.map(x=>x.hex).sort(),['0705','0803','1106','1309']);
eq(ss.slots.star.length,10);
eq(ss.slots.star.filter(x=>x.sourceSvgId).length,8);
eq(ss.slots.star.filter(x=>!x.sourceSvgId).map(x=>x.hex),['0502','0708']);
eq(ss.errors,[],'Kiev now has 10 front-line markers; full historical authorization remains independent');
const region=(name)=>S.groups[name].allowedHexes;
eq(region('germanInitialPanzer').length,7);
eq(region('germanPolandInfantry'),region('germanInitialPanzer'));
eq(region('germanRomaniaInfantry'),region('romanianInitialArmy'));
eq(region('germanRomaniaInfantry'),['0709','0809','0910','1010']);
const Romania=new Set(region('romanianInitialArmy'));
eq(ss.slots.cross.filter(x=>Romania.has(x.hex)).length,4);
for(const g of ['germanInitialPanzer','germanPolandInfantry'])
 yes(S.groups[g].allowedHexes.every(h=>!Romania.has(h)),'cannot start German Poland face in Romania '+g);
// Build a non-authoritative fixture to prove the shared setup validator fails
// for the specific source count mismatch, not for unrelated missing faces.
const placement={};
const poland=region('germanInitialPanzer');
selected.germanInitialPanzer.forEach((id,i)=>placement[id]=poland[i]);
selected.germanPolandInfantry.forEach((id,i)=>placement[id]=poland[i]);
selected.germanRomaniaInfantry.forEach((id,i)=>placement[id]=region('germanRomaniaInfantry')[i]);
placement[selected.romanianInitialArmy[0]]=region('romanianInitialArmy')[3];
selected.sovietFixedArmies.forEach((id,i)=>placement[id]=S.groups.sovietFixedArmies.allowedHexes[i]);
selected.sovietFixedMechanized.forEach((id,i)=>placement[id]=S.groups.sovietFixedMechanized.allowedHexes[i]);
const sovArmies=['0401','0205','0304','0503'];
selected.sovietFrontArmies.forEach((id,i)=>placement[id]=sovArmies[i]);
const sovMech=ss.slots.star.map(x=>x.hex).filter(x=>!sovArmies.includes(x)).slice(0,6);
selected.sovietFrontMechanized.forEach((id,i)=>placement[id]=sovMech[i]);
const rejected=Setup.validate({map:M,spec:S,counterConfig:K,inventory,allocation:selected,placements:placement});
yes(rejected.sourceMarkerCounts.star===10,'ten authorized marker slots checked in full setup validator');
yes(!rejected.errors.includes('Marker count/uniqueness mismatch star'),'no obsolete marker-count failure');
yes(!rejected.historicalSetupAuthorized&&!rejected.productionGameActivated,'no accidental live promotion');
const wrongRegion=clone(placement);wrongRegion[selected.romanianInitialArmy[0]]=poland[0];
yes(Setup.validate({map:M,spec:S,counterConfig:K,inventory,allocation:selected,placements:wrongRegion})
 .errors.some(e=>e.includes('Outside source-approved group region')),'region checks actually enforced');
const bogusRegion=clone(S);bogusRegion.groups.romanianInitialArmy.allowedHexes=['0101'];
yes(Setup.slots(M,bogusRegion).errors.some(e=>e.includes('Invalid rulebook placement region')),'forged source-region rejected');
// The player aid gives replacement steps for seven turns (not a guess).
eq(B.replacementSteps.german,[0,0,0,1,1,1,1]);
eq(B.replacementSteps.soviet,[0,2,2,3,3,4,4]);
eq(B.reinforcements.length,6);
eq(B.reinforcements.map(s=>[s.turn,s.group]),[
 [2,'slovakReinforcementInfantry'],[2,'hungarianReinforcementInfantry'],
 [3,'germanReinforcementInfantry'],[3,'italianReinforcementMotorized'],
 [5,'sovietReinforcementArmies'],[6,'sovietReinforcementArmies']
]);
const ledgerSlots=new Set(),ledgerFaces=new Set();
for(const slot of B.reinforcements){
 yes(!ledgerSlots.has(slot.slotId));ledgerSlots.add(slot.slotId);
 const id=selected[slot.group][slot.index],t=front.get(id).visualTranscription;
 yes(!ledgerFaces.has(id));ledgerFaces.add(id);
 eq(t.printedAffiliation,slot.printedAffiliation);
 yes((slot.printedKinds||[slot.printedKind]).includes(t.kind));
 if(slot.printedValues)eq(t.printedValues,slot.printedValues);
 eq(slot.nationality,Building.sourceNationality(front.get(id)));
 eq(slot.kind,'ground');eq(slot.placement,'edge');eq(slot.strength,'full');
}
for(const c of ['romanianArmy','hungarianInfantry','slovakInfantry','italianMotorized']){
 const f=front.get(read.pools[c][0]);
 eq(Building.sourceNationality(f),f.visualTranscription.printedAffiliation);
 fails(()=>Building.sourceNationality(f,'german'),/nationality disagrees/);
}
const kievStackProfile=require('../maps/movement-configs/kiev.json');
const romanianUnit={owner:'german',nationality:'romanian'};
const hungarianUnit={owner:'german',nationality:'hungarian'};
yes(!Building.allowedNationalStack(kievStackProfile,'hungarian',[romanianUnit]),'no Hungarian reinforcement into Romanian stack');
yes(!Building.allowedNationalStack(kievStackProfile,'romanian',[hungarianUnit]),'symmetric nationality exclusion');
yes(Building.allowedNationalStack(kievStackProfile,'slovak',[romanianUnit]),'Slovak + Romanian not accidentally prohibited');
yes(Building.allowedNationalStack(kievStackProfile,'italian',[hungarianUnit]),'Italian + Hungarian not accidentally prohibited');
yes(Building.allowedNationalStack(kievStackProfile,'hungarian',[]),'empty Axis entry legal');
fails(()=>Building.allowedNationalStack({nationalStackExclusions:[['romanian']]},'hungarian',[romanianUnit]),/Malformed nationality/);
eq(Building.sourceNationality(front.get(read.pools.germanPanzer[0])),'german');
fails(()=>Building.sourceNationality(front.get(read.pools.hungarianInfantry[0]),'italian'),/nationality disagrees/);
eq(B.replacementOnlyReserveGroup,'sovietReplacementOnlyArmy');
eq(B.replacementOnlyEarliestTurn,2);
const reserveId=selected.sovietReplacementOnlyArmy[0];
yes(!Building.replacementReserveEligible(reserveId,1,[],B,selected),'no premature reserve entry on Turn 1');
yes(Building.replacementReserveEligible(reserveId,2,[],B,selected),'reserve is due from Turn 2');
yes(Building.replacementReserveEligible(reserveId,7,[],B,selected),'unused reserve is still available later');
yes(!Building.replacementReserveEligible(reserveId,2,[reserveId],B,selected),'after first admission use ordinary rebuild logic');
yes(!Building.replacementReserveEligible(selected.sovietReinforcementArmies[0],2,[],B,selected),'scheduled arrivals not replacement-only reserves');
const invalidEarly=clone(B); invalidEarly.replacementOnlyEarliestTurn=3;
yes(!Building.replacementReserveEligible(reserveId,2,[],invalidEarly,selected),'earliest source turn enforced');
eq(selected.sovietReplacementOnlyArmy.length,1);
yes(!ledgerFaces.has(selected.sovietReplacementOnlyArmy[0]),'replacement-only army not smuggled into reinforcement schedule');
eq(B.initialCityControl.Lublin,'german');eq(B.initialCityControl.Iasi,'german');
eq(Object.values(B.initialCityControl).filter(x=>x==='german').length,2);
eq(Object.keys(B.initialCityControl).length,16);
for(const side of ['german','soviet']){
 const drawn=new Set(M.entryBoundarySelections.paths.filter(p=>p.side===side).flatMap(p=>p.edges.map(e=>e.cellId)));
 eq([...B.entryEdge[side]].sort(),[...drawn].sort(),'entry boundary selection matches existing source visualization only');
}
eq(B.entryEdge.german.length,19);eq(B.entryEdge.soviet.length,12);
yes(B.sourceBoundaryStatus.includes('NOT_RULE_CERTIFIED'),'border candidate not falsely promoted');
eq(Phase.start(F).index,2);eq(Phase.current(F,Phase.start(F)).id,'german-combat');
fails(()=>Graph.build({...M,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified|provisional|not.*certified/,'unapproved map remains gated');
const report={checkpoint:202,version:'v436',assertions:n,sourceFilePins:{rules:hash('references/rules/kiev-rules.pdf'),
 playerAid:hash('references/rules/kiev-player-aid.webp'),sourceSvg:hash('maps/source/user-svg/kiev-odessa-main.svg'),
 counterFront:hash(official.front.file),counterBack:hash(official.back.file)},
 sourceInventory:{facePairs:K.faces.front.length,ground:37,nonGround:3,pools:read.counts,startingGround:30,
 reinforcementGround:6,sovietReplacementOnly:1},
 openingMarkerAudit:{sourceMapStarCount:ss.slots.star.length,svgAuthoredStarCount:8,nonSvgStarHexes:['0502','0708'],
 rulesStarCount:10,germanCrossCount:11,fixedInfantryHexes:ss.slots.fixedInfantry.map(x=>x.hex).sort(),
 fixedMechanizedHexes:ss.slots.fixedMechanized.map(x=>x.hex).sort(),
 blockingErrors:ss.errors,sourceAuthorization:'candidate-slots-match-not-activated'},
 tracks:{reinforcements:B.reinforcements.map(s=>({slotId:s.slotId,turn:s.turn,owner:s.owner,nationality:s.nationality,group:s.group})),
 replacementSteps:B.replacementSteps},
 knownBlockers:['Kiev counter face allocations and historical opening gameplay still require certification','Kiev graph still provisional',
 'SVG-derived entry borders remain visual candidates, not independent rule certification']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/kiev-opening-preflight-v436.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS Kiev opening inventory and reinforcement preflight:',n,'assertions; front-line marker count reconciled; gameplay authorization remains blocked');
