'use strict';
// Actual source map and counter allocation; synthetic buildup positions isolate eligibility.
const assert=require('node:assert/strict');
const B=require('../core/historical_buildup_phase');
const F=require('../core/historical_counter_face_projection');
const root=x=>require('../'+x);
const map=root('maps/kiev-odessa-composite-experimental-v531.json'),profile=root('maps/movement-configs/kiev-odessa-experimental-v531.json'),config=root('maps/phase-configs/kiev-odessa.json'),counterConfig=root('maps/counter-configs/kiev-odessa-experimental-v531.json'),policy=root('maps/buildup-configs/kiev-odessa-experimental-v533.json'),allocation=root('games/kiev-odessa/experimental-preview/allocation-v533.json'),combatPolicy=root('maps/combat-configs/kiev-odessa-experimental-v531.json');
const b=B.create({map,profile,config,counterConfig,policy,allocation,combatPolicy});
const home='kiev-odessa/romanian-home-army';
const initial=b.initialize(root('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart.state);
const state=structuredClone(initial),u=state.units[home];
// Empty synthetic board, retaining all original deployed identities.
state.units={[home]:{...u,hex:policy.entryEdge.german[0],strengthStatus:'printed-reduced',printedCombatStrength:1,activeFaceId:u.reverseFaceId}};
const phase=b.openingPhase(),args={state,cursor:{turn:4},actor:'german',phase,unitId:home};
let n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++};const bad=(f,r)=>{assert.throws(f,r);n++};
const before=structuredClone(state),restored=b.replace(args);
eq(F.project(restored.state.units[home],counterConfig).printedValues,'3-5-3');eq(restored.state.units[home].sourceIdentityKey,'romanian-home-army');eq(restored.phase.spent,1);eq(state,before);
bad(()=>b.replace({...args,cursor:{turn:3}}),/No replacement steps/);
bad(()=>b.replace({...args,actor:'soviet'}),/ownership/);
bad(()=>b.replace({...args,state:restored.state}),/Only a reduced/);
const dead=structuredClone(state);delete dead.units[home];dead.cityControl.Chisinau='german';dead.territory={bessarabiaAnnexed:false};
const placement={...args,state:dead,hex:'1211'};
bad(()=>b.replace(placement),/home-army-territory-restricted/);
bad(()=>b.replace({...placement,hex:policy.entryEdge.german[0]}),/home-army-territory-restricted/);
dead.territory.bessarabiaAnnexed=true;
const deadBefore=structuredClone(dead),rebuilt=b.replace(placement);
eq(F.project(rebuilt.state.units[home],counterConfig).printedValues,'1-3-3');eq(rebuilt.state.units[home].sourceIdentityKey,'romanian-home-army');eq(rebuilt.state.units[home].nationality,'romanian');eq(rebuilt.state.units[home].hex,'1211');eq(rebuilt.phase.spent,1);eq(dead,deadBefore);
const later=b.replace({...args,state:rebuilt.state,cursor:{turn:5}});eq(F.project(later.state.units[home],counterConfig).printedValues,'3-5-3');
console.log('PASS v568 Home Army replacement:',n,'assertions');
