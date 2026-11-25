'use strict';
const A=require('node:assert/strict');
const Fixed=require('../core/historical_fixed_source_pieces');
const Combat=require('../core/historical_combat_consequences');
const Geo=require('../core/historical_combat_geography');
const MA=require('../maps/arduous.json'),CA=require('../maps/counter-configs/arduous.json'),PA=require('../maps/setup/arduous-fixed-pieces.json');
const ML=require('../maps/leningrad.json'),PL=require('../maps/movement-configs/leningrad.json');
const policy=JSON.parse(JSON.stringify(require('../maps/combat-configs/leningrad.json')));
delete policy.portSupport;delete policy.airSupport;
const auth=Fixed.combatAuthorizations({map:MA,counterConfig:CA,policy:PA});
A.equal(auth.length,1);policy.reverseOnlyPieces=auth;
const initial=Fixed.initialize({map:MA,counterConfig:CA,policy:PA}).state;
const garrison=structuredClone(initial.units['arduous:brest-garrison']);
// ISOLATED combat-pipeline test only: geometry is Leningrad's existing
// verified movement fixture. This does not activate provisional Arduous map.
garrison.hex='0309';
const f=CA.faces.front.find(f=>f.faceId==='arduous-front-r01c01');
A.equal(f.visualTranscription.printedValues,'12-6');
const german={id:f.faceId,hex:'0310',owner:'german',class:'panzer',size:'corps',mp:6,
 sourceFaceId:f.faceId,reverseFaceId:f.pairedFaceId,strengthStatus:'printed-full',printedCombatStrength:12};
const state={scenarioId:'leningrad',units:{[garrison.id]:garrison,[german.id]:german}};
const battle={defenderHex:'0309',attackers:[german.id],defenders:[garrison.id]};
const make=p=>Combat.create({map:ML,profile:PL,counterConfig:CA,combatPolicy:p,geography:Geo.create(ML,PL,{cityMarkerMode:'source-typed-v1'})});
const effects=make(policy);
A.equal(effects.previewPostCasualty({state,battle,actor:'german',die:5}).outcome,'DRL');
const trial=effects.previewPostCasualty({state,battle,actor:'german',die:5,choices:{defenderLossId:garrison.id}});
A.equal(trial.state.units[garrison.id],undefined,'one-step Garrison eliminated, not reduced further');
A.equal(trial.losses.length,1);A.equal(trial.losses[0].removed,true);
const resolved=effects.resolve({state,battle,actor:'german',die:5,choices:{defenderLossId:garrison.id}});
A.equal(resolved.event.outcome,'DRL');A.equal(resolved.state.units[garrison.id],undefined);
A.equal(state.units[garrison.id].strengthStatus,'printed-reduced','source state immutable');
const noAuthorization=structuredClone(policy);delete noAuthorization.reverseOnlyPieces;
A.throws(()=>make(noAuthorization).previewPostCasualty({state,battle,actor:'german',die:5}),/Combat counter affiliation\/class mismatch/);
const invalid=structuredClone(state);invalid.units[garrison.id].strengthStatus='printed-full';
A.throws(()=>effects.previewPostCasualty({state:invalid,battle,actor:'german',die:5}),/Reverse-only combat face disagrees/);
const rogue=structuredClone(state);rogue.units[garrison.id].owner='german';
A.throws(()=>effects.previewPostCasualty({state:rogue,battle,actor:'german',die:5}),/Committed defender unavailable/);
console.log('PASS reverse-only one-step Brest combat pipeline: 11 assertions');
