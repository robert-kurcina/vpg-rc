/* Source-face projection for historical counter artwork.
 * Read-only view adapter: never use runtime IDs as printed face text.
 * Rules state and source transcriptions remain authoritative.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalCounterFaceProjection=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const FACE_BACK_STATES=new Set(['printed-reduced','revealed-one-step']);
 const FACE_FRONT_STATES=new Set(['printed-full','untried']);
 function project(unit,source){
  if(!unit||!source||!Array.isArray(source.faces?.front)||!Array.isArray(source.faces?.back))throw Error('Unit and source counter sheets required');
  const front=source.faces.front.find(f=>f.faceId===unit.sourceFaceId);
  const back=source.faces.back.find(f=>f.faceId===unit.reverseFaceId);
  if(!front||!back||front.pairedFaceId!==back.faceId||back.pairedFaceId!==front.faceId)
   throw Error('Counter front/back source identity mismatch: '+(unit.id||'unknown'));
  if(!FACE_BACK_STATES.has(unit.strengthStatus)&&!FACE_FRONT_STATES.has(unit.strengthStatus))
   throw Error('Unsupported historical face status: '+unit.strengthStatus);
  const useBack=FACE_BACK_STATES.has(unit.strengthStatus);
  if(useBack&&unit.activeFaceId!==back.faceId)throw Error('Reverse active face does not match source pairing');
  if(!useBack&&own(unit,'activeFaceId')&&unit.activeFaceId!==front.faceId)
   throw Error('Front active face does not match source pairing');
  const face=useBack?back:front;
  const trans=face.visualTranscription||{};
  // The two ground counter templates are for two or three *printed* numbers.
  // A concealed face has ?-6; its revealed reverse has three distinct digits.
  const values=trans.printedValues||'';
  const digits=values.split(/[-·]/).map(x=>x.trim());
  if(!['infantry','mountain-infantry','coastal-infantry','cavalry','tank','mechanized','garrison'].includes(trans.kind)||
     ![2,3].includes(digits.length)||digits.some(x=>!/^\d+$|^\?$/.test(x)))
   throw Error('Unsupported printed ground face: '+face.faceId+' '+values);
  const size=unit.size==='army'?'XXXX':unit.size==='corps'?'XXX':null;
  if(!size)throw Error('Unrecognized source unit size: '+unit.size);
  // Blank or asterisked identifiers are *real source markings*. An internal
  // face ID must NEVER be substituted into this text field.
  const name=typeof trans.printedIdentifier==='string'?trans.printedIdentifier:'';
  const color=face.observedFieldColor||'#abb9b0';
  // Source Mountain Infantry (Kiev) retain their printed 49 Mtn name/values.
  // Current universal NATO sheet has no dedicated mountain glyph; show infantry.
  const nato=trans.kind==='tank'?'armor':
   ['garrison','mountain-infantry','coastal-infantry'].includes(trans.kind)?'infantry':trans.kind;
  // The authored SVG includes a vertical `status_reduced` strip.
  // A printed reduced reverse is already its own source face, so retain its
  // printed values while enabling that strip; an untried/revealed
  // one-step Corps is not an additional step loss.
  // Some source-authorized one-step cavalry units have a blank physical front
  // and their *only playable face* on the physical reverse. Runtime keeps
  // `printed-reduced` to address that reverse, but this is NOT a step loss.
  // Do not draw the authored damage stripe on a one-step printed face.
  const singleSided=front.role==='blank-face-of-single-sided-cavalry-counter'&&
   back.role==='single-sided-cavalry-printed-face'&&
   front.visualTranscription?.kind==='blank'&&trans.kind==='cavalry';
  const reduced=unit.strengthStatus==='printed-reduced'&&!singleSided;
  const authoredFace={name,digits,color};
  const art={id:unit.id,strength:reduced?'reduced':'full',counter:{
   template:digits.length===3?'army-3':'army-2',name,size,nato,
   colors:{primary:color,secondary:color,
    digits:{offense:'#000000',defense:'#000000',movement:'#000000'},
    nameText:'#000000',sizeText:'#000000'},
   faces:{full:authoredFace,damaged:authoredFace}
  }};
  return Object.freeze({art,faceId:face.faceId,side:useBack?'back':'front',
   printedIdentifier:name,printedValues:values,printedSize:size,template:art.counter.template,
   displayStatus:singleSided?'one-step-single-sided':unit.strengthStatus==='revealed-one-step'?'one-step-revealed':
    unit.strengthStatus==='untried'?'one-step-untried':reduced?'reduced':'full'});
 }
 return Object.freeze({project});
});
