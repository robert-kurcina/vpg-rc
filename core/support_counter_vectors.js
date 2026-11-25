/* Source-backed Support counter projection. Uses the same user-supplied SVG
 * templates and WargameCounterVisuals.piece() as the map counter layer.
 * No photographed/cropped counter bitmap is used in the active Support UI.
 * This module is presentation-only; only the campaign action catalog can
 * authorize an Air Corps or Fleet action.
 */
(function(root,factory){
 const Art=typeof module==='object'&&module.exports?require('./counter_visuals'):root.WargameCounterVisuals;
 const api=factory(Art);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameSupportCounterVectors=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Art){'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const color=s=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s)?s:null;
 const supported=new Set(['air-support','air-marker','naval-marker']);
 function details(face,{label='',shiftRating=null,condition='undamaged'}={}){
  if(!face||!supported.has(face.visualTranscription?.kind)||!face.faceId)
   throw Error('Support SVG requires a registered special counter face');
  const trans=face.visualTranscription;
  const title=trans.printedIdentifier||String(trans.visibleNotation||'').split(';')[0].trim()||label;
  if(!title)throw Error('Source Support face has no printed title');
  const isFleet=trans.kind==='naval-marker';
  const refit=condition==='refit';
  const damaged=condition==='damaged';
  const valueText=String(trans.printedValues||'');
  const valueMatch=valueText.match(/^\s*([12])\b/)||String(trans.visibleNotation||'').match(/(?:^|;)\s*([12])\s*(?:;|$)/);
  const value=valueMatch?Number(valueMatch[1]):Number(shiftRating);
  if(!Number.isInteger(value)||value<1||value>2)
   throw Error('Unsupported source Support shift/marker value');
  const template=isFleet?'fleet':value===2?'stuka':'air';
  const field=color(face.supportVectorFieldColor)||color(face.observedFieldColor);
  if(!field)throw Error('Source Support face has no verified field color');
  return {template,title,value,field,refit,damaged};
 }
 function render(face,options={}){
  const m=details(face,options);
  const counter={id:face.faceId,strength:m.damaged?'reduced':'full',counter:{
   template:m.template,name:m.title,colors:{primary:m.field,reducedBar:'transparent'},
   faces:{full:{name:m.title,color:m.field,value:m.value},damaged:{name:m.title,color:m.field,value:m.value,damageText:'DAMAGED'}}
  }};
  let body=Art.piece(counter,0,0,'#909f97',{width:50,height:50});
  // REFIT is printed on Romanian reverse Air Support counters; the generic
  // SVG air template uses a ready-side numeric arrow. Cover only that lower
  // marker zone and add the source REFIT notation, without altering the SVG
  // template file or presenting a cropped scan as an engine render.
  if(m.refit){
   body+='<g class="support-svg-refit" pointer-events="none" aria-hidden="true">'+
    '<rect x="3" y="33" width="44" height="14" rx="1" fill="'+m.field+'"/>'+
    '<text x="25" y="43" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="9.5" text-anchor="middle" fill="#13212a">REFIT</text></g>';
  }
  // The original authored artwork/shadow extends beyond the nominal 0..50 tile;
  // a bleed-aware viewport displays it in full without touching the source SVG.
  return '<svg xmlns="http://www.w3.org/2000/svg" class="support-counter-svg" viewBox="-3 -3 56 56" role="img" '+
   'data-source-face-id="'+esc(face.faceId)+'" data-vector-template="'+m.template+'" '+
   'aria-label="'+esc(m.title+(m.refit?' REFIT':m.damaged?' DAMAGED':'')+' SVG source counter')+'">'+body+'</svg>';
 }
 return Object.freeze({details,render});
});
