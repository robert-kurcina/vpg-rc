'use strict';
/* Checkpoint 237: Kiev §8.1 nationality exclusion must survive into every
 * shared movement, buildup and combat-retreat legality path. The concrete
 * board below is certified Leningrad geography with SYNTHETIC nationalities;
 * Kiev's own graph stays explicitly non-playable and unpromoted. */
const A=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const Map=require('../maps/leningrad.json');
const normal=require('../maps/movement-configs/leningrad.json');
const kiev=require('../maps/movement-configs/kiev.json');
const kmap=require('../maps/kiev.json');
const graph=require('../core/map_movement_graph');
const Binding=require('../core/movement_binding');
const Movement=require('../core/movement_rules');
const Buildup=require('../core/historical_buildup_phase');
const Retreat=require('../core/historical_forced_retreat');
const Safe=require('../core/historical_retreat_options');
const LCombat=require('../maps/combat-configs/leningrad.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const profile={...normal,nationalStackExclusions:copy(kiev.nationalStackExclusions)};
const free={...normal,nationalStackExclusions:[]};
const combatPolicy={scenarioId:'leningrad',retreatMode:'source-forced-ezoc-v1',retreatHexes:2,armyStackingByOwner:{german:1}};
let checks=0;
const eq=(a,b,m)=>{A.deepStrictEqual(a,b,m);checks++;};
const ok=(x,m)=>{A.ok(x,m);checks++;};
const bad=(f,re,m)=>{A.throws(f,re,m);checks++;};
const unit=(id,hex,nationality)=>({id,hex,owner:'german',nationality,size:'corps',class:'infantry',mp:4,strengthStatus:'printed-full'});
const rom=unit('r','0505','romanian'),hun=unit('h','0306','hungarian');
const it=unit('it','0306','italian');
const g=unit('g','0306','german');
eq(kiev.nationalStackExclusions,[['romanian','hungarian']],'Direct historical policy §8.1');
eq(crypto.createHash('sha256').update(fs.readFileSync('references/rules/kiev-rules.pdf')).digest('hex'),
 require('../maps/combat-configs/kiev-turn-rules-v443.json').sourceSha256,'Rules PDF identity pinned');
bad(()=>graph.build({...kmap,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/,'Real Kiev board still gate-closed');
for(const [pair,expected] of [
 [[rom,hun],false],[[hun,rom],false],[[rom,{...rom,id:'r2'}],true],
 [[rom,it],true],[[rom,g],true],[[hun,it],true]]){
 eq(Movement.nationalStackLegal(profile,pair),expected,'Movement shared nationality policy');
 eq(Buildup.allowedNationalStack(profile,pair[0].nationality,[pair[1]]),expected,'Buildup uses same shared nationality policy');
}
eq(Movement.nationalStackLegal(free,[rom,hun]),true,'Source-unconfigured scenarios unaffected');
bad(()=>Movement.nationalStackLegal({...profile,nationalStackExclusions:[['romanian','romanian']]},[rom]),/Malformed nationality stacking exclusion/);
const board=Binding.build(Map,profile).board;
ok(board.cells['0505']?.verified&&board.cells['0306']?.verified,'Real certified source cells');
ok(board.edges.some(e=>(e.a==='0505'&&e.b==='0406')||(e.b==='0505'&&e.a==='0406')),'Real verified adjacent hexside');
const ctx=(p,resident)=>({profile:p,board,turn:2,phase:{owner:'german',kind:'movement'},units:{r:copy(rom),h:{...copy(resident),hex:'0406'}}});
eq(Movement.move(ctx(profile,hun),{unitId:'r',path:['0505','0406']}).reason,
 'national-stack-exclusion','Real movement refuses Romanian-Hungarian stack');
eq(Movement.move(ctx(free,hun),{unitId:'r',path:['0505','0406']}).ok,true,
 'Unrestricted scenario does not accidentally gain a stacking ban');
eq(Movement.move(ctx(profile,it),{unitId:'r',path:['0505','0406']}).ok,true,
 'Kiev rules permit Romanian-Italian friendly stack');
function retreatTest(p,retreater,resident){
 const r=Retreat.create({map:Map,profile:p,combatPolicy});
 const state={units:{r:{...retreater,id:'r',hex:'0505'},h:{...resident,id:'h',hex:'0306'}}};
 const result=r.enumerate({state,defenderHex:'0505',defenderIds:['r']});
 eq(result.status,'certified-forced-retreat-options');
 return {r,state,result,routes:result.combinations.map(c=>c.r?.route.join(','))};
}
function preview(p,retreater,resident){
 const s={units:{r:{...retreater,id:'r',hex:'0505'},h:{...resident,id:'h',hex:'0306'}}};
 return Safe.create({map:Map,profile:p,combatPolicy:LCombat})
  .enumerate({state:s,defenderHex:'0505',defenderIds:['r']});
}
const safeBefore=preview(free,rom,hun);
ok(safeBefore.jointOptions.some(c=>c.r.join(',')==='0406,0306'),
 'Safe-only preview formerly offered mixed-nationality route');
const safeNow=preview(profile,rom,hun);
ok(!safeNow.jointOptions.some(c=>c.r.join(',')==='0406,0306'),
 'Safe-only UI preview cannot advertise forbidden national stack');
ok(safeNow.jointOptions.some(c=>c.r.join(',')==='0406,0407'),
 'Safe-only preview retains other legal retreats');
const baseline=retreatTest(free,rom,hun);
ok(baseline.routes.includes('0406,0306'),'Unrestricted original retreat admitted destination with Hungarian');
const restricted=retreatTest(profile,rom,hun);
ok(!restricted.routes.includes('0406,0306'),'Retreat enumerator cannot publish illegal national stack');
ok(restricted.routes.includes('0406,0407'),'Other source-legal two-hex retreat remains available');
bad(()=>restricted.r.apply({state:copy(restricted.state),defenderHex:'0505',defenderIds:['r'],
 paths:{r:['0406','0306']},loseStep:()=>{throw Error('No EZOC expected')}}),/invalid outward route|retreat paths/i,
 'Resolver must reject a forged Romanian-Hungarian retreat');
const committed=copy(restricted.state);
const played=restricted.r.apply({state:committed,defenderHex:'0505',defenderIds:['r'],
 paths:{r:['0406','0407']},loseStep:()=>{throw Error('No EZOC expected')}});
eq(committed.units.r.hex,'0407','Legal retreat updates actual shared game state');
eq(committed.units.h.hex,'0306','Other national counter does not move');
eq(played.retreats[0].route,['0406','0407'],'Committed path agrees with enumerator');
const reverse=retreatTest(profile,hun,rom);
ok(!reverse.routes.includes('0406,0306'),'Hungarian retreat into Romanian-occupied hex also blocked');
const italian=retreatTest(profile,rom,it);
ok(italian.routes.includes('0406,0306'),'Italian not prohibited by this specific national exclusion');
const same=retreatTest(profile,rom,{...rom,id:'h'});
ok(same.routes.includes('0406,0306'),'Two Romanian Corps can stack together');
const origin=copy(restricted.state);
bad(()=>restricted.r.apply({state:origin,defenderHex:'0505',defenderIds:['r'],
 paths:{r:['0406','0306']},loseStep:()=>{throw Error('No EZOC expected')}}),/retreat paths/i);
eq(origin,restricted.state,'Rejected combat retreat does not mutate state');
// Integration: authenticated photographed source counters, certified real
// edges and shared combat phase. Nationalities/positions are intentionally
// synthetic (not a historical Leningrad national rule or Kiev activation).
const Bridge=require('../core/scenario_opening_bridge');
const Phase=require('../core/historical_combat_phase');
const LSetup=require('../maps/setup/leningrad.json');
const LPhase=require('../maps/phase-configs/leningrad.json');
const LCounters=require('../maps/counter-configs/leningrad.json');
const LInventory=require('../core/leningrad_starting_inventory');
const LFixture=require('./fixtures/leningrad-source-setup-v357');
const opening=Bridge.create({map:Map,setupSpec:LSetup,counterConfig:LCounters,
 inventory:LInventory,allocation:LFixture.selected,placements:LFixture.placements,
 phaseConfig:LPhase,movementProfile:normal,phaseFactories:{}}).snapshot();
const printed=Object.values(opening.state.units);
const attackers=printed.filter(u=>u.owner==='soviet'&&u.printedCombatStrength===8).slice(0,2);
const defender=printed.find(u=>u.owner==='german'&&u.printedCombatStrength===6);
const hungarian=printed.find(u=>u.owner==='german'&&u.printedCombatStrength===8);
ok(attackers.length===2&&defender&&hungarian,'Four original source-faced counters');
const pieces=[...attackers,defender,hungarian].map(copy);
[pieces[0].hex,pieces[1].hex,pieces[2].hex,pieces[3].hex]=['1104','1105','1005','0804'];
pieces[2].nationality='romanian';pieces[3].nationality='hungarian';
const syntheticState={scenarioId:'leningrad',units:Object.fromEntries(pieces.map(x=>[x.id,x]))};
const cursor={scenarioId:'leningrad',turn:1,index:6,complete:false};
const battle={defenderHex:'1005',attackers:attackers.map(x=>x.id)};
function selectedCombat(policy){
 return Phase.create({map:Map,profile,config:LPhase,cursor,actor:'soviet',
  state:syntheticState,counterConfig:LCounters,combatPolicy:policy})
  .commit([battle]).select('1005');
}
for(const [mode,policy] of [['safe-only',{...LCombat,retreatMode:undefined}],
 ['forced',LCombat]]){
 const session=selectedCombat(policy),prior=session.snapshot();
 const badChoice={retreatPaths:{[defender.id]:['0904','0804']}};
 bad(()=>session.resolveSelected({die:1,choices:badChoice}),
  mode==='safe-only'?/Retreat violates nationality stacking/:/Complete retreat paths required/,
  `${mode} real combat transaction rejects mixed national retreat`);
 eq(session.snapshot(),prior,`${mode} failed transaction does not commit state`);
 const played=session.resolveSelected({die:1,choices:{retreatPaths:{[defender.id]:['0904','0805']}}});
 eq(played.event.outcome,'DR',`${mode} real source CRT outcome`);
 eq(played.event.retreats[0].to,'0805',`${mode} legal national retreat committed`);
 eq(played.session.snapshot().state.units[defender.id].hex,'0805',`${mode} combat state updated`);
 eq(played.session.undo().session.snapshot(),{...prior,historyDepth:0},`${mode} combat Undo restores position`);
}
if(process.argv.includes('--write-audit')){
 const report={checkpoint:237,version:'v471',assertions:checks,
  source:'references/rules/kiev-rules.pdf printed page 3, §8.1',
  rulebookSHA256:crypto.createHash('sha256').update(fs.readFileSync('references/rules/kiev-rules.pdf')).digest('hex'),
  verifiedRule:'Romanian and Hungarian units may never stack together; no restriction on Italian/Romanian or same-nationality pairs',
  proof:{sharedNationalityPredicate:true,movement:true,buildup:true,
   safeRetreatPreview:true,forcedRetreatEnumeration:true,forcedRetreatCommit:true,
   combatSourceFaces:true,combatCertifiedHexsides:true,
   combatSafeOnlyAndForcedModes:true,undoAndFailedTransactionAtomicity:true},
  testFixture:'Real Leningrad source-faced counters and certified hexsides, synthetic Romanian/Hungarian nationalities and combat positions; NOT historical Leningrad rules or a Kiev game authorization',
  kievLivePlayable:false,kievRomaniaMaskCertified:false,
  exclusionsPreservedByProfile:true,
  unchanged:['Five approved game-map exports','Common B4M CRT','All original photographed counter art','Existing Kiev territory and graph certification gates'],
  limitations:['No Kiev Romanian territory border certified or Kiev live campaign','No claim of exhaustive national-stack situation enumeration','Source-face nationalities in the test combat are synthetic by design']};
 fs.writeFileSync('rules/audit/kiev-nationality-retreat-v471.json',JSON.stringify(report,null,2)+'\n');
}
console.log(`PASS v471: ${checks} national stacking assertions; Kiev remains source-gated`);
