'use strict';
/* Source §6 setup preflight. Does not authorize the combined campaign. */
const assert=require('node:assert/strict');
const path=require('node:path');
const A=require('../core/composite_setup_source_preflight');
const Compose=require('../maps/composer');
const base=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const overlay=require('../maps/roster-overlays/kiev-odessa.json');
const policy=require('../maps/setup-configs/kiev-odessa-source-setup-v522.json');
const root=path.resolve(__dirname,'..');
const map=Compose.compose(base,ext),clone=x=>JSON.parse(JSON.stringify(x));
let checks=0;const eq=(x,y,msg)=>{assert.deepEqual(x,y,msg);checks++};
const yes=(v,msg)=>{assert.ok(v,msg);checks++};
const fails=(fn,p,msg)=>{assert.throws(fn,p,msg);checks++};
const build=(args={})=>A.create({map,overlay,policy,root,...args});
const x=build(),a=x.audit;
eq(a.status,'diagnostic-not-gameplay-authorized');eq(a.gameplayCertified,false);
eq(a.rearHexes,['0406','0705','0803','1007','1106','1215','1309']);
eq(a.expectedFrontlineStarCount,11);eq(a.actualFrontlineStarHexes.length,12);
yes(a.actualFrontlineStarHexes.includes('1111'),'Preserve explicit Kiev–Odessa user-adjudicated star');
yes(a.actualFrontlineStarHexes.includes('1113'),'Preserve original additional star');
eq(a.mismatchedRear,[{hex:'1309',expected:'fixedMechanized',observed:[]}]);
yes(a.otherFixedMarkers.some(m=>m.hex==='0706'&&m.kinds.includes('fixedMechanized')),'Unlisted 0706 fixed mech exposed');
yes(a.otherFixedMarkers.some(m=>m.hex==='1513'&&m.kinds.includes('fixedInfantry')),'Coastal Odessa extra fixed infantry visible, not mistaken for rear pool');
yes(a.unclassifiedLandCells>0,'Uncertified country map not silently classified');
yes(a.blockers.includes('frontline-stars:12-instead-of-11'),'PDF star count conflict surfaced');
yes(a.blockers.includes('rear-deployment-symbol-disagreement'),'1309 marker gap surfaced');
yes(a.blockers.some(s=>s.startsWith('unclassified-political-territory:')),'Romanian territory gap surfaced');
yes(a.blockers.includes('unbound-base-romanian-unit'),'Kiev base binding missing');
yes(a.blockers.includes('unbound-base-german-infantry'),'Kiev German base binding missing');
fails(()=>x.certify(),/cannot-certify:frontline-stars/);
const rear=Object.entries(policy.rearSoviet.positions).map(([hex,type])=>({hex,type}));
eq(x.validateRear(rear).valid,true);eq(x.validateRear(rear).needsMarkerReconciliation,true);eq(x.validateRear(rear.slice().reverse()).valid,true);
for(const [bad,match] of [
 [rear.slice(0,-1),/invalid-unit-distribution/],
 [rear.map(p=>p.hex==='1309'?{...p,hex:'0706'}:p),/illegal-rear-setup/],
 [rear.map(p=>p.hex==='1309'?{...p,type:'infantry-army'}:p),/invalid-unit-distribution/],
 [rear.map(p=>p.hex==='1215'?{...p,type:'mechanized-corps'}:p),/invalid-unit-distribution/],
 [rear.map(p=>p.hex==='1215'?{...p,hex:'1513'}:p),/illegal-rear-setup/]
])fails(()=>x.validateRear(bad),match);
const frontline=a.actualFrontlineStarHexes.filter(h=>h!=='0205');
const armies=['0304','0401','0503','0708'];
const nonArmies=frontline.filter(hex=>!armies.includes(hex));
const front=frontline.map(hex=>({hex,type:armies.includes(hex)?'infantry-army':hex===nonArmies[0]?'cavalry-corps':'mechanized-corps'}));
eq(front.filter(p=>p.type==='infantry-army').length,4);eq(front.filter(p=>p.type==='mechanized-corps').length,6);eq(front.filter(p=>p.type==='cavalry-corps').length,1);
const valid=x.validateFrontline(front);yes(valid.valid);yes(valid.needsStarAdjudication);eq(valid.selectedSourceStarSubset.length,11);
fails(()=>x.validateFrontline([...front.slice(0,-1),{hex:'1310',type:front.at(-1).type}]),/illegal-frontline-setup/);
fails(()=>x.validateFrontline([...front.slice(0,-1),{...front[0]}]),/invalid-unit-distribution/);
fails(()=>x.validateFrontline([...front.slice(0,-1),{hex:front[0].hex,type:'cavalry-corps'}]),/invalid-unit-distribution/);
const adjacent=front.map(p=>({...p}));
// Two adjacent star hexes 0304 / 0305 must not both hold armies.
const armyAt=adjacent.find(p=>p.hex==='0708');const mechAt=adjacent.find(p=>p.hex==='0305');
if(mechAt){armyAt.type=mechAt.type;mechAt.type='infantry-army';fails(()=>x.validateFrontline(adjacent),/adjacent-frontline-armies/);}
// Synthetic Romanian territory tests: no geographic inference from absent labels.
const roma=['0709','0809','0910','1010','1012','1014','1016'];
const romUnits=roma.map((hex,i)=>({hex,id:'candidate-'+i,side:i<3?'german':'romanian',type:i<3?'infantry-corps':'ground'}));
const mask=Object.fromEntries(roma.map(h=>[h,'romania']));
yes(x.validateRomania(romUnits,mask).valid,'Synthetic classification can validate a candidate, never certify history');eq(x.validateRomania(romUnits,mask).unitIdentityCertified,false);eq(x.validateRomania(romUnits,mask).stackingCertified,false);
const groupedRomania=romUnits.map(u=>({...u}));groupedRomania[5].hex=groupedRomania[4].hex;
yes(x.validateRomania(groupedRomania,mask).valid,'Setup preflight does not invent one-unit-per-hex rule; stacking needs separate validation');
fails(()=>x.validateRomania(romUnits,{}),/unverified-or-non-romanian/);
fails(()=>x.validateRomania(romUnits,{...mask,'1016':'bessarabia'}),/unverified-or-non-romanian/);
const wrongfulBessarabia=[...romUnits.slice(0,-1),{...romUnits.at(-1),hex:'1111'}];
fails(()=>x.validateRomania(wrongfulBessarabia,{...mask,'1111':'romania'}),/unverified-or-non-romanian/);
fails(()=>x.validateRomania(romUnits.slice(0,-1),mask),/invalid-axis/);
fails(()=>x.validateRomania([...romUnits.slice(0,-1),{...romUnits[0]}],mask),/invalid-axis/);
// Negative source assertions: silent map/counter/rule drift is forbidden.
fails(()=>build({policy:{...policy,frontlineSoviet:{...policy.frontlineSoviet,expectedHexes:12}}}),/invalid-source-policy/);
fails(()=>build({policy:{...policy,rearSoviet:{...policy.rearSoviet,positions:{...policy.rearSoviet.positions,'1309':'infantry-army'}}}}),/rules-section-6/);
fails(()=>build({policy:{...policy,source:{...policy.source,odessaRulesSha256:'0'.repeat(64)}}}),/source-pdf-mismatch/);
const tamperedMap=clone(map);tamperedMap.cells.find(c=>c.id==='1513').city.name='Kherson';
fails(()=>build({map:tamperedMap}),/source-map-or-port-invalid/);
const tamperedOverlay=clone(overlay);tamperedOverlay.setupConstraints.romanianGround.count=3;
fails(()=>build({overlay:tamperedOverlay}),/counter-roster-setup-disagreement/);
console.log('PASS v522 Odessa §6 setup preflight',checks,'assertions. Source marker conflicts',a.mismatchedRear.length,'and frontline extra markers',a.actualFrontlineStarHexes.length-a.expectedFrontlineStarCount,'remain NOT gameplay-certified.');
