// v2.65: Oberlabs phase-guided gameplay layout. This is a wrapper over the
// existing Battle for Moscow engine/UI actions, not a reimplementation of rules.
// Original Oberlabs flow reference: https://oberlabs.com/b4m/
(()=>{'use strict';
const $=id=>document.getElementById(id);
const btn=(text,id)=>{const b=document.createElement('button');b.type='button';b.id=id;b.textContent=text;return b;};
const top=document.createElement('nav');top.id='ol-top';top.setAttribute('aria-label','Game navigation');
top.innerHTML='<div class="ol-brand">Battle for Moscow <span>Operation Typhoon · 1941</span></div><div class="ol-topright"><span id="ol-status">Turn 1</span><button type="button" id="ol-new">New Game</button><button type="button" id="ol-rules">Rules &amp; charts</button><button type="button" id="ol-research">AI research</button></div>';
document.body.insertBefore(top,document.querySelector('header'));
document.body.classList.add('ol-play-mode');
const playPanel=document.createElement('aside');playPanel.id='ol-panel';
playPanel.innerHTML='<section class="ol-panel-section"><div class="ol-eyebrow">GAME TURN</div><div id="ol-turn" class="ol-turn">Turn 1</div><div id="ol-phase" class="ol-phase">Setting Up</div><p id="ol-guidance" class="ol-guidance"></p></section><section class="ol-panel-section"><h2>Phase actions</h2><div id="ol-actions"></div><div id="ol-phase-buttons"></div></section><section class="ol-panel-section ol-rules"><h2>Sequence of Play</h2><ol><li>German Replacement</li><li>German Special Panzer Movement</li><li>German Combat</li><li>German Movement</li><li>Russian Replacement</li><li>Russian Special Rail Movement</li><li>Russian Combat</li><li>Russian Movement</li></ol><p>Turn 1 German replacement and special movement are omitted. Turns 3–4 are mud.</p></section><section class="ol-panel-section ol-stacking-section"><button type="button" id="ol-stack-toggle">Counter stacking display examples</button><div id="ol-stack-slot"></div></section><section class="ol-panel-section ol-event"><h2>Recent activity</h2><div id="ol-log-slot"></div></section>';
document.querySelector('main').append(playPanel);
const research=$('mode').closest('aside');research.id='ol-research-drawer';
const modeSlot=document.createElement('div');modeSlot.id='ol-mode-slot';
const modal=document.createElement('dialog');modal.id='ol-game-dialog';modal.innerHTML='<form method="dialog"><h2>New Game</h2><p>Choose who controls each side.</p><div id="ol-modes"></div><div class="ol-dialog-controls"><button type="button" id="ol-cancel">Cancel</button></div></form>';document.body.append(modal);
const choices=[['both','AI vs AI'],['german','Germany vs Russian AI'],['soviet','Russia vs German AI'],['hotseat','Solitaire / Hotseat']];
choices.forEach(([mode,label])=>{const b=btn(label,'ol-mode-'+mode);b.className='ol-mode-button';b.onclick=()=>{$('mode').value=mode;$('new').click();modal.close();sync()};modal.querySelector('#ol-modes').append(b);});
$('ol-cancel').onclick=()=>modal.close();
$('ol-new').onclick=()=>modal.showModal();
$('ol-research').onclick=()=>document.body.classList.toggle('ol-research-open');
const details=document.createElement('dialog');details.id='ol-rules-dialog';details.innerHTML='<div class="ol-dialog-header"><h2>Battle for Moscow — Rules &amp; Charts</h2><button type="button" id="ol-close-rules">Close</button></div><p>These reference links open the original Oberlabs rules and game. The embedded engine follows the Oberlabs phase order, combat table, mud and victory conditions.</p><p><a href="https://oberlabs.com/b4m/rules.html" target="_blank" rel="noopener">Oberlabs official rules</a> · <a href="https://oberlabs.com/b4m/" target="_blank" rel="noopener">Original game</a></p><h3>German turn</h3><p>Replacement → Special Panzer Movement → Combat → Movement</p><h3>Russian turn</h3><p>Replacement → Special Rail Movement → Combat → Movement</p><h3>Victory</h3><p>German victory: Moscow held at the end of Turn 7. Russian victory: Moscow and another city held. Otherwise draw.</p>';document.body.append(details);
$('ol-rules').onclick=()=>details.showModal();$('ol-close-rules').onclick=()=>details.close();
// Reparent existing, fully wired controls rather than duplicate game logic.
const act=$('ol-actions');act.append($('selected'),$('options'));
const controls=$('ol-phase-buttons');
for(const id of ['phase','undo','nextAI','auto','stop'])controls.append($(id));
$('ol-log-slot').append($('log'));
$('ol-stack-slot').append($('stack-examples'));
$('ol-stack-toggle').onclick=()=>document.body.classList.toggle('ol-stacking-open');
// Existing game state is encapsulated in legacy/ui.js; the status pill is the
// externally visible game-state notification and is updated by every render.
function sync(){
 const st=$('statusPill').textContent||'Setting up';
 $('ol-status').textContent=st;
 $('ol-turn').textContent=$('turnText').textContent||'Turn 1';
 const phase=st.includes(' · ')?st.split(' · ').at(-1):st;
 const phaseNames={setup:'Setting Up',reinforcement:'Russian Reinforcement',replacement:'Replacement Phase',special:st.includes('Germany')?'Special Panzer Movement':'Special Rail Movement',combat:'Combat Phase','combat-resolution':'Battle Resolution',movement:'Movement Phase'};
 $('ol-phase').textContent=phaseNames[phase]||phase;
 $('ol-guidance').textContent=$('phaseHelp').textContent;
 $('ol-phase-buttons').classList.toggle('ol-ai-only', $('phase').disabled);
}
new MutationObserver(sync).observe($('statusPill'),{childList:true,characterData:true,subtree:true});
// Phase text may change without the pill (selected actions); observe the help.
new MutationObserver(sync).observe($('phaseHelp'),{childList:true,characterData:true,subtree:true});
// End-user controls are the actual engine buttons. Advanced scientific work
// stays accessible in the research drawer, untouched and fully functional.
setTimeout(sync,0);
})();
