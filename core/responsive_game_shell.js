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
 const SIDEBAR_KEY='russian-campaign.sidebar-visible.v1';
 let desktopVisible=true;
 try{desktopVisible=root.localStorage?.getItem(SIDEBAR_KEY)!=='false';}catch(_){}
 let preference=load(),mode='desktop',isOpen=false,aside=null,launcher=null,closeButton=null,backdrop=null,autoButton=null,desktopInput=null,modeText=null,sidebarToggle=null,settingsRestore=null;
 function isSettings(){return aside?.dataset.activeTab==='settings';}
 function visible(){return mode==='mobile'?isOpen:desktopVisible||isSettings();}
 function setDesktopVisible(next){desktopVisible=Boolean(next);try{root.localStorage?.setItem(SIDEBAR_KEY,String(desktopVisible));}catch(_){}syncDrawer();}
 function playTab(){aside?.querySelector('[data-game-tab="play"]')?.click();}
 function openSettings(){if(!aside)return;if(settingsRestore===null)settingsRestore=mode==='mobile'?isOpen:desktopVisible;if(mode==='mobile')open();else syncDrawer();}
 function closeSettings(){const previous=settingsRestore;settingsRestore=null;playTab();if(mode==='mobile'){isOpen=previous===true;syncDrawer();}else syncDrawer();document.getElementById('mission-settings')?.focus({preventScroll:true});}
 function toggleSidebar(){if(isSettings()){closeSettings();return;}if(mode==='mobile'){if(isOpen)close();else open();}else setDesktopVisible(!desktopVisible);}
 function enableSidebarToggle(){
  if(sidebarToggle||!aside)return;
  const nav=document.getElementById('map-navigation');if(!nav)return;
  sidebarToggle=document.createElement('button');sidebarToggle.type='button';sidebarToggle.id='mission-sidebar-toggle';
  sidebarToggle.setAttribute('aria-controls','game-sidebar');sidebarToggle.addEventListener('click',toggleSidebar);
  nav.prepend(sidebarToggle);syncDrawer();
 }
 function effective(){return preference==='auto'?detect():preference;}
 function syncHeight(){if(!hasDOM())return;const h=document.querySelector('body>header')?.getBoundingClientRect().height||56;document.body.style.setProperty('--mobile-header-height',h+'px');}
 function close(){if(isSettings()){settingsRestore=null;playTab();}isOpen=false;syncDrawer();}
 function open(){if(mode!=='mobile')return;isOpen=true;syncDrawer();closeButton?.focus({preventScroll:true});}
 // Map actions may require an explicit follow-up. Reveal that existing control,
 // not an alternate command path. Desktop keeps its established interaction.
 function openAt(id){
  if(!aside)return;
  if(mode==='desktop'&&document.body.dataset.missionMenuReady!=='true')return;
  if(isSettings()){settingsRestore=null;playTab();}
  const target=aside.querySelector('#'+id);
  if(!target||target.closest('[hidden]'))return;
  if(mode==='mobile')open();
  else if(!desktopVisible)setDesktopVisible(true);
  const heading=aside.querySelector('.mobile-controls-heading');
  const tabs=aside.querySelector('.game-tab-strip');
  const inset=(heading?.offsetHeight||0)+(tabs?.offsetHeight||0)+8;
  aside.scrollTop+=target.getBoundingClientRect().top-aside.getBoundingClientRect().top-inset;
 }
 function syncDrawer(){
  if(!aside)return;
  const opened=mode==='mobile'&&isOpen;
  document.body.dataset.mobileControlsOpen=String(opened);
  const shown=visible(),enhanced=document.body.dataset.missionMenuReady==='true';
  document.body.dataset.desktopSidebarVisible=String(shown);
  aside.inert=mode==='mobile'?!opened:enhanced&&!shown;
  aside.setAttribute('aria-hidden',String(aside.inert));
  launcher?.setAttribute('aria-expanded',String(opened));
  if(sidebarToggle){
   sidebarToggle.setAttribute('aria-expanded',String(shown));
   sidebarToggle.textContent=shown?'Hide panel':'Show panel';
   sidebarToggle.title=shown?'Hide information panel':'Show information panel';
   sidebarToggle.setAttribute('aria-label',sidebarToggle.title);
  }
  const gear=document.getElementById('mission-settings');
  if(gear)gear.setAttribute('aria-pressed',String(shown&&isSettings()));
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
  launcher.setAttribute('aria-label','Open game controls');launcher.addEventListener('click',()=>{
   if(document.body.dataset.missionMenuReady==='true')aside.querySelector('[data-game-tab="play"]')?.click();
   open();
  });board.append(launcher);
  const heading=document.createElement('div');heading.className='mobile-controls-heading';
  const name=document.createElement('strong');name.textContent='Game controls';
  closeButton=document.createElement('button');closeButton.type='button';closeButton.className='mobile-drawer-close';
  closeButton.textContent='Close';closeButton.setAttribute('aria-label','Close game controls');
  closeButton.addEventListener('click',()=>{close();(sidebarToggle||launcher)?.focus({preventScroll:true});});
  heading.append(name,closeButton);aside.prepend(heading);
  const sourceWarning=document.querySelector('body>.warning');
  if(sourceWarning){
   const note=document.createElement('details');note.className='mobile-source-note';
   const summary=document.createElement('summary');summary.textContent='Development / setup limitations';
   const p=document.createElement('p');p.textContent=sourceWarning.textContent;
   note.append(summary,p);aside.insertBefore(note,heading.nextSibling);
  }
  document.addEventListener('keydown',e=>{if(e.defaultPrevented)return;if(e.key==='Escape'&&isOpen){e.preventDefault();close();(sidebarToggle||launcher)?.focus({preventScroll:true});}});
  root.addEventListener?.('resize',()=>{if(preference==='auto')apply();else syncHeight();});
  apply();
 }
 if(hasDOM()){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
 }
 return Object.freeze({STORAGE_KEY,detect,load,mount,setPreference,attachSettings,getMode:()=>mode,getPreference:()=>preference,isOpen:visible,open,openAt,close,openSettings,closeSettings,enableSidebarToggle});
});
