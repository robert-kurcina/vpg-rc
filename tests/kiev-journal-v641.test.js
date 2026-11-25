'use strict';
const A=require('node:assert/strict'),Auto=require('../core/historical_campaign_autoplay'),Campaign=require('../core/historical_campaign_session'),Catalog=require('../core/historical_campaign_action_catalog');
const F=require('./fixtures/kiev-source-opening-v437');
const map=F.map,counterConfig=F.counterConfig,profile=require('../maps/movement-configs/kiev.json'),config=require('../maps/phase-configs/kiev.json');
const combatPolicy=require('../maps/combat-configs/kiev.json');
const committed=require('../core/historical_deployment_session').create({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},allocation:F.allocation,placements:F.placements}).commit();
const ctx={...committed.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy:require('../maps/buildup-configs/kiev.json'),buildupAllocation:committed.allocation,housekeepingPolicy:require('../maps/housekeeping-configs/kiev.json')};
let n=0;const ok=(v,m)=>{A.ok(v,m);n++};const eq=(a,b,m)=>{A.deepEqual(a,b,m);n++};
const cursor={...ctx.cursor,turn:3,index:config.phases.findIndex(p=>p.id==='german-movement')};
const c={...ctx,actor:'german',cursor,state:structuredClone(Campaign.create(ctx).snapshot().state)};
const s=Campaign.create(c),snap=s.snapshot(),before=s.save();

const policy={phaseScope:'operational',seed:7};
// Shared journal cap and read-only ledger. This does not fabricate a 5000-action game.
eq(Campaign.MAX_ACTIONS,5000);eq(Auto.policyOf(policy).maxActions,Campaign.MAX_ACTIONS);
A.throws(()=>Auto.policyOf({...policy,maxActions:Campaign.MAX_ACTIONS+1}),/Invalid deterministic controller policy/);n++;
eq(s.journal(),before.journal);
const d=Auto.decide({session:s,context:c,policy});const next=s.execute(d.action).session;
const saved=next.save();eq(next.journal(),saved.journal);eq(next.snapshot().actionCount,1);
const tampered=next.journal();tampered[0].action.type='forged';tampered.push({action:{type:'forged'},stateHash:'0'.repeat(64)});
eq(next.journal(),saved.journal);eq(next.save(),saved);eq(s.save(),before);
const restored=Campaign.restore(saved,c);eq(restored.journal(),saved.journal);eq(restored.snapshot(),next.snapshot());
eq(Auto.decide({session:restored,context:c,policy}),Auto.decide({session:next,context:c,policy}));
// Budget boundary is validated without attempting thousands of invalid actions.
const mock={snapshot:()=>({...snap,actionCount:Campaign.MAX_ACTIONS}),save:()=>{throw Error('must stop before journal read')},execute:()=>{throw Error('must not execute')}};
eq(Auto.decide({session:mock,context:c,policy}).reason,'controller-action-budget');
// A checksum-valid oversized save must still fail the journal guard before replay.
const oversized=structuredClone(saved);oversized.journal=Array.from({length:Campaign.MAX_ACTIONS+1},()=>saved.journal[0]);
const {integrity,...payload}=oversized;
const canonical=v=>v===null||typeof v!=='object'?v:Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));
oversized.integrity.digest=require('node:crypto').createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
A.throws(()=>Campaign.restore(oversized,c),/Campaign journal length limit/);n++;
console.log('PASS journal cap and detached ledger',n,'assertions');
