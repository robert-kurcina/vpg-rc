'use strict';
const assert=require('node:assert/strict');
const B=require('../core/historical_buildup_map_ux');
let n=0;function eq(a,b,label){assert.deepEqual(a,b,label);n++}
function ok(a,label){assert.ok(a,label);n++}
const a={id:'a',hex:'0301',owner:'german',strengthStatus:'printed-reduced'};
const b={id:'b',hex:'0301',owner:'german',strengthStatus:'printed-reduced'};
const c={id:'c',hex:'0402',owner:'german',strengthStatus:'printed-full'};
const d={id:'d',hex:'0402',owner:'german',strengthStatus:'printed-reduced'};
const units={a,b,c,d};
const entry1={type:'place-reinforcement',slotId:'axis-turn3',hex:'0301'};
const entry2={type:'place-reinforcement',slotId:'axis-turn3',hex:'0201'};
const alt={type:'place-reinforcement',slotId:'axis-other',hex:'0302'};
const r1={type:'apply-replacement',unitId:'a',hex:null};
const r2={type:'apply-replacement',unitId:'b',hex:null};
const r3={type:'apply-replacement',unitId:'d',hex:null};
const rebuild={type:'apply-replacement',unitId:'eliminated',hex:'0803'};
const commands=[entry1,entry2,alt,r1,r2,r3,rebuild,{type:'finish-buildup'}];
for(const phase of ['movement','combat','housekeeping',null]){
 const x=B.model({phaseKind:phase,commands,units});eq(x.active,false,'no buildup highlight outside phase '+phase);eq(B.actionAtHex(x,'0301',[a,b]),null,'no action outside buildup '+phase);
}
let m=B.model({phaseKind:'buildup',commands,units});
eq(m.active,true,'active');eq(m.modes,['entry','repair','rebuild'],'all modes available');
eq(m.slotIds,['axis-turn3','axis-other'],'slot IDs');eq(m.entryHexes,['0301','0201'],'only first selected slot destinations');
eq(B.actionAtHex(m,'0301',[a,b]),entry1,'click entry uses only legal catalogue action');
eq(B.actionAtHex(m,'0302',[]),null,'other slot not clickable until selected');
m=B.model({phaseKind:'buildup',commands,units,mode:'entry',slotId:'axis-other'});
eq(m.entryHexes,['0302'],'selected alternate counter updates highlight');eq(B.actionAtHex(m,'0302',[]),alt,'alternate legal action picked');
m=B.model({phaseKind:'buildup',commands,units,mode:'repair'});
eq(m.repairHexes,['0301','0402'],'both reduced-unit hexes highlighted');
eq(B.actionAtHex(m,'0301',[a,b]),r2,'top of double reduced stack repairs by default');
eq(B.actionAtHex(m,'0301',B.orderedStack([a,b],'a')),r1,'reordering stack changes default repair target');
eq(B.actionAtHex(m,'0402',[c,d]),r3,'single eligible reduction selected even in a stacked hex');
eq(B.actionAtHex(m,'0402',[d,c]),r3,'single eligible bottom unit still repairable');
eq(B.actionAtHex(m,'1111',[a,b]),null,'unhighlighted hex not actionable');
eq(B.nextTop([a,b],null),'a','click top rotates to previous counter');
eq(B.nextTop([a,b],'a'),'b','repeated click rotates back');
eq(B.orderedStack([a,b],'a').map(x=>x.id),['b','a'],'sorted stack places selected top last');
ok(B.tooltip(m,'0301',[a,b]).includes('top counter'),'multi-stack tooltip describes top rule');
ok(B.tooltip(m,'0301',[a,b]).includes('Shift-click'),'tooltip includes stack flip gesture');
ok(B.tooltip(m,'0402',[c,d]).includes('One reduced counter'),'one eligible reduction no misleading double claim');
m=B.model({phaseKind:'buildup',commands,units,mode:'rebuild',reserveId:'eliminated'});
eq(m.rebuildHexes,['0803'],'rebuild location highlighted from exact legal actions');
eq(B.actionAtHex(m,'0803',[]),rebuild,'rebuild click preserves unitId');
const depleted=B.model({phaseKind:'buildup',commands:[{type:'finish-buildup'}],units,mode:'repair'});
eq(depleted.mode,null,'no legal replacements means no active map mode');
eq(depleted.repairHexes,[],'no stale repair glow when allowance spent');
eq(B.actionAtHex(depleted,'0301',[a,b]),null,'no action after allowance exhaustion');
// Stale/invalid snapshots fail closed; no fabricated target or guessed legality.
const claimed={type:'apply-replacement',unitId:'a',hex:null};
let bad=B.model({phaseKind:'buildup',commands:[claimed],units:{...units,a:{...a,strengthStatus:'printed-full'}}});
eq(bad.repairHexes,[],'stale full-strength unit does not highlight');
eq(bad.modes,[],'stale unit has no option');
for(const args of [{phaseKind:'buildup',commands:null,units},{phaseKind:'buildup',commands:[],units:[]}]){
 assert.throws(()=>B.model(args));n++;
}
console.log('PASS historical buildup map UX v491',n,'assertions');
