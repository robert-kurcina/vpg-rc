'use strict';
/* Source-backed, presentation-only Oberlabs-style activation reminder. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const A=require('../core/counter_phase_activation');
const C=require('../core/counter_visuals');
let checks=0;
function eq(x,y,label){assert.deepEqual(x,y,label);checks++;}
function yes(x,label){assert.ok(x,label);checks++;}
const ids=v=>[...v].sort();
const base={turn:1,side:'german',moved:[],committed:[],log:[],over:false};
eq(ids(A.native(base,{kind:'move'})),[],'not yet activated');
eq(ids(A.native({...base,moved:['a','b']},{kind:'move'})),['a','b'],'after movement actions');
eq(ids(A.native({...base,moved:['a'],committed:['b','def:z']},{kind:'combat'})),['b'],'only attacking units marked after combat');
eq(ids(A.native({...base,moved:['a'],committed:['b']},{kind:'move'})),['a'],'combat actions not carried into move');
eq(ids(A.native({...base,log:[{type:'replacement',turn:1,side:'german',unit:'c'}, {type:'replacement',turn:1,side:'soviet',unit:'d'},{type:'replacement',turn:2,side:'german',unit:'e'}]},{kind:'replacement'})),['c'],'same actor and turn replacement only');
eq(ids(A.native({...base,over:true,moved:['a']},{kind:'move'})),[],'terminal clears');
const hs={cursor:{turn:1,complete:false},phaseKind:'combat',combat:{resolved:[]},usedUnitIds:[]};
eq(ids(A.historical(hs)),[],'not marked at declaration');
eq(ids(A.historical({...hs,combat:{resolved:[{battle:{attackers:['a','b'],defenders:['z']}}]}})),['a','b'],'resolved historical combat attackers, not defender');
eq(ids(A.historical({...hs,combat:{resolved:[{battle:{attackers:['a']}}]}},[{action:{type:'combat',action:{type:'resolve-battle'}}}])),['a'],'phase combat engine state authoritative');
eq(ids(A.historical({...hs,phaseKind:'movement',usedUnitIds:['a'],pendingGround:{unitId:'b'}})),['a'],'only resolved move, pending unit not marked');
eq(ids(A.historical({...hs,phaseKind:'movement',usedUnitIds:[]})),[],'new phase clears movement');
const buildup=[{action:{type:'finish-combat'}},{action:{type:'place-reinforcement',slotId:'s1'}},{action:{type:'apply-replacement',unitId:'b'}}];
eq(ids(A.historical({...hs,phaseKind:'buildup'},buildup,{s1:'a'})),['a','b'],'only completed buildup actions');
eq(ids(A.historical({...hs,phaseKind:'buildup'},[{action:{type:'apply-replacement',unitId:'a'}},{action:{type:'finish-buildup'}}],{s1:'a'})),[],'previous phase actions ignored');
eq(ids(A.historical({...hs,cursor:{turn:2,complete:true}})),[],'terminal no markers');
const unit={id:'source-counter',counter:{template:'army-2',colors:{primary:'#8ba195'}}};
const normal=C.piece(unit,0,0,'#8ba195');
const marked=C.piece(unit,0,0,'#8ba195',{activated:true});
yes(!normal.includes('counter-activation-badge'),'default art clean');
yes(marked.includes('data-phase-activated="true"'),'activated marker exists');
yes(marked.includes('pointer-events="none"'),'marker never intercepts counter click');
yes(marked.includes('cx="47" cy="4.5"'),'upper-right badge coordinates');
yes(marked.includes('stroke="#235a46"'),'badge contrast consistent');
yes(C.layer([{...unit,position:{x:0,y:0},strength:'full'}],()=>({x:55,y:55}),()=> '#8ba195',{activatedIds:['source-counter']}).includes('counter-activation-badge'),'shared counter layer propagates activation');
for(const page of ['games/battle-for-moscow/native-preview/index.html','games/arduous/native-preview/index.html','games/leningrad/native-preview/index.html','games/kiev/setup-preview/index.html']){
 const html=fs.readFileSync(page,'utf8');
 yes(html.includes('core/counter_phase_activation.js'),'shared activation module loaded '+page);
 yes(html.indexOf('core/counter_phase_activation.js')<html.indexOf(page.includes('battle-for-moscow')?'core/native_browser_view.js':'core/historical_browser_app.js'),'loaded before renderer '+page);
}
const native=fs.readFileSync('core/native_browser_view.js','utf8'),hist=fs.readFileSync('core/historical_browser_app.js','utf8');
yes(native.includes('Activation?.native(current(),phase())'),'native activation derived from engine state');
yes(hist.includes('Activation?.historical(snapshot,journal,slotFaces)'),'historical derived from authoritative snapshot+journal');
console.log('PASS v491 counter phase activation',checks,'assertions');
