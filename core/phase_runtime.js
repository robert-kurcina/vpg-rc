/* Shared configuration-driven phase cursor. Does NOT adjudicate gameplay actions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargamePhaseRuntime=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const ID=/^[a-z][a-z0-9-]*$/;
const KINDS=new Set(['buildup','movement','combat','special-movement','naval-operations','housekeeping','reinforcement','replacement','custom']);
function validate(config){
 if(!config||config.schemaVersion!==1||!ID.test(config.scenarioId||''))throw Error('Invalid phase configuration');
 if(!Number.isSafeInteger(config.turns)||config.turns<1||config.turns>1000)throw Error('Invalid turn limit');
 if(!Array.isArray(config.players)||config.players.length<2||new Set(config.players).size!==config.players.length||config.players.some(p=>!ID.test(p)))throw Error('Invalid player order');
 if(!Array.isArray(config.phases)||!config.phases.length)throw Error('Missing phases');
 const ids=new Set();
 for(const p of config.phases){
  if(!p||!ID.test(p.id||'')||ids.has(p.id)||!KINDS.has(p.kind)||!(p.owner==='system'||config.players.includes(p.owner)))throw Error('Invalid phase');
  ids.add(p.id);
  if(p.permissions!==undefined&&(!Array.isArray(p.permissions)||p.permissions.some(x=>!ID.test(x))))throw Error('Invalid permissions');
 }
 if(!ids.has(config.firstTurnStart))throw Error('Invalid first-turn start');
 if(config.phases[config.phases.length-1].owner!=='system'||config.phases[config.phases.length-1].kind!=='housekeeping')throw Error('Missing terminal housekeeping');
 if(config.phases.filter(p=>p.kind==='housekeeping').length!==1)throw Error('Duplicate housekeeping');
 if(config.phases.some((p,i)=>i>0&&p.owner!=='system'&&config.players.indexOf(p.owner)<config.players.indexOf(config.phases[i-1].owner)))throw Error('Player order violates phase order');
 return true;
}
function start(config){validate(config);return Object.freeze({scenarioId:config.scenarioId,turn:1,index:config.phases.findIndex(p=>p.id===config.firstTurnStart),complete:false});}
function current(config,cursor){validate(config);check(config,cursor);return cursor.complete?null:config.phases[cursor.index];}
function check(config,cursor){if(!cursor||cursor.scenarioId!==config.scenarioId||!Number.isSafeInteger(cursor.turn)||cursor.turn<1||cursor.turn>config.turns||!Number.isSafeInteger(cursor.index)||cursor.index<0||cursor.index>=config.phases.length||typeof cursor.complete!=='boolean')throw Error('Invalid phase cursor');if(cursor.complete&&(cursor.turn!==config.turns||cursor.index!==config.phases.length-1))throw Error('Invalid complete cursor');}
function advance(config,cursor,gate){const p=current(config,cursor);if(!p)throw Error('Scenario complete');if(typeof gate!=='function')throw Error('Phase completion gate required');if(gate(Object.freeze({...p}),cursor)!==true)throw Error('Phase has unfinished obligations');const last=cursor.index===config.phases.length-1;return Object.freeze(last?(cursor.turn===config.turns?{scenarioId:config.scenarioId,turn:cursor.turn,index:cursor.index,complete:true}:{scenarioId:config.scenarioId,turn:cursor.turn+1,index:0,complete:false}):{scenarioId:config.scenarioId,turn:cursor.turn,index:cursor.index+1,complete:false});}
function permitted(config,cursor,operation){const p=current(config,cursor);return Boolean(p&&p.permissions?.includes(operation));}
return {validate,start,current,advance,permitted};
});
