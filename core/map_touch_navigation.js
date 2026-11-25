/* Browser-only shared map navigation. No changes to source map geometry,
 * counter coordinates, gameplay transactions or renderer markup. */
(function(root,factory){
 const api=factory();root.WargameTouchMap=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MIN=1, MAX=3, STEP=.25;
 function clamp(v){return Math.max(MIN,Math.min(MAX,Math.round(v/STEP)*STEP));}
 function mount({scroll,stage,toolbar,initialZoom,minimumWidth=0}={}){
  if(!scroll||!stage||!toolbar)throw Error('Map navigation requires a viewport, stage and toolbar');
  const coarse=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
  let zoom=clamp(initialZoom??(coarse?1.5:1));
  const fit=toolbar.querySelector('[data-map-zoom="fit"]');
  const out=toolbar.querySelector('[data-map-zoom="out"]');
  const inn=toolbar.querySelector('[data-map-zoom="in"]');
  const label=toolbar.querySelector('[data-map-zoom-label]');
  if(!fit||!out||!inn||!label)throw Error('Map navigation toolbar is incomplete');
  let oldWidth=0,oldHeight=0;
  function size({preserve=true}={}){
   const prevWidth=oldWidth||stage.getBoundingClientRect().width||1;
   const prevHeight=oldHeight||stage.getBoundingClientRect().height||1;
   const centerX=scroll.scrollLeft+scroll.clientWidth/2;
   const centerY=scroll.scrollTop+scroll.clientHeight/2;
   const width=Math.max(minimumWidth,Math.max(1,scroll.clientWidth))*zoom;
   stage.style.width=Math.round(width)+'px';
   stage.style.minWidth='0';stage.style.maxWidth='none';
   const measured=stage.getBoundingClientRect();oldWidth=measured.width;oldHeight=measured.height;
   if(preserve){
    scroll.scrollLeft=Math.max(0,centerX/prevWidth*oldWidth-scroll.clientWidth/2);
    scroll.scrollTop=Math.max(0,centerY/prevHeight*oldHeight-scroll.clientHeight/2);
   }
   label.textContent=Math.round(zoom*100)+'%';
   label.setAttribute('aria-label','Map zoom '+Math.round(zoom*100)+' percent');
   out.disabled=zoom<=MIN;inn.disabled=zoom>=MAX;
  }
  function setZoom(next){const value=clamp(next);if(value===zoom)return;zoom=value;size();}
  fit.addEventListener('click',()=>setZoom(MIN));
  out.addEventListener('click',()=>setZoom(zoom-STEP));
  inn.addEventListener('click',()=>setZoom(zoom+STEP));
  // Avoid stealing keyboard events from game controls. Focused map accepts +/-.
  scroll.addEventListener('keydown',e=>{
   if(e.target!==scroll||e.ctrlKey||e.metaKey||e.altKey)return;
   if(e.key==='+'||e.key==='='){e.preventDefault();setZoom(zoom+STEP);}
   else if(e.key==='-'){e.preventDefault();setZoom(zoom-STEP);}
   else if(e.key==='0'){e.preventDefault();setZoom(MIN);}
  });
  // Touch UX: two fingers pan; one finger is reserved for counter selection.
  // Use the midpoint so two pointers move as one and never touch gameplay state.
  const HELP_KEY='wargame-two-finger-map-help-v1';
  let firstTouchObserved=false;
  let pan=null;
  let singleTouchStart=null;
  let suppressClicksUntil=0;
  let reminderTimeout=null;
  const reminder=document.createElement('div');
  reminder.className='touch-map-reminder';
  reminder.setAttribute('role','status');
  reminder.setAttribute('aria-live','polite');
  reminder.textContent='Use two fingers to move the map. Tap once to select a counter.';
  reminder.hidden=true;
  scroll.parentElement.insertBefore(reminder,scroll);
  function remind(){
   if(firstTouchObserved)return;
   firstTouchObserved=true;
   try{if(sessionStorage.getItem(HELP_KEY)==='shown')return;sessionStorage.setItem(HELP_KEY,'shown');}catch(_){/* privacy mode */}
   reminder.hidden=false;
   if(reminderTimeout!==null)clearTimeout(reminderTimeout);
   reminderTimeout=setTimeout(()=>{reminder.hidden=true;},4200);
  }
  function midpoint(touches){
   return {x:(touches[0].clientX+touches[1].clientX)/2,
           y:(touches[0].clientY+touches[1].clientY)/2};
  }
  function onTouchStart(e){
   remind();
   if(e.touches.length===2){
    pan=midpoint(e.touches);
    singleTouchStart=null;
    suppressClicksUntil=Date.now()+650;
   }else if(e.touches.length===1){
    // A new tap after a completed pan must work immediately.
    suppressClicksUntil=0;
    pan=null;
    singleTouchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
   }else{pan=null;singleTouchStart=null;}
  }
  function onTouchMove(e){
   if(e.touches.length===2){
    // Explicit preventDefault suppresses native page scroll and pinch scaling.
    if(e.cancelable)e.preventDefault();
    const next=midpoint(e.touches);
    if(pan){scroll.scrollLeft-=next.x-pan.x;scroll.scrollTop-=next.y-pan.y;}
    pan=next;
    suppressClicksUntil=Date.now()+650;
   }else if(e.touches.length===1){
    // A one-finger drag must not move the board or select a unit accidentally.
    if(singleTouchStart&&Math.hypot(e.touches[0].clientX-singleTouchStart.x,
      e.touches[0].clientY-singleTouchStart.y)>9){
     suppressClicksUntil=Date.now()+650;
    }
   }else{
    pan=null;singleTouchStart=null;
   }
  }
  function onTouchEnd(e){
   if(e.touches.length!==2)pan=null;
   if(e.touches.length!==1)singleTouchStart=null;
   // Do not reinterpret a remaining finger as a new single-finger tap after panning.
   if(e.touches.length===1&&Date.now()<suppressClicksUntil)singleTouchStart=null;
  }
  function onClickCapture(e){
   if(Date.now()<suppressClicksUntil){e.preventDefault();e.stopImmediatePropagation();}
  }
  scroll.addEventListener('touchstart',onTouchStart,{passive:true});
  scroll.addEventListener('touchmove',onTouchMove,{passive:false});
  scroll.addEventListener('touchend',onTouchEnd,{passive:true});
  scroll.addEventListener('touchcancel',onTouchEnd,{passive:true});
  scroll.addEventListener('click',onClickCapture,true);
  let observer=null;
  if(typeof ResizeObserver==='function'){
   observer=new ResizeObserver(()=>size());observer.observe(scroll);
  }else if(typeof window!=='undefined')window.addEventListener('resize',()=>size());
  size({preserve:false});
  // On map-first touch screens, begin at the board's horizontal center rather
  // than its extreme left edge (some historical boards have large empty corners).
  // Desktop and the five-map viewer retain their established starting position.
  if(globalThis.WargameResponsiveShell?.getMode?.()==='mobile' && scroll.scrollWidth>scroll.clientWidth){
   scroll.scrollLeft=Math.round((scroll.scrollWidth-scroll.clientWidth)/2);
  }
  return Object.freeze({getZoom:()=>zoom,setZoom,fit:()=>setZoom(MIN),refresh:()=>size(),destroy:()=>{observer?.disconnect();scroll.removeEventListener('touchstart',onTouchStart);scroll.removeEventListener('touchmove',onTouchMove);scroll.removeEventListener('touchend',onTouchEnd);scroll.removeEventListener('touchcancel',onTouchEnd);scroll.removeEventListener('click',onClickCapture,true);reminder.remove();if(reminderTimeout!==null)clearTimeout(reminderTimeout)}});
 }
 return Object.freeze({MIN,MAX,STEP,clamp,mount});
});
