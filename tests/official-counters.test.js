#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p));
const C=require('../core/counter_visuals'),template=require('../core/official_counter_templates'),E=require('../core/engine');
const manifest=JSON.parse(read('assets/official-counters/source-manifest.json'));
assert.equal(crypto.createHash('sha256').update(read('assets/official-counters/source-counters.svg')).digest('hex'),manifest.source_sha256,'Original SVG does not match manifest');
assert.deepEqual(Object.keys(template),['army-2','army-3','stuka','air','fleet']);
assert(C.KINDS.length===5&&C.NATO.length===8);
const type=manifest.typography;
assert.equal(type.profile,'counter-portable-sans-v1');
assert.equal(type.narrow_scale_x,0.78);
for(const kind of C.KINDS){
 const xml=template[kind];
 assert(!xml.includes('Arial Narrow'),'Nonportable Arial Narrow remains in live template: '+kind);
 assert(!xml.includes('-inkscape-font-specification'),'Inkscape-only font lock remains: '+kind);
 assert(xml.includes('data-counter-typography="heavy"'),'Missing heavy combat font: '+kind);
 assert(xml.includes('font-weight:900'),'Heavy combat font weight lost: '+kind);
 assert(xml.includes('sans-serif'),'Fallback sans-serif missing: '+kind);
}
for(const kind of ['army-2','army-3','fleet']){
 assert(template[kind].includes('scale(0.7800000,1)'),'Narrow text is not horizontally condensed: '+kind);
}

for(const k of C.KINDS){assert(template[k].length>2000,`Source vector geometry missing: ${k}`);assert(!template[k].includes('data:image/'),`Raster reference leaked into ${k}`);}
const two={id:'test-two',type:'infantry',army:'blue',strength:'full',position:{x:0,y:0},combatFull:10,combatReduced:5,movement:4,counter:{template:'army-2',nato:'infantry',colors:{primary:'#eee6ce',secondary:'#d2ae77',digits:{offense:'black',defense:'white'}}}};
const full=C.piece(two),damaged=C.piece({...two,strength:'reduced'});
for(const [xml,strength,attack] of [[full,'false','10'],[damaged,'true','5']]){
 assert(xml.includes(`data-damaged="${strength}"`));
 assert(xml.includes(`>${attack}</tspan>`));
 assert(xml.includes('>4</tspan>'));
 assert(xml.includes('fill:#eee6ce')&&xml.includes('fill:#d2ae77'));
 assert(xml.includes('fill:black')&&xml.includes('fill:white'));
 assert(/<tspan[^>]*style="[^"]*fill:white/.test(xml),'Digit tspan must respect configured white color');
 assert.equal(([...xml.matchAll(/<g[^>]*data-nato="[^"]+"[^>]*>/g)].filter(a=>a[0].includes('display:inline'))).length,1,'Exactly one NATO symbol must render');
 assert(!xml.includes('@@'));
}
const roleTag=(xml,role)=>[...xml.matchAll(/<(?:path|g|rect)[^>]*>/g)].map(m=>m[0]).find(t=>t.includes(`data-role="${role}"`))||'';
assert(roleTag(full,'status_reduced').includes('display:none'));
assert(roleTag(damaged,'status_reduced').includes('display:inline'));
const three={...two,id:'three',type:'mechanized',counter:{template:'army-3',faces:{full:{digits:[2,5,3]},damaged:{digits:[1,3,2]}},nato:'mechanized'}};
for(const [u,ds] of [[three,[2,5,3]],[{...three,strength:'reduced'},[1,3,2]]]){
 const html=C.piece(u);assert.equal((html.match(/data-nato="mechanized"/g)||[]).length,1);
 for(let k=0;k<3;k++)assert(html.includes('>'+ds[k]+'</tspan>'));
}
for(const nato of C.NATO){const h=C.piece({...three,counter:{template:'army-3',nato}},0,0);
 assert(h.includes(`data-nato-active="${nato}"`));
 assert.equal([...h.matchAll(/<g[^>]*data-nato="[^"]+"[^>]*>/g)].filter(a=>a[0].includes('display:inline')).length,1,nato+' must be unique');
}
for(const k of ['stuka','air','fleet']){
 const unit={id:k,combatFull:5,combatReduced:3,strength:'full',counter:{template:k,faces:{full:{value:5},damaged:{value:3}}}};
 const f=C.piece(unit),r=C.piece({...unit,strength:'reduced'});
 if(k==='fleet'){assert(f.includes('>5</tspan>')&&r.includes('>DAMAGED</tspan>'),k+' damaged legend');}
 else assert(f.includes('>5</tspan>')&&r.includes('>3</tspan>'),k+' strengths');
 assert(roleTag(f,'status_reduced').includes('display:none'));assert(roleTag(r,'status_reduced').includes('display:inline'));
 if(k==='fleet'){assert(roleTag(f,'status_damaged').includes('display:none'));assert(roleTag(r,'status_damaged').includes('display:inline'));assert(roleTag(f,'status_undamaged').includes('display:inline'));assert(roleTag(r,'status_undamaged').includes('display:none'));}
}
const removed=C.layer([{...two,strength:'dead'}],()=>({x:50,y:50}),()=>('#eee6ce'));
assert(!removed.includes('data-unit-id="test-two"'),'Eliminated unit still drawn');
const grouped=C.layer([two,{...three,position:{x:0,y:0}}],()=>({x:50,y:50}),()=>('#eee6ce'));
assert.equal((grouped.match(/data-unit-id=/g)||[]).length,2);
assert(grouped.includes('data-stack-top="true"')&&grouped.includes('data-stack-top="false"'));
const gameName='eastern-corridor',json=s=>JSON.parse(read(`games/${gameName}/${s}.json`));
const p={game:json('game'),map:json('map'),units:json('units'),rules:json('rules'),objectives:json('objectives'),deployments:json('deployments')};
assert.equal(E.validatePackage(p).ok,true);
p.units.units.find(u=>u.id==='r1').stepLoss='remove';
assert.equal(E.validatePackage(p).ok,true);
const g=E.build(p),s=E.start(g,1);s.units.find(u=>u.id==='b1').position={x:2,y:2};s.units.find(u=>u.id==='r1').position={x:3,y:2};
assert(E.endPhase(g,s));assert.equal(E.combatPreview(g,s,['b1'],'r1',6).outcome,'EX');
const record=E.combat(g,s,['b1'],'r1',6);assert.equal(record.result,'EX');
const r1=s.units.find(u=>u.id==='r1'),b1=s.units.find(u=>u.id==='b1');
assert.equal(r1.strength,'dead','One-step defender did not disappear on its first loss');assert.equal(r1.position,null);
assert.equal(b1.strength,'reduced','Default two-step attacker did not reduce');
assert.equal(s.stepsLost.red,1);assert.equal(s.stepsLost.blue,1);
assert(!C.layer([r1],()=>({x:50,y:50}),()=>('#ccc')).includes('data-unit-id="r1"'));
assert(C.piece(b1).includes('data-damaged="true"'));
// Contradictory one-step data fail during package validation instead of silently drawing a face.
p.units.units.find(u=>u.id==='r1').strength='reduced';assert.throws(()=>E.validatePackage(p),/cannot start reduced/);
p.units.units.find(u=>u.id==='r1').strength='full';p.units.units.find(u=>u.id==='r1').stepLoss='arbitrary';assert.throws(()=>E.validatePackage(p),/Unsupported stepLoss/);
console.log('Official counter source hash, 5 designs, 8 NATO glyphs, numeral faces, colors, damage visibility, stacking, one-hit removal and combat transitions passed.');
