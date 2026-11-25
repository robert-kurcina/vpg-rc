/* Optional scenario-neutral support-marker movement transaction.
 * A destination is committed BEFORE the damage die is supplied. History is
 * replayable, immutable and Undo-safe. This is a bounded special-phase pilot:
 * no full campaign turn sequencing or German-forced Fleet displacement.
 */
(function(root,factory){
 const Phase=typeof module==='object'&&module.exports?require('./phase_runtime'):root.WargamePhaseRuntime;
 const Port=typeof module==='object'&&module.exports?require('./historical_port_support'):root.WargameHistoricalPortSupport;
 const api=factory(Phase,Port);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalSupportMovement=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Phase,Port){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const keys=(v,expected)=>obj(v)&&same(Object.keys(v).sort(),[...expected].sort());
 function factory({map,policy,counterConfig,phaseConfig}){
  if(!policy||phaseConfig?.scenarioId!==policy.scenarioId)throw Error('Support phase scenario mismatch');
  const port=Port.create({map,policy,counterConfig});
  const owner=policy.portSupport.owner;
  function gate(cursor,actor){
   const p=Phase.current(phaseConfig,cursor);
   if(!p||!['special-movement','naval-operations'].includes(p.kind)||p.owner!==owner||actor!==owner||
      !p.permissions?.includes('move-support'))throw Error('Support movement permitted only in owning special phase');
  }
  function replay(initial,actions){
   if(!keys(initial,['cursor','actor','state'])||!Array.isArray(actions)||actions.length>3)
    throw Error('Invalid Fleet transaction history');
   gate(initial.cursor,initial.actor);
   port.validateMarker(initial.state,true);
   let state=clone(initial.state),cursor=clone(initial.cursor),status='ready',pending=null,event=null;
   for(const action of actions){
    if(!obj(action))throw Error('Malformed Fleet phase action');
    if(action.kind==='declare'&&keys(action,['kind','to'])&&status==='ready'){
     port.validateDestination({state,to:action.to});
     pending=action.to;status='awaiting-damage-roll';
    }else if(action.kind==='roll'&&keys(action,['kind','die'])&&status==='awaiting-damage-roll'){
     const change=port.relocate({state,to:pending,die:action.die});
     state=change.state;event=change.event;pending=null;status='moved';
    }else if(action.kind==='finish'&&keys(action,['kind'])&&['ready','moved'].includes(status)){
     cursor=Phase.advance(phaseConfig,cursor,()=>true);status='finished';
    }else throw Error('Illegal Fleet phase action ordering');
   }
   return {cursor,actor:initial.actor,state,status,pending,event};
  }
  function controller(initial,actions){
   const start=clone(initial),log=clone(actions),current=replay(start,log);
   function snapshot(){return clone({...current,initial:start,actions:log});}
   function invoke(action){return controller(start,[...log,action]);}
   function declareMove(to){return invoke({kind:'declare',to});}
   function resolveDamage(die){return invoke({kind:'roll',die});}
   function finish(){return invoke({kind:'finish'});}
   function undo(){return log.length?{ok:true,session:controller(start,log.slice(0,-1))}:
    {ok:false,reason:'nothing-to-undo',session:controller(start,log)};}
   return Object.freeze({snapshot,declareMove,resolveDamage,finish,undo});
  }
  function create({cursor,actor,state}){return controller({cursor,actor,state},[]);}
  function restoreSnapshot(saved){
   if(!keys(saved,['cursor','actor','state','status','pending','event','initial','actions']))
    throw Error('Malformed Fleet phase snapshot');
   const restored=controller(saved.initial,saved.actions);
   if(!same(restored.snapshot(),saved))throw Error('Fleet phase snapshot does not match replay');
   return restored;
  }
  return Object.freeze({create,restoreSnapshot,portHexes:port.portHexes});
 }
 return Object.freeze({factory});
});
