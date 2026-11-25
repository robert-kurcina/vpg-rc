/* Odessa §6 setup audit and non-executable allocation validator.
 * The printed rulebook is the constraint authority; map marker disagreement is
 * reported, never silently erased or accepted as a legal historical setup.
 */
'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const T=require('./terrain_tiles');
const fail=m=>{throw Error('odessa-setup-preflight: '+m);};
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const exactly=(a,b)=>JSON.stringify(a.slice().sort())===JSON.stringify(b.slice().sort());
const kinds=Object.freeze({'infantry-army':'fixedInfantry','mechanized-corps':'fixedMechanized','cavalry-corps':'fixedCavalry'});
function create({map,overlay,policy,root='.'}){
 if(!map?.cells||!map?.geometry||!obj(overlay)||!obj(policy)||
    policy.schemaVersion!==1||policy.scenarioId!=='kiev-odessa'||
    policy.status!=='source-setup-audit-not-gameplay-authorized'||
    overlay.standalone!==false||overlay.baseGame!=='kiev'||
    !obj(policy.rearSoviet?.positions)||!obj(policy.frontlineSoviet?.counts)||
    policy.frontlineSoviet.expectedHexes!==11||
    !obj(policy.odessaPortStart)||!obj(policy.romaniaStart)||!obj(policy.romanianAir))fail('invalid-source-policy');
 for(const [name,digest] of [['odessaRules','odessaRulesSha256'],['kievRules','kievRulesSha256']]){
  const file=policy.source?.[name],sha=policy.source?.[digest];
  if(!['references/rules/odessa-rules.pdf','references/rules/kiev-rules.pdf'].includes(file)||
     typeof sha!=='string'||!/^[a-f0-9]{64}$/.test(sha)||
     crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')!==sha)
   fail('source-pdf-mismatch:'+name);
 }
 const rear=policy.rearSoviet.positions;
 const prescribed={"0406":"infantry-army","0705":"mechanized-corps","0803":"mechanized-corps",
  "1007":"infantry-army","1106":"mechanized-corps","1215":"cavalry-corps","1309":"mechanized-corps"};
 if(Object.keys(rear).length!==7||Object.keys(prescribed).some(h=>rear[h]!==prescribed[h])||
    policy.frontlineSoviet.counts['infantry-army']!==4||
    policy.frontlineSoviet.counts['mechanized-corps']!==6||
    policy.frontlineSoviet.counts['cavalry-corps']!==1||
    policy.frontlineSoviet.noAdjacentArmies!==true||
    policy.odessaPortStart.hex!=='1513'||policy.odessaPortStart.city!=='Odessa'||
    !exactly(policy.odessaPortStart.units,['soviet-coastal-army','soviet-black-sea-fleet'])||
    policy.romaniaStart.germanInfantry!==3||policy.romaniaStart.romanianGround!==4||
    policy.romaniaStart.territoryRequired!=='romania'||
    policy.romanianAir.turn!==2||policy.romanianAir.designKey!=='romanian-air-support')
  fail('rules-section-6-counts-or-slots-changed');
 const byHex=new Map(map.cells.map(c=>[c.id,c]));
 if(byHex.size!==261||byHex.get('1513')?.city?.name!=='Odessa'||
    [...Object.keys(rear)].some(h=>!byHex.has(h)||byHex.get(h).terrain==='sea'))
  fail('source-map-or-port-invalid');
 // The source explicitly identifies four Romanian initial setup crosses.
 // This is a verified subset for initial placement ONLY, not certification
 // of Romania's borders, the Home Army movement area, or victory routing.
 const verifiedRomanianSetup=['0709','0809','0910','1010'];
 if(!Array.isArray(policy.romaniaStart.verifiedSetupHexes)||
    !exactly(policy.romaniaStart.verifiedSetupHexes,verifiedRomanianSetup)||
    policy.romaniaStart.verifiedSetupScope!=='setup-only-subset; not a full Romania country mask or movement border'||
    verifiedRomanianSetup.some(h=>!byHex.get(h)?.tileMarkers?.some(m=>m.kind==='cross')||
      byHex.get(h).terrain==='sea'||byHex.get(h).sourceTerritory==='bessarabia'))
  fail('romanian-setup-subset-mismatch');
 const romanianSetupSubset=new Set(verifiedRomanianSetup);
 function setupTerritoryEvidence(hex){
  const c=byHex.get(hex);
  if(!c||c.terrain==='sea'||c.sourceTerritory==='bessarabia'||
     (c.sourceTerritory&&c.sourceTerritory!=='romania'))return 'not-romanian';
  if(c.sourceTerritory==='romania'&&c.territoryEvidence==='user-adjudicated')return 'verified-territory';
  if(romanianSetupSubset.has(hex))return 'verified-setup-only';
  return 'unverified';
 }
 const designs=new Map(overlay.units?.map(u=>[u.designKey,u])||[]);
 if(designs.size!==8||!policy.odessaPortStart.units.every(key=>designs.get(key)?.initial?.hex==='1513')||
    designs.get('romanian-air-support')?.initial?.turn!==2||
    overlay.setupConstraints?.romanianGround?.count!==4||
    overlay.setupConstraints?.romanianGround?.baseGameContribution?.count!==1||
    overlay.setupConstraints?.romanianGround?.expansionContribution?.count!==3||
    overlay.setupConstraints?.axisOther?.germanInfantryCount!==3)
  fail('counter-roster-setup-disagreement');
 const actualStars=map.cells.filter(c=>c.tileMarkers?.some(m=>m.kind==='star')).map(c=>c.id).sort();
 const mismatchedRear=[];
 for(const [hex,type] of Object.entries(rear)){
  const expectedKind=kinds[type],observed=byHex.get(hex).tileMarkers?.filter(m=>Object.values(kinds).includes(m.kind)).map(m=>m.kind)||[];
  if(observed.length!==1||observed[0]!==expectedKind)
   mismatchedRear.push({hex,expected:expectedKind,observed});
 }
 const definedRear=new Set(Object.keys(rear));
 const otherFixed=map.cells.filter(c=>!definedRear.has(c.id)&&c.tileMarkers?.some(m=>Object.values(kinds).includes(m.kind)))
  .map(c=>({hex:c.id,kinds:c.tileMarkers.filter(m=>Object.values(kinds).includes(m.kind)).map(m=>m.kind)}));
 const missingRomania=map.cells.filter(c=>c.terrain!=='sea'&&!c.sourceTerritory).length;
 const blockers=[];
 if(actualStars.length!==11)blockers.push('frontline-stars:'+actualStars.length+'-instead-of-11');
 if(mismatchedRear.length)blockers.push('rear-deployment-symbol-disagreement');
 if(missingRomania)blockers.push('unclassified-political-territory:'+missingRomania);
 if(overlay.setupConstraints.romanianGround.baseGameContribution.gameplayUnitId===null)
  blockers.push('unbound-base-romanian-unit');
 if(overlay.setupConstraints.axisOther.bindToKievUnits==='WIP')blockers.push('unbound-base-german-infantry');
 const snapshot=Object.freeze({status:'diagnostic-not-gameplay-authorized',rearHexes:Object.keys(rear).sort(),
  actualFrontlineStarHexes:actualStars,expectedFrontlineStarCount:11,
  mismatchedRear,otherFixedMarkers:otherFixed,unclassifiedLandCells:missingRomania,
  sourcePortHex:'1513',romanianAirTurn:2,blockers,gameplayCertified:false});
 const typeCounts=arr=>arr.reduce((acc,a)=>(acc[a.type]=(acc[a.type]||0)+1,acc),{});
 const verifyClasses=(positions,counts)=>{
  if(!Array.isArray(positions)||positions.some(p=>!p||typeof p.hex!=='string'||!Object.hasOwn(kinds,p.type))||
     new Set(positions.map(p=>p.hex)).size!==positions.length||
     Object.entries(counts).some(([kind,n])=>positions.filter(p=>p.type===kind).length!==n))
   fail('invalid-unit-distribution');
 };
 function validateRear(positions){
  verifyClasses(positions,{'infantry-army':2,'mechanized-corps':4,'cavalry-corps':1});
  if(positions.length!==7||positions.some(p=>rear[p.hex]!==p.type))fail('illegal-rear-setup');
  return Object.freeze({valid:true,needsMarkerReconciliation:mismatchedRear.length>0,gameplayCertified:false});
 }
 function validateFrontline(positions){
  verifyClasses(positions,policy.frontlineSoviet.counts);
  if(positions.length!==11||positions.some(p=>!actualStars.includes(p.hex)))fail('illegal-frontline-setup');
  const armies=positions.filter(p=>p.type==='infantry-army');
  for(let i=0;i<armies.length;i++)for(let j=i+1;j<armies.length;j++){
   const c=byHex.get(armies[i].hex);
   if(T.DIRS.some(d=>T.neighbor(c,d,map.geometry)===armies[j].hex))fail('adjacent-frontline-armies');
  }
  return Object.freeze({valid:true,selectedSourceStarSubset:positions.map(p=>p.hex).sort(),
    needsStarAdjudication:actualStars.length!==11,gameplayCertified:false});
 }
 function validateRomania(units,territoryByHex){
  if(!obj(territoryByHex)||!Array.isArray(units)||units.length!==7||
     units.filter(u=>u.side==='german'&&u.type==='infantry-corps').length!==3||
     units.filter(u=>u.side==='romanian'&&u.type==='ground').length!==4||
     new Set(units.map(u=>u.id)).size!==7)
   fail('invalid-axis-setup-allocations');
  if(units.some(u=>!byHex.has(u.hex)||byHex.get(u.hex).sourceTerritory==='bessarabia'||territoryByHex[u.hex]!=='romania'||
    (byHex.get(u.hex).sourceTerritory&&byHex.get(u.hex).sourceTerritory!==territoryByHex[u.hex])))
   fail('unverified-or-non-romanian-setup-hex');
  return Object.freeze({valid:true,unitIdentityCertified:false,stackingCertified:false,gameplayCertified:false});
 }
 function certify(){if(blockers.length)fail('cannot-certify:'+blockers.join(','));fail('historical-campaign-binding-not-implemented');}
 return Object.freeze({audit:snapshot,validateRear,validateFrontline,validateRomania,setupTerritoryEvidence,certify});
}
module.exports=Object.freeze({create});
