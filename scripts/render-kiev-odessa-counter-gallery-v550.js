#!/usr/bin/env node
/* Source-bound game-engine counter gallery, not photographed counter crops or
 * a hand-designed imitation. The rendering path is the same Face.project +
 * CounterVisuals.piece used on the real historical map, and SupportVectors.render
 * used in the current Support panel. No gameplay data is altered.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const Art=require('../core/counter_visuals');
const Face=require('../core/historical_counter_face_projection');
const Support=require('../core/support_counter_vectors');
const opening=require('../games/kiev-odessa/experimental-preview/opening-v531.json');
const source=require('../maps/counter-configs/kiev-odessa-experimental-v531.json');
const allUnits=Object.values(opening.contextStart.state.units);
const allocation=require('../games/kiev-odessa/experimental-preview/allocation-v533.json');
const buildup=require('../maps/buildup-configs/kiev-odessa-experimental-v533.json');
const fronts=new Map(source.faces.front.map(f=>[f.faceId,f]));
const backs=new Map(source.faces.back.map(f=>[f.faceId,f]));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories={panzer:'Panzer',infantry:'Infantry',mechanized:'Mechanized',cavalry:'Cavalry',motorized:'Motorized Infantry'};
const nations={soviet:'Soviet',german:'German',romanian:'Romanian',slovak:'Slovak',hungarian:'Hungarian',italian:'Italian'};
function svg(projected){return `<svg class="ground-counter-svg" viewBox="-3 -3 56 56" role="img" aria-label="${esc(projected.printedValues)} counter">${Art.piece(projected.art,0,0,'#909f97',{width:50,height:50})}</svg>`;}
function ground(u){
 const f=fronts.get(u.sourceFaceId),b=backs.get(u.reverseFaceId);
 if(!f||!b||f.pairedFaceId!==b.faceId||b.pairedFaceId!==f.faceId)throw Error('Unpaired original face '+u.id);
 const singleSided=f.role==='blank-face-of-single-sided-cavalry-counter'&&b.role==='single-sided-cavalry-printed-face';
 const identifier=(singleSided?b:f).visualTranscription?.printedIdentifier||'';
 const title=[nations[u.nationality]||u.nationality,categories[u.class]||u.class,identifier].filter(Boolean).join(' ');
 if(singleSided){
  const printed=Face.project(u,source);
  if(printed.displayStatus!=='one-step-single-sided'||printed.art.strength!=='full')throw Error('Single-sided counter must display without damage stripe '+u.id);
  return {id:u.id,title,category:'single-sided',note:`${printed.printedValues} · one-step, single printed face`,
   left:svg(printed),leftLabel:'Playable face',right:null,rightLabel:'Eliminated on step loss'};
 }
 const front=Face.project({...u,strengthStatus:'printed-full',activeFaceId:u.sourceFaceId},source);
 const isMech=f.visualTranscription.kind==='mechanized'&&/^\?[-·]/.test(f.visualTranscription.printedValues||'');
 const backState=isMech?'revealed-one-step':'printed-reduced';
 const back=Face.project({...u,strengthStatus:backState,activeFaceId:u.reverseFaceId},source);
 if(isMech&&(back.displayStatus!=='one-step-revealed'||back.art.strength!=='full'))throw Error('One-step mechanized reveal incorrectly marked damaged '+u.id);
 return {id:u.id,title,category:isMech?'untried':'two-step',note:`${front.printedValues} → ${back.printedValues}`,
  left:svg(front),leftLabel:isMech?'Untried':'Full strength',right:svg(back),rightLabel:isMech?'Revealed (one-step)':'Reduced strength'};
}
function sourceTitle(f){const v=f.visualTranscription||{};return v.printedIdentifier||String(v.visibleNotation||'').split(';')[0].trim()||f.faceId}
function supportShift(f){const s=String(f.visualTranscription?.printedValues||f.visualTranscription?.visibleNotation||'');const m=s.match(/([12])(?!.*[12])/);return m?Number(m[1]):1}
function support(){
 const chosen=new Map();
 for(const f of source.faces.front){
  if(!['air-support','air-marker','naval-marker'].includes(f.visualTranscription?.kind))continue;
  const title=sourceTitle(f);
  if(!chosen.has(title))chosen.set(title,f);
 }
 return [...chosen.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([title,f])=>{
  const b=backs.get(f.pairedFaceId);if(!b||b.pairedFaceId!==f.faceId)throw Error('Unpaired Support face '+f.faceId);
  const opts={label:title,shiftRating:supportShift(f)};
  const fleet=f.visualTranscription.kind==='naval-marker';
  const refit=String(b.visualTranscription?.visibleNotation||'').includes('REFIT');
  const backOpts={...opts,condition:fleet?'damaged':refit?'refit':'undamaged'};
  return {id:f.faceId,title,category:'support',note:fleet?'Fleet: damage can reduce effectiveness':refit?'Romanian Air Corps: refit after use':'Air Corps: front and reverse printed faces',
    left:Support.render(f,{...opts,condition:'undamaged'}),leftLabel:fleet?'Undamaged':'Ready',
    right:Support.render(b,backOpts),rightLabel:fleet?'Damaged':refit?'REFIT':'Reverse (not damaged)'};
 });
}
const rows=allUnits.map(ground).sort((a,b)=>a.title.localeCompare(b.title,undefined,{numeric:true}));
const laterDeclarations=[...buildup.reinforcements, {slotId:'replacement-only-army',group:buildup.replacementOnlyReserveGroup,index:0,
 nationality:'soviet',owner:'soviet',class:'infantry',size:'army',turn:null}];
const later=laterDeclarations.map(slot=>{
 const faceId=allocation[slot.group]?.[slot.index];
 const original=fronts.get(faceId);
 if(!original||!backs.has(original.pairedFaceId))throw Error('Missing source-built reserve face '+slot.slotId);
 const u={id:'original-reserve:'+slot.slotId,sourceFaceId:faceId,reverseFaceId:original.pairedFaceId,
   nationality:slot.nationality,owner:slot.owner,class:slot.class,size:slot.size,strengthStatus:'printed-full'};
 const entry=ground(u);
 entry.note=(slot.turn?'Turn '+slot.turn+' · ':'Replacement-only reserve · ')+entry.note;
 return entry;
});
if(later.length!==7||new Set([...rows,...later].map(x=>x.id)).size!==43)throw Error('Source-ground inventory not unique');
const supports=support();
if(rows.length!==36||supports.length!==4||rows.filter(x=>x.category==='untried').length!==10||rows.filter(x=>x.category==='single-sided').length!==3)
 throw Error('Original opening inventory changed unexpectedly: '+JSON.stringify({ground:rows.length,support:supports.length,untried:rows.filter(x=>x.category==='untried').length,singleSided:rows.filter(x=>x.category==='single-sided').length}));
function cellArt(x,label){return `<div class="art-wrap">${x||'<div class="eliminated" aria-label="No reduced-strength face">Eliminated<br><small>No reduced face</small></div>'}<div class="face-label">${esc(label)}</div></div>`}
function section(title,group){return `<section><h2>${esc(title)}</h2><div class="table"><div class="cell heading">Unit</div><div class="cell heading">Original full / untried / ready</div><div class="cell heading">Reduced / revealed / damaged</div>${group.map(r=>`<div class="cell label" data-gallery-unit="${esc(r.id)}" data-gallery-category="${esc(r.category)}"><b>${esc(r.title)}</b><span>${esc(r.note)}</span></div><div class="cell counter-cell">${cellArt(r.left,r.leftLabel)}</div><div class="cell counter-cell">${cellArt(r.right,r.rightLabel)}</div>`).join('')}</div></section>`}
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Original Kiev–Odessa counters · shared renderer</title><style>
*{box-sizing:border-box}body{font-family:system-ui,-apple-system,Arial,sans-serif;margin:0;background:#f5f7f8;color:#132833}.page{margin:0 auto;max-width:980px;padding:24px 24px 36px}h1{font-size:25px;margin:0 0 7px}h2{font-size:19px;margin:20px 0 10px}.summary{font-size:13px;color:#526874;line-height:1.45;margin:0 0 10px}.table{display:grid;grid-template-columns:minmax(220px,1.45fr) minmax(150px,1fr) minmax(150px,1fr);background:#fff;border:1px solid #cdd8de;border-radius:9px;overflow:hidden}.cell{min-height:100px;border-bottom:1px solid #e3e9ec;display:flex;justify-content:center;align-items:center;padding:8px 10px}.cell.heading{min-height:42px;background:#e6eef2;font-size:13px;font-weight:700;text-align:center;color:#304b58}.cell.label{align-items:flex-start;justify-content:center;flex-direction:column}.label b{font-size:14px}.label span{font-size:11px;color:#617580;margin-top:5px}.counter-cell{padding:8px}.art-wrap{display:flex;align-items:center;flex-direction:column;justify-content:center}.art-wrap svg{width:67px;height:67px;overflow:visible;display:block}.face-label{color:#425c67;font-size:10px;line-height:1.35;text-align:center;margin-top:6px}.eliminated{font-size:13px;font-weight:700;line-height:1.3;border:1px dashed #b6c5ca;border-radius:6px;padding:10px;background:#f9fbfc;color:#465963;text-align:center}.eliminated small{font-size:10px;font-weight:400}.footer{font-size:11px;color:#647987;margin-top:17px}section{page-break-inside:avoid}@media(max-width:610px){.page{padding:12px}.table{grid-template-columns:minmax(120px,1.4fr) minmax(92px,1fr) minmax(92px,1fr)}.cell{padding:7px 4px}.art-wrap svg{width:53px;height:53px}.label b{font-size:12px}.label span{font-size:10px}h1{font-size:21px}}
</style></head><body><main class="page"><h1>Kiev–Odessa · original counter faces</h1><p class="summary">Rendered by the actual shared game-engine SVG templates and source-face projections. The right side is not always a damage state: revealed Soviet Mechanized Corps remain one-step, and the three single-sided cavalry counters are eliminated by a step loss. No source-photo crops or new counter artwork are used.</p>${section('36 original opening ground counters',rows)}${section('6 scheduled reinforcements + 1 replacement-only reserve',later)}${section('4 original Support / Fleet counters',supports)}<p class="footer">Original source-face pairings and engine renderer · experimental Kiev–Odessa opening · v550 gallery</p></main></body></html>`;
const dest=path.join(root,'rules/audit/visual/kiev-odessa-source-counter-gallery-v550.html');
fs.writeFileSync(dest,html);
console.log('PASS gallery source inventory: '+rows.length+' opening + '+later.length+' scheduled/reserve ground / '+supports.length+' support; 10 one-step concealed, 3 single-sided; '+dest);
