/* The shared support map projects only already-legal commands onto hex targets. */
const assert=require('node:assert/strict');
const M=require('../core/historical_support_target_map_ux');
let checks=0;
const same=(a,b,n)=>{assert.deepEqual(a,b,n);checks++};
const yes=(v,n)=>{assert.ok(v,n);checks++};
const combat=(kind,faceId)=>({type:'combat',action:{type:kind,faceId}});
const a1=combat('commit-ground-air','AX'),a2=combat('commit-ground-air','AY'),
 naval=combat('declare-fleet-attack','AX'),none=combat('commit-ground-air',null),
 f1={type:'declare-fleet-move',to:'1410'},f2={type:'declare-fleet-move',to:'1609'},
 forced={type:'commit-forced-port',to:'1510'};
const commands=[a1,a2,naval,none,f1,f2,forced,{type:'resolve-battle',die:1}];
let m=M.model({selection:{kind:'air',id:'AX'},commands,battleHex:'0208',fleetHex:'1410'});
same(m.hexes,['0208','1410'],'ground and naval use separate legal hexes');
same(M.choicesAt(m,'0208')[0].action,a1,'ground exact legal action');
same(M.choicesAt(m,'1410')[0].action,naval,'naval exact legal action');
same(M.choicesAt(m,'1609'),[],'no fabricated air range');
let other=M.model({selection:{kind:'air',id:'AY'},commands,battleHex:'0208',fleetHex:'1410'});
same(other.hexes,['0208'],'other marker cannot use AX naval attack');
same(M.choicesAt(other,'0208')[0].action,a2,'face ID exact');
let waiting=M.model({selection:{kind:'air',id:'AX'},commands,battleHex:null,fleetHex:null});
same(waiting.hexes,[],'not-yet-declared battle does not become legal deployment');
let fleet=M.model({selection:{kind:'fleet',id:'balticFleet'},commands});
same(fleet.hexes,['1410','1510','1609'],'fleet destinations only');
same(M.choicesAt(fleet,'1510')[0].action,forced,'forced port action retained');
let blank=M.model({selection:{kind:'fleet',id:'balticFleet'},commands:[]});
same(blank.hexes,[],'no false future fleet ports');
let absent=M.model({commands});yes(!absent.active,'inactive without counter');
same(M.choicesAt(m,'9999'),[],'ineligible target cannot stage');
assert.throws(()=>M.model({selection:{kind:'unknown',id:'AX'},commands}),/Unsupported/);checks++;
assert.throws(()=>M.model({selection:{kind:'air',id:'AX'},commands:{}}),/authoritative/);checks++;
// Reference-preserving exact action semantics, no metadata substituted into commands.
yes(M.choicesAt(m,'0208')[0].action===a1,'projection preserves the source action object');
console.log('PASS historical Support Target Map:',checks,'checks');
