(function(){'use strict';
 const store=WargameMissionStorage.defaultStore();let generation=0;
 async function refresh(){const token=++generation;await Promise.all([...document.querySelectorAll('[data-mission]')].map(async card=>{
  const link=card.querySelector('[data-resume]'),status=card.querySelector('[data-status]');
  try{const exists=await store.exists(card.dataset.mission);if(token!==generation)return;link.hidden=!exists;status.textContent=exists?'Local save available':'No local save';}
  catch(e){if(token!==generation)return;link.hidden=true;status.textContent='Local save unavailable: '+e.message;}
 }));}
 refresh();addEventListener('pageshow',refresh);WargameMissionStorage.subscribe(refresh);
})();
