/* Shared human decision gateway for the historical campaign engine (v401).
 * This is a headless action interface, NOT a replacement player-facing UX.
 * Each displayed choice comes from the source-validated catalog. Battle dice
 * are committed separately BEFORE result-dependent choices become visible.
 * A pending die is journaled in this wrapper's versioned save and cannot be
 * changed by selecting another result. No scenario-ID-specific rules here.
 */
'use strict';
const crypto=require('node:crypto');
const Random=require('./mission_random');
const Campaign=require('./historical_campaign_session');
const MovementBinding=require('./movement_binding');
const Catalog=require('./historical_campaign_action_catalog');
const AutoPlay=require('./historical_campaign_autoplay');
const clone=v=>JSON.parse(JSON.stringify(v));
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const dieOK=d=>d===null||(Number.isSafeInteger(d)&&d>=1&&d<=6);
const FORMAT='historical-human-decision-session';
const VERSION=1;
function make(session,context,pending=null,existingPager=null,missionSeed=null,deploymentDraws=0){
 if(missionSeed!==null)Random.validate(missionSeed);
 if(!Number.isSafeInteger(deploymentDraws)||deploymentDraws<0||(!missionSeed&&deploymentDraws!==0))throw Error("Invalid deployment random state");
 if(!session||typeof session.snapshot!=='function'||typeof session.execute!=='function'||typeof session.save!=='function')
  throw Error('Authoritative campaign session required');
 if(!obj(context)||!obj(context.config))throw Error('Source scenario context required');
 const postPages=new Map();
 let postPager=null;
 if(pending){
  if(!obj(pending)||!dieOK(pending.die)||pending.at!==session.save().finalStateHash)
   throw Error('Pending combat die does not match authoritative campaign state');
  // This must still be a valid adjudication point. In particular, a restored
  // die cannot be attached to a different battle or an unlocked air decision.
  postPager=existingPager||Catalog.createPostRollPager({session,context,die:pending.die});
  postPages.set(0,postPager.page(0));
 }
 // A pending die belongs to an immutable campaign snapshot. Cache validated
 // post-roll options for this session instance so UI refreshes and the subsequent
 // click do not replay the same expensive candidate enumeration.
 // Human clients choose individual legal proposals and submit any combination to
 // the authoritative transaction; eager exhaustive plan enumeration is unused.
 // A human-session wrapper is bound to one immutable campaign snapshot.
 // Reuse its validated legal catalog between view rendering and the next
 // choice; a committed action/Undo/Restore always creates a new wrapper.
 // This avoids running expensive source movement searches twice per click.
 let catalogCache=null;
 const source=()=>catalogCache||(catalogCache=Catalog.discover({session,context,enumerateCombinedPlans:false}));
 function view(page=0){
  if(pending){
   if(!Number.isSafeInteger(page)||page<0||page>255)throw Error('Invalid post-roll consequence page');
   if(!postPages.has(page)){
    const prior=postPages.get(page-1);
    if(!prior||!prior.hasNextPage)throw Error('Post-roll consequence page is not available');
    postPages.set(page,postPager.page(page));
   }
   const post=postPages.get(page);
   return clone({kind:'post-roll-choice',phaseId:post.phaseId,die:pending.die,
    crtOutcome:post.crtOutcome,options:post.options.map(x=>x.action),
    // Read-only adjudicated evidence is parallel to options; it is never part
    // of the submitted action or the authenticated campaign transaction.
    optionEffects:post.options.map(x=>({outcome:x.outcome,losses:x.losses,
     retreats:x.retreats,advanced:x.advanced,revealed:x.revealed})),
    fleetCommitments:post.fleetCommitments.map(x=>x.action),
    exhaustive:post.exhaustive,choiceTruncated:post.choiceTruncated,
    choiceLimit:post.choiceLimit,choicePage:post.choicePage,choiceOffset:post.choiceOffset,
    hasNextPage:post.hasNextPage,limitations:post.limitations});
  }
  const catalog=source();
  return clone({kind:catalog.complete?'complete':'action-choice',...catalog});
 }
 function preparePage(page,steps=24){
  if(!pending)throw Error('No committed combat die is pending');
  if(!Number.isSafeInteger(page)||page<1||page>255)throw Error('Invalid post-roll consequence page');
  const prior=postPages.get(page-1);
  if(!prior||!prior.hasNextPage)throw Error('Post-roll consequence page is not available');
  if(postPages.has(page))return {ready:true,...postPager.stats()};
  const progress=postPager.advance(page,steps);
  if(progress.ready)postPages.set(page,postPager.page(page));
  return progress;
 }
 function choose(action){
  if(!obj(action))throw Error('Explicit legal action required');
  if(pending){
   const alreadyDisplayed=[...postPages.values()].flatMap(post=>[
    ...post.options.map(x=>x.action),...post.fleetCommitments.map(x=>x.action)]);
   if(!alreadyDisplayed.some(x=>same(x,action)))
    throw Error('Choice is not a validated post-roll consequence for committed die');
   return make(session.execute(action).session,context,null,null,missionSeed,deploymentDraws);
  }
  const candidates=source();
  let allowed=candidates.commands.some(x=>same(x,action));
  if(!allowed&&action.type==='combat'&&action.action?.type==='commit-battles'&&
    Array.isArray(action.action.battles)&&action.action.battles.length>0){
   // Any coherent combination of source-validated individual battle proposals
   // is permitted; the final authoritative transaction checks it as a whole.
   // Avoid an artificial hard cap of 2/3 battles imposed by discovery budgets.
   const chosen=action.action.battles;
   allowed=chosen.every(b=>candidates.proposals.some(p=>same(p,b)))&&
    chosen.length===new Set(chosen.map(b=>b.defenderHex)).size;
  }
  if(!allowed)throw Error('Action is absent from current legal decision catalog');
  return make(session.execute(action).session,context,null,null,missionSeed,deploymentDraws);
 }
 function roll(die){
  if(pending)throw Error('Combat die already committed; resolve or Undo before rolling again');
  if(!dieOK(die))throw Error('Invalid six-sided die');
  const catalog=source();
  const dice=catalog.prompts.filter(x=>x.kind==='die-and-choice');
  if(!dice.length)throw Error('No source-authorized die decision is pending');
  const battle=dice.find(x=>x.type==='resolve-battle');
  if(battle){
   // This is a genuine pre-consequence commit, even when the CRT gives
   // automatic NE (no die roll) and `die` must be null.
   const pager=Catalog.createPostRollPager({session,context,die});
   const post=pager.page(0);
   if(!post.options.length&&!post.fleetCommitments.length)
    throw Error('No authorized post-roll choices at committed die');
   return make(session,context,{die,at:session.save().finalStateHash},pager,missionSeed,deploymentDraws);
  }
  if(die===null)throw Error('Damage rolls require a real d6');
  if(dice.length!==1)throw Error('Ambiguous pending die prompt');
  const kind=dice[0].type;
  const actions={
   'roll-fleet-attack':{type:'combat',action:{type:'roll-fleet-attack',die}},
   'roll-fleet-displacement':{type:'combat',action:{type:'roll-fleet-displacement',die}},
   'roll-fleet-move':{type:'roll-fleet-move',die},
   'roll-naval-ground-transport':{type:'roll-naval-ground-transport',die},
   'resolve-forced-ground-move':{type:'resolve-forced-ground-move',die}
  };
  if(!actions[kind])throw Error('Unsupported source die prompt: '+kind);
  return make(session.execute(actions[kind]).session,context,null,null,missionSeed,deploymentDraws);
 }
 function rollRandom(){
  if(missionSeed===null)throw Error("No mission seed assigned");
  const prompt=source().prompts.find(x=>x.kind==='die-and-choice');
  if(!prompt)throw Error("No source-authorized die decision is pending");
  return roll(prompt.automaticNoDie?null:Random.die(missionSeed,session.save().journal,prompt.type==='resolve-battle'?'combat':'naval'));
 }
 // Hand the AI the existing immutable campaign session instead of restoring
 // and replaying the complete journal on every browser action. This is the
 // same controller and authoritative execute path used by the old UI loop.
 function autoplayStep(policy={}){
  if(pending)throw Error('Finish the committed human die and consequence before using AI');
  if(!obj(policy))throw Error('Controller policy must be an object');
  const decision=AutoPlay.decide({session,context,policy:{...policy,...(missionSeed!==null?{missionSeed}:{})}});
  if(decision.status!=='action'||!decision.action)return {decision,session:null};
  return {decision,session:make(session.execute(decision.action).session,context,null,null,missionSeed,deploymentDraws)};
 }
 function undo(){
  if(pending)return {ok:true,session:make(session,context,null,null,missionSeed,deploymentDraws)};
  const result=session.undo();
  return {ok:result.ok,session:make(result.session,context,null,null,missionSeed,deploymentDraws)};
 }
 function save(){
  const payload={format:FORMAT,version:VERSION,campaign:session.save(),pendingRoll:clone(pending)};
  if(missionSeed!==null){payload.missionSeed=missionSeed;payload.deploymentDraws=deploymentDraws;}
  return {...payload,integrity:{algorithm:'SHA-256',digest:hash(payload)}};
 }
 return Object.freeze({snapshot:()=>session.snapshot(),journal:()=>session.journal(),view,preparePage,choose,roll,rollRandom,autoplayStep,hasPendingRoll:()=>pending!==null,undo,save,missionSeed:()=>missionSeed,deploymentDraws:()=>deploymentDraws});
}
function create({session,context,missionSeed=null,deploymentDraws=0}={}){return make(session,MovementBinding.prepareContext(context),null,null,missionSeed,deploymentDraws);}
function restore(saved,context){
 if(!obj(saved)||!obj(saved.integrity)||Object.keys(saved).sort().join(',')!==
  ['campaign','format','integrity','pendingRoll','version',...(Object.prototype.hasOwnProperty.call(saved,'missionSeed')?['missionSeed']:[]),...(Object.prototype.hasOwnProperty.call(saved,'deploymentDraws')?['deploymentDraws']:[])].sort().join(',')||
  saved.format!==FORMAT||saved.version!==VERSION||saved.integrity.algorithm!=='SHA-256')
  throw Error('Invalid human-session save envelope');
 const {integrity,...payload}=saved;
 if(typeof integrity.digest!=='string'||!/^[a-f0-9]{64}$/.test(integrity.digest)||
  !crypto.timingSafeEqual(Buffer.from(integrity.digest,'hex'),Buffer.from(hash(payload),'hex')))
  throw Error('Human-session save checksum mismatch');
 const session=Campaign.restore(saved.campaign,context);
 return make(session,MovementBinding.prepareContext(context),saved.pendingRoll,null,saved.missionSeed===undefined?null:Random.validate(saved.missionSeed),saved.deploymentDraws??0);
}
module.exports=Object.freeze({FORMAT,VERSION,create,restore});
