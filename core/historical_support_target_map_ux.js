/* Shared, read-only support-to-map selection. Never creates or adjudicates actions.
 * The only clickable destinations are those already present in the authoritative
 * historical legal-action catalogue. Selection and confirmation are UI-only.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameHistoricalSupportTargetMapUX=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const valid=s=>typeof s==='string'&&s.length>0;
 const empty=Object.freeze({active:false,selection:null,hexes:[],byHex:{},kind:null,instruction:''});
 function model({selection=null,commands=[],battleHex=null,fleetHex=null}={}){
  if(!selection)return empty;
  if(!Array.isArray(commands))throw Error('Support map commands must be the authoritative list');
  if(!valid(selection.kind)||!valid(selection.id))throw Error('Invalid Support map selection');
  const byHex=Object.create(null);
  function add(hex,action,label,kind){if(!valid(hex)||!action)return;(byHex[hex]??=[]).push({action,label,kind});}
  if(selection.kind==='air'){
   for(const a of commands){
    if(a?.type!=='combat'||a.action?.faceId!==selection.id)continue;
    if(a.action.type==='commit-ground-air')add(battleHex,a,'Air Support to battle '+battleHex,'air');
    else if(a.action.type==='declare-fleet-attack')add(fleetHex,a,'Naval air strike at '+fleetHex,'naval-air');
   }
  }else if(selection.kind==='fleet'){
   for(const a of commands){
    if((a?.type==='declare-fleet-move'||a?.type==='commit-forced-port')&&valid(a.to))
     add(a.to,a,(a.type==='declare-fleet-move'?'Move Fleet to ':'Force Fleet to ')+a.to,'fleet');
   }
  }else throw Error('Unsupported support selection kind '+selection.kind);
  const hexes=Object.keys(byHex).sort();
  const instruction=hexes.length?`Select one of ${hexes.length} highlighted legal hex${hexes.length===1?'':'es'} on the map.`:
   selection.kind==='air'?'No legal Air Support target yet. Declare and select a battle, or wait for the applicable naval window.':
   'No legal Fleet destination in this phase.';
  return {active:true,selection:{...selection},hexes,byHex,kind:selection.kind,instruction};
 }
 function choicesAt(model,hex){return model?.active&&valid(hex)?model.byHex[hex]||[]:[];}
 return Object.freeze({model,choicesAt});
});
