/* Cross-game phase/action binding: intentionally requires scenario-specific
 * legality and completion handlers. A phase permission alone NEVER authorizes
 * an action, and no historical scenario is activated by this adapter.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargamePhaseActions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const P=(typeof globalThis!=='undefined'&&globalThis.WargamePhaseRuntime)||
 (typeof require==='function'?require('./phase_runtime.js'):null);
const clone=x=>JSON.parse(JSON.stringify(x));
function validateBinding(b){
 if(!b||!b.config||!b.cursor||!b.actor||!b.state||!b.rules||typeof b.rules!=='object')throw Error('Missing phase action binding');
 P.current(b.config,b.cursor);
 return true;
}
function guard(b,op){
 validateBinding(b);
 const phase=P.current(b.config,b.cursor);
 if(!phase)throw Error('Scenario completed');
 if(phase.owner!==b.actor)throw Error('Wrong phase actor');
 if(!P.permitted(b.config,b.cursor,op))throw Error('Operation not permitted in phase');
 const rule=b.rules[op];
 if(!rule||typeof rule.legal!=='function'||typeof rule.apply!=='function')throw Error('No verified rules binding for operation: '+op);
 return {phase,rule};
}
function legal(b,op,action){
 const {rule,phase}=guard(b,op);
 // Readonly view for rule callbacks; their input is detached from source state.
 return rule.legal(clone(b.state),clone(action),clone(phase))===true;
}
function execute(b,op,action){
 const {rule,phase}=guard(b,op);
 const prior=clone(b.state), proposal=clone(b.state);
 if(rule.legal(clone(proposal),clone(action),clone(phase))!==true)return {ok:false,state:b.state,reason:'illegal-action'};
 const output=rule.apply(proposal,clone(action),clone(phase));
 if(!output||output.ok!==true||!output.state||typeof output.state!=='object'||Array.isArray(output.state))
  return {ok:false,state:b.state,reason:'action-rejected'};
 // fail closed on unintentional mutation of authoritative input by callbacks
 if(JSON.stringify(prior)!==JSON.stringify(b.state))throw Error('Rules handler mutated original state');
 return {ok:true,state:clone(output.state),result:clone(output.result??null)};
}
function finish(b){
 validateBinding(b);
 const phase=P.current(b.config,b.cursor);
 if(!phase)throw Error('Scenario completed');
 if(b.actor!==phase.owner)throw Error('Wrong phase actor');
 if(typeof b.complete!=='function')throw Error('No source-backed phase completion handler');
 const approved=b.complete(clone(b.state),clone(phase),clone(b.cursor));
 if(approved!==true)throw Error('Phase has unfinished obligations');
 return {cursor:P.advance(b.config,b.cursor,()=>true),state:b.state};
}
return {validateBinding,legal,execute,finish};
});
