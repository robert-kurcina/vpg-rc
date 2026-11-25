/* Node-only, opt-in restore of an authenticated-by-context (NOT cryptographically
 * authenticated) v353 preview save into the bounded movement pilot.
 * No browser storage, production session loading or canonical activation.
 */
'use strict';
const Save=require('./leningrad_preview_save');
const Movement=require('./historical_movement_lifecycle');
function restore(envelope,context){
 const result=Save.restore(envelope,context);
 // Canonical IDs are only candidates. The active movement binding expects
 // physical IDs, and converting a canonical save here would mask a cutover.
 if(result.namespace!=='legacy-physical')throw Error('Controller restore requires legacy-physical save');
 const {map,movementProfile:profile,phaseConfig:config}=context;
 return Movement.restoreSnapshot({map,profile,config,snapshot:result.snapshot});
}
function save(session,context){
 if(!session||typeof session.snapshot!=='function')throw Error('Movement controller required');
 return Save.serialize(session.snapshot(),context,{namespace:'legacy-physical'});
}
module.exports=Object.freeze({restore,save});
