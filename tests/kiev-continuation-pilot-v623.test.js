'use strict';
const A=require('node:assert/strict'),Auto=require('../core/historical_campaign_autoplay'),Campaign=require('../core/historical_campaign_session'),Catalog=require('../core/historical_campaign_action_catalog');
const F=require('./fixtures/kiev-source-opening-v437');
const map=F.map,counterConfig=F.counterConfig,profile=require('../maps/movement-configs/kiev.json'),config=require('../maps/phase-configs/kiev.json');
const combatPolicy=require('../maps/combat-configs/kiev.json');
const committed=require('../core/historical_deployment_session').create({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},allocation:F.allocation,placements:F.placements}).commit();
const ctx={...committed.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy:require('../maps/buildup-configs/kiev.json'),buildupAllocation:committed.allocation,housekeepingPolicy:require('../maps/housekeeping-configs/kiev.json')};
const units=Object.values(ctx.state.units), attacker=units.find(u=>u.owner==='soviet'&&u.printedCombatStrength===8), defender=units.find(u=>u.owner==='german'&&u.printedCombatStrength===12), concealed=units.find(u=>u.owner==='soviet'&&u.strengthStatus==='untried');
A.ok(attacker&&defender&&concealed);
const board=require('../core/movement_binding').build(map,profile).board;
const edge=board.edges.find(e=>!e.river&&!e.majorRiver&&!e.impassable&&board.cells[e.b].terrain==='open'&&!map.cells.find(c=>c.id===e.b).city&&!combatPolicy.firstTurnTerritorialRestriction.targetHexes.includes(e.b));
const cursor={...ctx.cursor,turn:3,index:config.phases.findIndex(p=>p.id==='soviet-combat')};
let n=1;const eq=(a,b,m)=>{A.deepEqual(a,b,m);n++};
for(const variant of ['standard','advanced']){
 const c={...ctx,actor:'soviet',cursor,combatPolicy:{...combatPolicy,crtVariant:variant},state:{...structuredClone(Campaign.create(ctx).snapshot().state),units:{[attacker.id]:{...attacker,hex:edge.a},[defender.id]:{...defender,hex:edge.b}}}};
 const s=Campaign.create(c), before=s.save(), snap=s.snapshot();
 const options=Catalog.discover({session:s,context:c,enumerateCombinedPlans:false});
 eq(options.proposals.length,1);
 const screened=Auto.screenBattles({snapshot:snap,context:c,proposals:options.proposals});
 eq(screened.rejected.length,variant==='standard'?1:0);eq(screened.known.length,variant==='standard'?0:1);eq(screened.uncertain.length,0);
 for(const selectionMode of ['first','seeded']){
  const d=Auto.decide({session:s,context:c,policy:{selectionMode}});
  eq(d.status,'action');eq(d.action.action.battles.length,variant==='standard'?0:1);
  const pilot=Auto.decide({session:s,context:c,policy:{selectionMode,attackSelection:'utility-pilot'}});
  eq(pilot.status,'action');eq(pilot.action.action.battles.length,0);
  const coverage=Auto.decide({session:s,context:c,policy:{selectionMode,attackSelection:'coverage'}});
  eq(coverage.action.action.battles.length,1);
 }
 const newDecision=Auto.decide({session:s,context:c,policy:{attackSelection:'continuation-pilot'}});eq(newDecision.status,'action');eq(newDecision.action.action.battles.length,0);
 eq(s.save(),before,'No discovery mutation');
 const weak=units.find(u=>u.owner==='german'&&u.printedCombatStrength===6);
 const favorable={...c,state:{...structuredClone(snap.state),units:{[attacker.id]:{...attacker,hex:edge.a},[weak.id]:{...weak,hex:edge.b,strengthStatus:'printed-reduced',printedCombatStrength:3,activeFaceId:weak.reverseFaceId}}}};
 const strongSession=Campaign.create(favorable),strongBefore=strongSession.save();
 const strongDecision=Auto.decide({session:strongSession,context:favorable,policy:{attackSelection:'utility-pilot',selectionMode:'seeded'}});
 eq(strongDecision.status,'action');eq(strongDecision.action.action.battles.length,1);eq(strongDecision.reason,'utility-pilot-positive-conventional');
 const actual=Auto.decide({session:strongSession,context:favorable,policy:{attackSelection:'continuation-pilot'}}); console.log('pilot decision',variant,actual.reason); eq(actual.status,'action'); const ranked=Auto.rankContinuations({snapshot:strongSession.snapshot(),context:favorable,proposals:Catalog.discover({session:strongSession,context:favorable,enumerateCombinedPlans:false}).proposals}); console.log('scores',ranked.assessments.map(a=>[a.odds,a.delta]));eq(actual.action.action.battles.length,ranked.ranked.length?1:0);if(ranked.ranked.length){eq(actual.reason,'continuation-pilot-positive-utility');eq(strongSession.execute(actual.action).session.snapshot().combat.status,'committed');}
 eq(strongSession.save(),strongBefore,'Favorable discovery is nonmutating');
 const german={...favorable,actor:'german',cursor:{...cursor,index:config.phases.findIndex(p=>p.id==='german-combat')},state:{...structuredClone(snap.state),units:{[defender.id]:{...defender,hex:edge.a},[attacker.id]:{...attacker,hex:edge.b,strengthStatus:'printed-reduced',printedCombatStrength:4,activeFaceId:attacker.reverseFaceId}}}};
 const gs=Campaign.create(german), gd=Auto.decide({session:gs,context:german,policy:{attackSelection:'continuation-pilot'}});console.log('german',variant,gd.reason);
 eq(gd.reason,'continuation-pilot-positive-utility');eq(gd.action.action.battles.length,1);
 let next=gs.execute(gd.action).session;
 for(let i=0;i<5&&next.snapshot().combat?.status!=='battles-resolved';i++){const d=Auto.decide({session:next,context:german,policy:{attackSelection:'continuation-pilot'}});eq(d.status,'action');next=next.execute(d.action).session;if(d.action.action?.type==='resolve-battle'){eq(next.save().journal.some(j=>j.action.action?.type==='resolve-battle'),true);break;}}
 eq(next.snapshot().combat.status,'battles-resolved');
 eq(next.save().journal.some(j=>j.action.action?.type==='resolve-battle'),true);
 const hidden={...snap,state:{...snap.state,units:{[concealed.id]:{...concealed,hex:edge.a},[defender.id]:{...defender,hex:edge.b}}}};
 // Deliberately invalidate hidden reverse ID: advisory calculation must not touch it.
 hidden.state.units[concealed.id].reverseFaceId='do-not-read';
 const unknown=Auto.screenBattles({snapshot:hidden,context:c,proposals:[{defenderHex:edge.b,attackers:[concealed.id]}]});
 const pilotHidden=Auto.screenBattles({snapshot:hidden,context:c,proposals:[{defenderHex:edge.b,attackers:[concealed.id]}],utilityPilot:true});
 eq(pilotHidden.known.length,0);eq(pilotHidden.assessments[0].reason,'concealed-strength-unestimated');
 eq(unknown.uncertain.length,1);eq(unknown.rejected.length,0);eq(unknown.known.length,0);
}
A.throws(()=>Auto.policyOf({attackSelection:'invalid'}));n++;
console.log('PASS v623 actual-map continuation pilot and odds screen',n,'assertions');
