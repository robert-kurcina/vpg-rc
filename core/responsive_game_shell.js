/* Shared browser presentation shell. Does not touch map geometry, unit state,
   action dispatch, save files, or rules. Mobile defaults are device-adaptive;
   user can force either full desktop controls or compact map-first mode. */
(function(root,factory){
 const api=factory(root);root.WargameResponsiveShell=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const STORAGE_KEY='russian-campaign.layout-mode.v1';
 const valid=new Set(['auto','mobile','desktop']);
 const hasDOM=()=>typeof document!=='undefined';
 function detect({width,coarse,hoverNone,touchPoints}={}){
  const w=width??(hasDOM()?document.documentElement.clientWidth:1200);
  const c=coarse??(typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches);
  const h=hoverNone??(typeof matchMedia==='function'&&matchMedia('(hover: none)').matches);
  const n=touchPoints??(typeof navigator!=='undefined'?navigator.maxTouchPoints:0);
  // iPadOS may report a fine primary pointer when paired with a trackpad.
  return w<=700 || !!c || (!!h && w<=1200) || (n>=2&&w<=1366)?'mobile':'desktop';
 }
 function load(){try{const v=root.localStorage?.getItem(STORAGE_KEY);return valid.has(v)?v:'auto';}catch(_){return 'auto';}}
 function store(v){try{root.localStorage?.setItem(STORAGE_KEY,v)}catch(_){}}
 let preference=load(),mode='desktop',isOpen=false,aside=null,launcher=null,closeButton=null,backdrop=null,autoButton=null,desktopInput=null,modeText=null;
 function effective(){return preference==='auto'?detect():preference;}
 function syncHeight(){if(!hasDOM())return;const h=document.querySelector('body>header')?.getBoundingClientRect().height||56;document.body.style.setProperty('--mobile-header-height',h+'px');}
 function close(){isOpen=false;syncDrawer();}
 function open(){if(mode!=='mobile')return;isOpen=true;syncDrawer();closeButton?.focus({preventScroll:true});}
 // Map actions may require an explicit follow-up. Reveal that existing control,
 // not an alternate command path. Desktop keeps its established interaction.
 function openAt(id){
  if(mode!=='mobile'||!aside)return;
  aside.querySelector('[data-game-tab=play]')?.click();
  const target=aside.querySelector('#'+id);
  if(!target||target.closest('[hidden]'))return;
  open();
  const heading=aside.querySelector('.mobile-controls-heading');
  const tabs=aside.querySelector('.game-tab-strip');
  const inset=(heading?.offsetHeight||0)+(tabs?.offsetHeight||0)+8;
  aside.scrollTop+=target.getBoundingClientRect().top-aside.getBoundingClientRect().top-inset;
 }
 function syncDrawer(){
  if(!aside)return;
  const opened=mode==='mobile'&&isOpen;
  document.body.dataset.mobileControlsOpen=String(opened);
  aside.inert=mode==='mobile'&&!opened;
  aside.setAttribute('aria-hidden',String(mode==='mobile'&&!opened));
  launcher?.setAttribute('aria-expanded',String(opened));
  if(backdrop)backdrop.hidden=!opened;
 }
 function syncSettings(){
  if(desktopInput)desktopInput.checked=mode==='desktop';
  if(modeText)modeText.textContent=preference==='auto'?'Automatic detection ('+mode+')':'Manual override ('+mode+')';
  if(autoButton)autoButton.disabled=preference==='auto';
 }
 function apply(){
  if(!hasDOM()||!aside)return;
  mode=effective();document.body.dataset.layoutMode=mode;
  if(mode!=='mobile')isOpen=false;
  syncHeight();syncDrawer();syncSettings();
 }
 function setPreference(next){if(!valid.has(next))throw Error('Unknown layout mode');preference=next;store(next);apply();}
 function attachSettings(host){
  if(!host||!aside)return;
  const group=document.createElement('section');group.className='layout-mode-settings';
  const title=document.createElement('h3');title.textContent='Interface layout';
  const label=document.createElement('label');label.className='setting-switch';
  desktopInput=document.createElement('input');desktopInput.type='checkbox';desktopInput.id='layout-desktop-mode';
  label.append(desktopInput,document.createTextNode(' Desktop mode'));
  desktopInput.addEventListener('change',()=>setPreference(desktopInput.checked?'desktop':'mobile'));
  modeText=document.createElement('p');modeText.className='setting-caption';
  autoButton=document.createElement('button');autoButton.type='button';autoButton.className='layout-auto-button';
  autoButton.textContent='Use automatic detection';autoButton.addEventListener('click',()=>setPreference('auto'));
  group.append(title,label,modeText,autoButton);host.append(group);syncSettings();
 }
 function mount(){
  if(!hasDOM()||aside)return;
  aside=document.querySelector('#game-sidebar');const board=document.querySelector('.board-space');
  if(!aside||!board)return;
  backdrop=document.createElement('div');backdrop.className='mobile-controls-backdrop';backdrop.hidden=true;
  backdrop.addEventListener('click',close);document.body.append(backdrop);
  launcher=document.createElement('button');launcher.type='button';launcher.className='mobile-controls-launcher';
  launcher.textContent='Controls';launcher.setAttribute('aria-controls','game-sidebar');
  launcher.setAttribute('aria-label','Open game controls');launcher.addEventListener('click',open);board.append(launcher);
  const heading=document.createElement('div');heading.className='mobile-controls-heading';
  const name=document.createElement('strong');name.textContent='Game controls';
  closeButton=document.createElement('button');closeButton.type='button';closeButton.className='mobile-drawer-close';
  closeButton.textContent='Close';closeButton.setAttribute('aria-label','Close game controls');
  closeButton.addEventListener('click',()=>{close();launcher?.focus();});
  heading.append(name,closeButton);aside.prepend(heading);
  const sourceWarning=document.querySelector('body>.warning');
  if(sourceWarning){
   const note=document.createElement('details');note.className='mobile-source-note';
   const summary=document.createElement('summary');summary.textContent='Development / setup limitations';
   const p=document.createElement('p');p.textContent=sourceWarning.textContent;
   note.append(summary,p);aside.insertBefore(note,heading.nextSibling);
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen){e.preventDefault();close();launcher?.focus();}});
  root.addEventListener?.('resize',()=>{if(preference==='auto')apply();else syncHeight();});
  apply();
 }
 if(hasDOM()){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
 }
 return Object.freeze({STORAGE_KEY,detect,load,mount,setPreference,attachSettings,getMode:()=>mode,getPreference:()=>preference,isOpen:()=>isOpen,open,openAt,close});
});
