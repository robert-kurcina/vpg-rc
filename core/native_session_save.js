/* Versioned portable generic-hex preview sessions. Node-only until browser
 * cutover. A SHA-256 checksum detects corruption, not malicious re-signing.
 * Source scenario configuration is never taken from a save file.
 */
(function(root,factory){
 const isNode=typeof module==='object'&&module.exports;
 const E=isNode?require('./engine.js'):root.WargameCore;
 const hash=isNode?require('./sync_sha256.js').jsonChecksum:root.WargameSyncSha256?.jsonChecksum;
 if(!E||!hash)throw Error('Native save adapter requires shared engine and SHA-256');
 const api=factory(E,hash);
 if(isNode)module.exports=api;
 root.WargameNativeSessionSave=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E,hash){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const PACKAGE_FIELDS=['game','map','units','rules','objectives','deployments'];
function fingerprint(g){return hash(Object.fromEntries(PACKAGE_FIELDS.map(k=>[k,g[k]])));}
const FORMAT='generic-hex-session-preview',VERSION=1;
const stateRequired=['turn','side','phaseIndex','units','control','seed','over','winner','log','ply','stepsLost','committed','moved','eventsDone','declarations','declarationLocked','pendingRoll','replacementUsed','airUsed','setupPositions'];
function validate(g,s){
 if(g?.game?.engine!=='generic-hex-v1'||!g.game.id)throw Error('Not a native game package');
 if(!s||typeof s!=='object'||Array.isArray(s)||stateRequired.some(k=>!Object.hasOwn(s,k)))throw Error('Incomplete native snapshot');
 if(!Number.isInteger(s.turn)||s.turn<1||s.turn>g.rules.turns+1||!g.game.factions.some(f=>f.id===s.side))throw Error('Invalid native turn or faction');
 if(!Number.isInteger(s.phaseIndex)||s.phaseIndex<0||s.phaseIndex>=E.phasesFor(g,s.side).length)throw Error('Invalid native phase cursor');
 if(!Number.isInteger(s.seed)||s.seed<0||s.seed>0xffffffff||typeof s.over!=='boolean')throw Error('Invalid native RNG/terminal fields');
 if(s.missionSeed!==undefined&&(!Number.isInteger(s.missionSeed)||s.missionSeed<1||s.missionSeed>0xffffffff))throw Error('Invalid native mission seed');
 if(s.winner!==null&&s.winner!=='draw'&&!g.game.factions.some(f=>f.id===s.winner))throw Error('Invalid native winner');
 if(!Array.isArray(s.units)||s.units.length!==g.units.units.length||!Array.isArray(s.log)||
 !Array.isArray(s.committed)||!Array.isArray(s.moved)||!Array.isArray(s.eventsDone)||!Array.isArray(s.declarations)||
 s.log.length>20000||s.declarations.length>300||s.eventsDone.length>10000)throw Error('Invalid native state collections');
 const ids=g.units.units.map(u=>u.id),have=s.units.map(u=>u.id);
 if(have.some((id,i)=>id!==ids[i]))throw Error('Native roster identity/order mismatch');
 if(s.units.some(u=>!['full','reduced','dead'].includes(u.strength)||u.position!=null&&(!Number.isInteger(u.position.x)||!Number.isInteger(u.position.y))))throw Error('Invalid unit strength or location');
 if(typeof s.control!=='object'||!s.control||Array.isArray(s.control)||typeof s.stepsLost!=='object'||!s.stepsLost||
 typeof s.airUsed!=='object'||!s.airUsed||typeof s.setupPositions!=='object'||!s.setupPositions)throw Error('Invalid native state registers');
 if(!Number.isInteger(s.replacementUsed)||s.replacementUsed<0||!Number.isInteger(s.ply)||s.ply<0)throw Error('Invalid native usage counters');
 if(typeof s.declarationLocked!=='boolean'||s.pendingRoll!==null&&(!Number.isInteger(s.pendingRoll)||s.pendingRoll<0||s.pendingRoll>6))throw Error('Invalid committed die');
 if(s.manualSetupActive!==undefined){
  if(s.manualSetupActive!==true&&s.manualSetupActive!==false)throw Error('Invalid manual setup flag');
  const policy=g.deployments?.manualSetup;
  if(!policy)throw Error('Manual setup policy unavailable');
  if(s.manualSetupActive){
   if(s.turn!==1||s.side!==policy.side||s.ply!==0||s.declarations.length||s.log.some(e=>['combat','move','replacement'].includes(e.type)))throw Error('Manual setup outside opening');
   for(const u of s.units.filter(u=>(u.army||u.faction)===policy.side))if(u.position&&
     !g.cells.get(`${u.position.x},${u.position.y}`)?.[policy.zoneTag])throw Error('Setup unit outside placement zone');
  }else{
   if(!s.log.some(e=>e.turn===1&&e.side===policy.side&&e.type==='setup'))throw Error('Completed manual setup lacks committed confirmation');
   // Re-check setup only until the first historical action. After combat or
   // movement, units may legally leave their original placement crosses.
   if(s.turn===1&&s.side===policy.side&&s.ply===0&&
      !s.log.some(e=>['end-phase','move','combat','replacement','interactive-reinforcement'].includes(e.type))&&
      !s.declarations.length)E.checkSetup(g,s);
  }
 }
 if(s.openingRedeployment!==undefined){
  const policy=g.deployments?.openingRedeployment,record=s.openingRedeployment;
  if(!policy||!record||typeof record!=='object'||Array.isArray(record)||
      Object.keys(record).sort().join(',')!=='completed,id'||record.id!==policy.id||
      typeof record.completed!=='boolean')throw Error('Invalid opening redeployment record');
  const finished=s.log.some(e=>e.type==='opening-redeployment-complete'&&e.eventId===policy.id);
  if(record.completed!==finished)throw Error('Redeployment confirmation mismatch');
  if(!record.completed&&(s.turn!==1||s.side!==policy.afterSetupSide||s.ply!==0||
     s.log.some(e=>['combat','move','replacement','end-phase'].includes(e.type))))
   throw Error('Unfinished opening redeployment outside opening');
  if(!record.completed||s.turn===1&&s.ply===0&&!s.log.some(e=>['combat','move','replacement','end-phase'].includes(e.type))){
   for(const id of policy.unitIds){const unit=s.units.find(u=>u.id===id),[x,y]=policy.initialPositions[id];
    const actual=unit?.position;if(!actual)throw Error('Missing reserve in opening redeployment');
    const origin=actual.x===x&&actual.y===y;
    if(!origin&&!E.openingRedeploymentOptions(g,{...s,openingRedeployment:{...record,completed:false}},id)
      .some(v=>v.x===actual.x&&v.y===actual.y))throw Error('Reserve outside candidate redeployment zone');
   }
  }
 }else if(s.log.some(e=>['opening-redeployment','opening-redeployment-complete'].includes(e.type)))
    throw Error('Unregistered opening redeployment log');
 const phase=E.currentPhase(g,s);
 if((s.declarationLocked||s.declarations.length||s.pendingRoll!==null)&&phase?.kind!=='combat')throw Error('Combat records outside combat phase');
 if(s.pendingRoll!==null&&(!s.declarationLocked||!s.declarations.length))throw Error('Orphaned combat die');
 // The shared native action boundary locks and rolls in the same atomic step.
 // A saved locked queue without a committed roll cannot come from that API.
 if(s.declarationLocked&&s.declarations.length&&s.pendingRoll===null)throw Error('Locked battle has no committed die');
 if(s.declarations.some(d=>!Array.isArray(d.attackers)||!d.attackers.length||!ids.includes(d.defender)||d.attackers.some(id=>!ids.includes(id))))throw Error('Invalid combat declaration references');
 if(s.committed.some(id=>typeof id!=='string'||!ids.includes(id.replace(/^def:/,'')))||s.moved.some(id=>!ids.includes(id)))throw Error('Invalid native used-unit references');
 if(s.over&&s.turn<=g.rules.turns)throw Error('Premature finished state');
 E.checkState(g,s);
 return true;
}
function validateSession(sess){
 validate(sess.config,sess.state);
 if(!Array.isArray(sess.history)||sess.history.length>20000||!Array.isArray(sess.usedUnitIds))throw Error('Invalid native session history');
 const ids=new Set(sess.config.units.units.map(u=>u.id));
 const used=x=>Array.isArray(x)&&x.every(id=>ids.has(id))&&new Set(x).size===x.length;
 if(!used(sess.usedUnitIds))throw Error('Invalid native used-unit IDs');
 for(const h of sess.history){if(!h||typeof h!=='object'||!used(h.usedUnitIds))throw Error('Invalid native history entry');validate(sess.config,h.state);if(h.state.missionSeed!==sess.state.missionSeed)throw Error('Native mission seed changed in history');}
}
function serialize(sess){
 validateSession(sess);
 const payload={format:FORMAT,version:VERSION,scenarioId:sess.scenarioId,engine:'generic-hex-v1',packageSHA256:fingerprint(sess.config),
  state:copy(sess.state),usedUnitIds:copy(sess.usedUnitIds),history:copy(sess.history)};
 return {...payload,sha256:hash(payload)};
}
function restore(saved,{scenarioId,config},create){
 if(!saved||typeof saved!=='object'||Array.isArray(saved)||saved.format!==FORMAT||saved.version!==VERSION||
  saved.engine!=='generic-hex-v1'||saved.scenarioId!==scenarioId||config.game.id!==scenarioId)throw Error('Unsupported or mismatched native save');
 const keys=['format','version','scenarioId','engine','packageSHA256','state','usedUnitIds','history','sha256'];
 if(Object.keys(saved).sort().join(',')!==keys.sort().join(','))throw Error('Unknown native save fields');
 if(fingerprint(config)!==saved.packageSHA256)throw Error('Native save scenario-package mismatch');
 const {sha256,...payload}=saved;
 if(typeof sha256!=='string'||hash(payload)!==sha256)throw Error('Native save checksum mismatch');
 const sess=create({scenarioId,engine:'generic-hex-v1',config,state:saved.state,usedUnitIds:saved.usedUnitIds,history:saved.history});
 validateSession(sess);
 return sess;
}
return {validate,validateSession,fingerprint,serialize,restore,FORMAT,VERSION};
});
