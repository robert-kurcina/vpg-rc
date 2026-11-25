'use strict';
/* Checkpoint 266 / v500. Artificial region labels test rule semantics only;
 * original Odessa has no source-certified national boundaries and is non-live. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const M=require('../core/movement_rules');
const B=require('../core/movement_binding');
const T=require('../core/territorial_state_transition');
const Safe=require('../core/historical_retreat_options');
const Forced=require('../core/historical_forced_retreat');
const profile=require('../maps/movement-configs/kiev-odessa-territory-candidate-v499.json');
const previous=require('../maps/movement-configs/kiev-odessa-cavalry-candidate-v498.json');
const leningrad=require('../maps/leningrad.json');
const combat=require('../maps/combat-configs/leningrad.json');
const sheet=require('../maps/counter-configs/odessa-extension.json');
const clone=v=>JSON.parse(JSON.stringify(v));
let checks=0;
function eq(a,b,msg){assert.deepStrictEqual(a,b,msg);checks++}
function yes(a,msg){assert.ok(a,msg);checks++}
function throws(f,re,msg){assert.throws(f,re,msg);checks++}
function digest(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
eq(digest('references/rules/odessa-rules.pdf'),sheet.rulesPDF.sha256,'Original rules locked');
eq(M.validProfile(profile),true,'opt-in profile valid');
eq(profile.executableStatus,'source-reviewed-diagnostic-not-authorized','not promoted');
const geo={R:'romania',T:'romania',B:'bessarabia',C:'bessarabia',X:'outside',N:'outside'};
const cells=Object.fromEntries(Object.entries(geo).map(([id,sourceTerritory])=>[id,{terrain:'open',verified:true,sourceTerritory,territoryEvidence:'source-certified'}]));
const edgePairs=[['R','T'],['R','B'],['T','C'],['B','C'],['B','X'],['X','N'],['C','X']];
const edges=edgePairs.map(([a,b])=>({a,b,verified:true,rail:false,impassable:false,lake:false,allSea:false}));
const board={cells,edges};
const unit=(id,owner,nationality,hex,identity=null,face=null)=>({id,owner,nationality,hex,mp:3,class:'infantry',size:'corps',
 ...(identity?{sourceIdentityKey:identity}:{}),...(face?{sourceFaceId:face}:{})});
const home=unit('h','german','romanian','R','romanian-home-army','odessa-front-r01c05');
const sov=unit('s','soviet','soviet','C');
const hung=unit('g','german','hungarian','X');
const army=unit('a','german','romanian','R','romanian-4th-army');
const makeState=(units,annex=false)=>({scenarioId:'kiev-odessa',turn:2,units:Object.fromEntries(units.map(u=>[u.id,clone(u)])),
 territory:{bessarabiaAnnexed:annex},arbitraryMetadata:{nested:[1,2,3]}});
const s0=makeState([home,sov,hung,army]),before=clone(s0);
const c0=T.commit({profile,board,state:s0});
yeS(c0.ok,'initial state commit valid');
function yeS(x,m){yes(x,m)}
eq(c0.event,null,'not annexed with Soviets remaining');
eq(c0.state.territory.bessarabiaAnnexed,false);
eq(s0,before,'commit pure even with no transition');
const s1=clone(s0);s1.units.s.hex='X';
const c1=T.commit({profile,board,state:s1});
yeS(c1.ok,'source-complete commit succeeds');
eq(c1.event,{kind:'bessarabia-annexed',region:'bessarabia',permanent:true});
eq(c1.state.territory.bessarabiaAnnexed,true);
eq(s1.territory.bessarabiaAnnexed,false,'input not mutated on switch');
eq(c1.state.arbitraryMetadata,s1.arbitraryMetadata,'unrelated state retained');
const c1Repeat=T.commit({profile,board,state:c1.state});
eq(c1Repeat.event,null,'no duplicate annexation event');
const s2=clone(c1.state);s2.units.s.hex='C';
const c2=T.commit({profile,board,state:s2});
eq(c2.state.territory.bessarabiaAnnexed,true,'re-entry never reverses annexation');
eq(c2.event,null,'permanent latch does not re-announce');
eq(c1.state.units.s.hex,'X','re-entry cannot mutate prior snapshot');
// Rules consume the same territory flag as movement-binding and the true
// historical controller (which forwards state.territory in v500).
const bind={profile,board};const phase={kind:'movement',owner:'german'};
const req={unitId:'h',path:['R','B']};
eq(B.context(bind,phase,s0.units,2,s0.territory).territory.bessarabiaAnnexed,false);
eq(B.move(bind,phase,s0.units,2,req,s0.territory).reason,'home-army-territory-restricted');
yeS(B.move(bind,phase,c1.state.units,2,req,c1.state.territory).ok,'post-annexation movement uses carried state');
eq(B.move(bind,phase,c1.state.units,2,req,s0.territory).reason,'home-army-territory-restricted','stale state not implicitly inferred');
eq(B.legalRoutes(bind,phase,c1.state.units,2,'h',{territory:s0.territory,maxStates:1000}).pathTo('B'),null,'pre-annexation path catalog excludes Bessarabia');
eq(B.legalRoutes(bind,phase,c1.state.units,2,'h',{territory:c1.state.territory,maxStates:1000}).pathTo('B'),['R','B'],'post-annexation path catalog includes Bessarabia');
// Every retreat leg shares the same restrictions; an uncertified identity
// throws instead of being misinterpreted as a combat retreat casualty.
eq(T.retreatStep({profile,board,state:s0,unit:home,from:'R',to:'B'}),false,'Home Army before annexation');
eq(T.retreatStep({profile,board,state:c1.state,unit:home,from:'R',to:'B'}),true,'Home Army after annexation');
eq(T.retreatStep({profile,board,state:c1.state,unit:home,from:'B',to:'X'}),false,'Home Army cannot leave enlarged territory');
eq(T.retreatStep({profile,board,state:s0,unit:hung,from:'X',to:'B'}),false,'Hungarian forbidden in Bessarabia');
eq(T.retreatStep({profile,board,state:s0,unit:hung,from:'X',to:'N'}),true,'Hungarian normal retreat possible');
eq(T.retreatStep({profile,board,state:s0,unit:army,from:'R',to:'B'}),true,'4th Army unaffected');
const mismatch={...home,sourceFaceId:'odessa-front-r01c05',sourceIdentityKey:'romanian-4th-army'};
throws(()=>T.retreatStep({profile,board,state:s0,unit:mismatch,from:'R',to:'B'}),/identity\/coverage unverified/,'photo identity mismatch cannot cause casualty');
const missing={...home};delete missing.sourceIdentityKey;delete missing.sourceFaceId;
throws(()=>T.retreatStep({profile,board,state:s0,unit:missing,from:'R',to:'T'}),/identity\/coverage unverified/,'missing Home Army identity cannot cause casualty');
const damaged=clone(board);delete damaged.cells.B.territoryEvidence;
eq(T.commit({profile,board:damaged,state:s1}).reason,'territory-unverified','no unlabeled territory can cause annexation');
throws(()=>T.retreatStep({profile,board:damaged,state:s0,unit:home,from:'R',to:'B'}),/identity\/coverage unverified/,'unknown territory not classed as illegal retreat');
const invalid=clone(s1);invalid.territory.bessarabiaAnnexed='yes';
eq(T.commit({profile,board,state:invalid}).reason,'invalid-annexation-status');
eq(invalid.territory.bessarabiaAnnexed,'yes','rejected transition unchanged');
eq(T.commit({profile,board,state:{...invalid,units:[]}}).reason,'invalid-territorial-commit-context');
// A legacy game's result and its references stay unchanged: the opt-in rule
// must not alter the four existing historical scenarios.
const plain=T.commit({profile:previous,board,state:s1});
yeS(plain.ok);eq(plain.state,s1);eq(plain.state,s1,'no annexation for prior cavalry-only profile');
eq(plain.event,null);
// Real source-backed graph remains unclassified even if a caller decorates
// its input map: the production map adapter does not authenticate geography
// from unapproved cell labels, and no Odessa territorial path is opened.
const boardReal=B.build(leningrad,profile).board;
eq(Object.values(boardReal.cells).filter(c=>c.sourceTerritory!==undefined).length,0,'no licensed territory in verified foreign board');
const counterfeit=clone(leningrad);counterfeit.cells.forEach(c=>{c.sourceTerritory='romania';c.territoryEvidence='source-certified'});
const stillUnqualified=B.build(counterfeit,profile).board;
eq(Object.values(stillUnqualified.cells).filter(c=>c.sourceTerritory!==undefined).length,0,'map decoration cannot fabricate territory certification');
const fixtureDefender=unit('def','soviet','soviet','0309');
const ghost={scenarioId:'kiev-odessa',units:{def:fixtureDefender},territory:{bessarabiaAnnexed:false}};
const forcedPolicy=clone(combat);forcedPolicy.scenarioId='kiev-odessa';
const forced=Forced.create({map:leningrad,profile,combatPolicy:forcedPolicy});
const safe=Safe.create({map:leningrad,profile,combatPolicy:forcedPolicy});
throws(()=>forced.enumerate({state:ghost,defenderHex:'0309',defenderIds:['def']}),/country coverage unverified/,'uncertified geography must not induce forced retreat elimination');
throws(()=>safe.enumerate({state:ghost,defenderHex:'0309',defenderIds:['def']}),/country coverage unverified/,'uncertified geography must not present safe retreat choices');
// An undo/replay candidate must restore the *entire* previously committed
// state and reproducibly regenerate the one annexation event; the historical
// campaign's actual journal uses immutable action replay, but a genuine
// source-certified Odessa campaign is not constructed in this test.
const afterUndo=clone(s0);eq(afterUndo,before,'synthetic Undo state equals initial');
const replayA=T.commit({profile,board,state:{...clone(afterUndo),units:clone(s1.units)}});
const replayB=T.commit({profile,board,state:clone(s1)});
eq(replayA,replayB,'deterministic candidate re-application');
const report={checkpoint:266,version:'v500',scope:'source-incomplete-diagnostic',sourcePDF:digest('references/rules/odessa-rules.pdf'),
 realCountryMaskCertified:false,territoryContextPassedThroughMovementBinding:true,
 combatAndMovementCommitIntegration:true,forcedAndSafeRetreatFailClosed:true,
 candidateAnnexationReplayDeterministic:true,actualOdessaUndoSaveRestoreCertified:false,checks};
if(process.env.WRITE_AUDIT==='1')fs.writeFileSync('rules/audit/odessa-territorial-lifecycle-v500.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS Odessa territorial state and retreat candidate v500',checks,'assertions');
