/* Mission-local saves are transport only; authoritative restore validates the payload. */
(function(root){'use strict';
 const missions=Object.freeze(['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']);
 function key(id){if(!missions.includes(id))throw Error('Unknown mission');return 'russian-campaign:mission:v1:'+id;}
 function envelope(id,save){key(id);if(!save||typeof save!=='object'||Array.isArray(save))throw Error('Invalid mission save');return {version:1,mission:id,save};}
 function unpack(id,entry){if(entry?.version!==1||entry.mission!==id||!entry.save||typeof entry.save!=='object'||Array.isArray(entry.save))throw Error('Invalid mission save envelope');return entry.save;}
 // Original synchronous localStorage format remains readable for migration and
 // environments without IndexedDB. Portable engine JSON is unchanged.
 function write(storage,id,save){storage.setItem(key(id),JSON.stringify(envelope(id,save)));}
 function read(storage,id){const raw=storage.getItem(key(id));return raw===null?null:unpack(id,JSON.parse(raw));}
 function remove(storage,id){storage.removeItem(key(id));}
 const databaseName='russian-campaign-missions',table='mission-saves';
 function createStore({indexedDB,getStorage,notify=()=>{}}){
  let opening;
  function database(){
   if(opening)return opening;
   const attempt=new Promise((resolve,reject)=>{
    if(!indexedDB){resolve(null);return;}
    let request;
    try{request=indexedDB.open(databaseName,1);}catch(e){if(e.name==='SecurityError'||e.name==='NotSupportedError'){resolve(null);return;}reject(e);return;}
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(table))request.result.createObjectStore(table);};
    let blocked=false;
    request.onblocked=()=>{blocked=true;reject(Error('Mission database is blocked by another tab. Close other game tabs and try again.'));};
    request.onerror=()=>{const e=request.error;if(e?.name==='SecurityError'||e?.name==='NotSupportedError')resolve(null);else reject(e||Error('Could not open mission database.'));};
    request.onsuccess=()=>{const db=request.result;if(blocked){db.close();return;}db.onversionchange=()=>{db.close();if(opening===attempt)opening=null;};resolve(db);};
   });
   opening=attempt;
   // Share concurrent opens, but allow a subsequent explicit operation to retry
   // a failed open. An obsolete request must not invalidate a newer connection.
   attempt.catch(()=>{if(opening===attempt)opening=null;});
   return attempt;
  }
  // Resolve only after the whole transaction has committed, not request success.
  function transaction(db,mode,work){return new Promise((resolve,reject)=>{
   let tx,result;
   try{tx=db.transaction(table,mode);tx.oncomplete=()=>{try{resolve(result?.());}catch(e){reject(e);}};tx.onabort=()=>reject(tx.error||Error('Mission storage transaction aborted.'));result=work(tx.objectStore(table));}
   catch(e){try{tx?.abort();}catch(_){}reject(e);}
  });}
  const meta=id=>key(id)+':present',payload=id=>key(id)+':payload';
  function legacyStorage(){return getStorage();}
  function legacyRead(id,primaryAvailable){let storage;try{storage=legacyStorage();}catch(e){if(primaryAvailable&&e.name==='SecurityError')return null;throw e;}try{return read(storage,id);}catch(e){if(primaryAvailable&&e.name==='SecurityError')return null;throw e;}}
  function cleanupLegacy(id){try{remove(legacyStorage(),id);}catch(_){/* The committed metadata prevents stale legacy resurrection. */}}
  return Object.freeze({
   async exists(id){key(id);const db=await database();if(!db)return legacyRead(id,false)!==null;
    const flag=await transaction(db,'readonly',store=>{const q=store.get(meta(id));return ()=>q.result;});
    if(flag!==undefined&&typeof flag!=='boolean')throw Error('Invalid mission storage metadata');
    return flag===undefined?legacyRead(id,true)!==null:flag;
   },
   async read(id){key(id);const db=await database();if(!db)return legacyRead(id,false);
    const [flag,entry]=await transaction(db,'readonly',store=>{const m=store.get(meta(id)),p=store.get(payload(id));return ()=>[m.result,p.result];});
    if(flag===false)return null;if(flag===true)return unpack(id,entry);
    if(flag!==undefined||entry!==undefined)throw Error('Invalid mission storage metadata');
    return legacyRead(id,true);
   },
   async write(id,save){const entry=envelope(id,save),db=await database();
    if(!db)write(legacyStorage(),id,save);
    else{await transaction(db,'readwrite',store=>{store.put(entry,payload(id));store.put(true,meta(id));});cleanupLegacy(id);}
    notify(id);
   },
   async remove(id){key(id);const db=await database();
    if(!db)remove(legacyStorage(),id);
    else{await transaction(db,'readwrite',store=>{store.delete(payload(id));store.put(false,meta(id));});cleanupLegacy(id);}
    notify(id);
   }
  });
 }
 // Same-origin database writes do not fire localStorage events. Broadcast
 // successful commits when available; menu-open/pageshow refresh also work.
 let channel=null,browserStore=null;
 function defaultStore(){if(!browserStore){let idb;try{idb=root.indexedDB;}catch(_){}try{channel=typeof root.BroadcastChannel==='function'?new root.BroadcastChannel(databaseName):null;}catch(_){}
  browserStore=createStore({indexedDB:idb,getStorage:()=>root.localStorage,notify:id=>{try{channel?.postMessage(id);}catch(_){}}});}return browserStore;}
 function subscribe(fn){defaultStore();channel?.addEventListener('message',e=>{if(missions.includes(e.data))fn(e.data);});root.addEventListener('storage',e=>{if(e.key===null)fn(null);else for(const id of missions)if(e.key===key(id))fn(id);});}
 // The controllers own successor sessions; Redo restores the exact previously
 // committed successor, including dice, rather than executing an action again.
 // Any change of the current session outside Undo/Redo invalidates the branch.
 function redoHistory(){
  let anchor=null, future=[];
  function observe(current){if(current!==anchor){future=[];anchor=current;}}
  return Object.freeze({observe,clear(){anchor=null;future=[];},
   recordUndo(before,after){observe(before);if(before===after)return;future.push(before);anchor=after;},
   available(current){observe(current);return future.length>0;},
   take(current){observe(current);if(!future.length)return null;anchor=future.pop();return anchor;}});
 }
 function mountToolbar({undo,redo,settings}){
  const header=document.querySelector('body > header');if(!header||!undo)return;
  const bar=document.createElement('div');bar.className='mission-history-toolbar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Mission controls');
  const make=(id,label,icon,fn)=>{const b=document.createElement('button');b.type='button';b.id=id;b.title=label;b.setAttribute('aria-label',label);b.textContent=icon;b.addEventListener('click',fn);return b;};
  undo.title='Undo';undo.setAttribute('aria-label','Undo');undo.textContent='↶';
  const redoButton=make('redo','Redo','↷',redo);redoButton.disabled=true;
  const settingsButton=make('mission-settings','Settings','⚙',()=>{
   const shell=root.WargameResponsiveShell,sidebar=document.querySelector('#game-sidebar');
   if(document.body.dataset.missionMenuReady==='true'&&sidebar?.dataset.activeTab==='settings'&&shell?.isOpen()){
    shell.closeSettings();
    return;
   }
   if(shell)shell.openSettings(settings);
   else settings();
  });
  settingsButton.setAttribute('aria-controls','settings-section');settingsButton.setAttribute('aria-pressed','false');
  bar.append(undo,redoButton);header.append(bar,settingsButton);root.dispatchEvent(new Event('resize'));
  return redoButton;
 }
 async function mount({id,anchor,save,restore,busy,pause,reference,notice}){
  const store=defaultStore(),controls=document.createElement('div');controls.className='actions mission-local-controls';
  const status=document.createElement('p');status.setAttribute('role','status');status.className='mission-local-status';
  let pending=false,present=false,canDelete=false,generation=0;
  function showError(e,target=status){target.textContent=(e?.name==='QuotaExceededError'?'Browser storage is full. Export a portable JSON save or free browser storage.':e?.message||String(e));if(target===status)notice?.(target.textContent);}
  function setDisabled(){saveButton.disabled=pending;resumeButton.disabled=pending||!present;deleteButton.disabled=pending||!canDelete;}
  async function sync(){const token=++generation;try{const exists=await store.exists(id);if(token!==generation)return;present=canDelete=exists;if(status.textContent.startsWith('Local save unavailable: '))status.textContent='';}catch(e){if(token!==generation)return;status.textContent='Local save unavailable: '+e.message;present=false;canDelete=true;}setDisabled();}
  async function run(fn,target=status){if(pending)return false;try{if(busy())throw Error('Stop computer play first.');pending=true;setDisabled();await fn();return true;}catch(e){showError(e,target);return false;}finally{await sync();pending=false;setDisabled();}}
  const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{void run(fn);});controls.append(b);return b;};
  const saveButton=button('Save Mission',async()=>{status.textContent='Saving mission…';await store.write(id,save());status.textContent='Mission saved on this browser.';});
  const resumeButton=button('Resume Mission',async()=>{const saved=await store.read(id);if(!saved)throw Error('No saved mission.');if(busy())throw Error('Stop computer play first.');if(!root.confirm('Replace the current position with the saved mission?'))return;if(restore(saved)===false)throw Error('Saved mission rejected by the engine.');status.textContent='Saved mission restored.';});
  const deleteButton=button('Delete local save',async()=>{if(!root.confirm('Delete the local save for this mission? The current game will remain open.'))return;await store.remove(id);status.textContent='Local mission save deleted.';});
  setDisabled();
  const home=document.querySelector('header a[href="../../../index.html"]');
  const toolbar=document.querySelector('.mission-history-toolbar');
  let toggle=null,menu=null;
  function closeMenu(focus=false){if(!menu)return;menu.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus();}
  if(home&&toolbar){
   const wrapper=document.createElement('div');wrapper.className='mission-menu-wrapper';
   toggle=document.createElement('button');toggle.type='button';toggle.id='mission-menu-toggle';toggle.textContent='☰';toggle.title='Mission menu';toggle.setAttribute('aria-label','Mission menu');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','mission-menu');
   menu=document.createElement('div');menu.id='mission-menu';menu.className='mission-menu';menu.hidden=true;
   // Use three explicit strokes instead of a font-dependent hamburger glyph.
   toggle.textContent='';
   const glyph=document.createElement('span');glyph.className='mission-hamburger-glyph';glyph.setAttribute('aria-hidden','true');
   for(let i=0;i<3;i++)glyph.append(document.createElement('span'));
   toggle.append(glyph);
   wrapper.append(toggle,menu);
   const header=toolbar.closest('header');header.prepend(wrapper);
   toggle.addEventListener('click',()=>{if(menu.hidden){menu.hidden=false;toggle.setAttribute('aria-expanded','true');sync();}else closeMenu();});
   document.addEventListener('pointerdown',e=>{if(!wrapper.contains(e.target))closeMenu();});
   wrapper.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){e.preventDefault();e.stopPropagation();closeMenu(true);}});
   function row(el,icon){const name=el.textContent;el.replaceChildren();const glyph=document.createElement('span');glyph.className='mission-menu-icon';glyph.textContent=icon;glyph.setAttribute('aria-hidden','true');const label=document.createElement('span');label.textContent=name;el.append(glyph,label);el.classList.add('mission-menu-row');menu.append(el);}
   const oldNav=home.closest('nav'),otherLinks=oldNav?[...oldNav.querySelectorAll('a')].filter(a=>a!==home):[];
   home.textContent='Choose Mission';row(home,'▦');row(saveButton,'↓');row(resumeButton,'↑');
   if(reference){for(const [label,tab,icon] of [['See Rules','howto','≡'],['See TEC','terrain','▤'],['See CRT','crt','▥']]){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{closeMenu();reference(tab,toggle);});row(b,icon);
   }}
   const exit=document.createElement('button');exit.type='button';exit.textContent='Exit Game';
   const abandon=document.createElement('button');abandon.type='button';abandon.textContent='Abandon Mission';
   row(abandon,'×');row(exit,'→');
   // Preserve the approved eight-row menu and relocate maintenance tools.
   const settingsPanel=document.getElementById('settings-section');
   if(settingsPanel&&reference){
    const maintenance=document.createElement('details');
    maintenance.className='mission-maintenance';
    const summary=document.createElement('summary');summary.textContent='Mission maintenance and source references';maintenance.append(summary);
    const newGame=document.getElementById('new-game');
    if(newGame)newGame.textContent='Start new mission';
    const portableSave=document.getElementById(id==='battle-for-moscow'?'save-game':'save');
    for(const node of [newGame,portableSave?.parentElement,deleteButton,...otherLinks]){
     if(node)maintenance.append(node);
    }
    settingsPanel.append(maintenance);
    root.WargameDisplaySettings?.organizeSettings(settingsPanel);
    document.body.dataset.missionMenuReady='true';
    const title=header.querySelector('h1')?.parentElement;
    title?.classList.add('mission-header-title');
    // The sidebar toggle is a direct viewport action, not a third menu.
    root.WargameResponsiveShell?.enableSidebarToggle();
   }else{
    row(deleteButton,'−');for(const link of otherLinks)row(link,'↗');
   }
   if(oldNav&&!oldNav.children.length)oldNav.remove();
   menu.append(status);
   document.getElementById('mission-settings')?.addEventListener('click',()=>closeMenu());
   const dialog=document.createElement('dialog');dialog.className='mission-leave-dialog';dialog.setAttribute('aria-label','Leave mission');
   const prompt=document.createElement('p');prompt.textContent='Save this mission before returning to the mission selector?';dialog.append(prompt);
   const error=document.createElement('p');error.setAttribute('role','status');dialog.append(error);
   const options=document.createElement('div');options.className='actions';dialog.append(options);
   const leave=()=>root.location.assign(home.href);
   const option=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',async()=>{if(pending)return;for(const x of options.children)x.disabled=true;try{await run(fn,error);}finally{for(const x of options.children)x.disabled=false;}});options.append(b);};
   option('Save and return',async()=>{error.textContent='Saving mission…';await store.write(id,save());leave();});option('Discard unsaved progress',leave);option('Cancel',()=>dialog.close());options.lastElementChild.autofocus=true;
   document.body.append(dialog);dialog.addEventListener('close',()=>toggle.focus());dialog.addEventListener('cancel',e=>{if(pending)e.preventDefault();});
   function requestLeave(){if(pending||busy()){status.textContent=pending?'Wait for the local save operation to finish.':'Stop computer play before leaving.';notice?.(status.textContent);return;}pause?.();error.textContent='';closeMenu();dialog.showModal();}
   home.addEventListener('click',e=>{e.preventDefault();requestLeave();});exit.addEventListener('click',requestLeave);
   abandon.addEventListener('click',()=>{void run(async()=>{pause?.();if(!root.confirm('Abandon this mission and permanently delete its local save? Other missions will not be affected.'))return;await store.remove(id);leave();});});
   root.dispatchEvent(new Event('resize'));
  }else{anchor.after(controls,status);}
  subscribe(changed=>{if(changed===null||changed===id)void sync();});root.addEventListener('pageshow',sync);
  const resumeRequested=new URLSearchParams(root.location.search).get('resume')==='1';
  if(resumeRequested){
   const wasInert=document.body.inert;document.body.inert=true;
   try{await sync();const saved=await store.read(id);if(!saved)throw Error('No saved mission.');if(restore(saved)===false)throw Error('Saved mission rejected by the engine.');status.textContent='Saved mission restored.';}catch(e){showError(e);}finally{document.body.inert=wasInert;}
  }else await sync();
 }
 const api={missions,key,write,read,remove,createStore,defaultStore,subscribe,mount,redoHistory,mountToolbar};if(typeof module==='object'&&module.exports)module.exports=api;else root.WargameMissionStorage=api;
})(typeof globalThis!=='undefined'?globalThis:this);
