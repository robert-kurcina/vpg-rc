'use strict';
/* Odessa §9.4.3 cavalry, source typed and opt-in; NO live Odessa authorization. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const C=require('../maps/composer'),A=require('../core/composite_land_movement_candidate');
const M=require('../core/movement_rules'),L=require('../core/legal_pathfinding'),G=require('../core/map_movement_graph');
const base=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const rail=require('../maps/movement-configs/odessa-source-route-rail-ledger-v496.json');
const cities=require('../maps/victory-configs/odessa-source-city-ledger-v497.json');
const cavalry=require('../maps/movement-configs/kiev-odessa-cavalry-candidate-v498.json');
const kiev=require('../maps/movement-configs/kiev.json');
const sheet=require('../maps/counter-configs/odessa-extension.json');
const copy=x=>JSON.parse(JSON.stringify(x));
let checks=0;
const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);checks++};
const ok=(v,msg)=>{assert.ok(v,msg);checks++};
const throws=(f,re,msg)=>{assert.throws(f,re,msg);checks++};
const sha=d=>crypto.createHash('sha256').update(d).digest('hex');
const pdf='references/rules/odessa-rules.pdf';
eq(sha(fs.readFileSync(pdf)),sheet.rulesPDF.sha256||sheet.faceSource?.rulesPDF?.sha256||'c7def97fe2de9ae66dc89da5f7d3417e3283846485903b90b88f153ba9791bab','source rulebook unchanged');
for(const [side,file] of Object.entries(sheet.faceSource)){
 eq(sha(fs.readFileSync(file.file)),file.sha256,side+' photographed source sheet unchanged');
}
for(const [key,owner,notation] of [
 ['soviet-cavalry-corps-a','soviet','2-4'],
 ['soviet-cavalry-corps-b','soviet','2-4'],
 ['romanian-cavalry-corps','romanian','3-4']]){
 const face=sheet.faces.back.find(f=>f.role==='single-sided-cavalry-printed-face'&&f.sourceIdentityKey===key);
 ok(face,'cavalry face '+key);
 eq(face.visualTranscription.kind,'cavalry',key+' author-registered class');
 eq(face.visualTranscription.printedAffiliation,owner,key+' printed affiliation');
 ok(face.visualTranscription.visibleNotation.includes(notation),key+' printed allowance');
 ok(face.sourceCitation?.section?.includes('9.4.3'),key+' source rule citation');
}
eq(M.validProfile(kiev),true,'original Kiev profile valid and remains unchanged');
eq(M.validProfile(cavalry),true,'Odessa candidate profile valid');
eq(cavalry.executableStatus,'source-reviewed-diagnostic-not-authorized','candidate not live');
eq(cavalry.halfSpecialMovementClasses,{german:['cavalry'],soviet:['cavalry']},'half-allowance classes explicit');
eq(cavalry.specialMoveFromEZOCClasses,{german:['cavalry'],soviet:['cavalry']},'start-EZOC exception explicit');
for(const owner of ['german','soviet']){
 const modified=copy(cavalry);modified.halfSpecialMovementClasses[owner].push('cavalry');
 eq(M.validProfile(modified),false,'reject duplicate half-special class '+owner);
 const mismatch=copy(cavalry);mismatch.specialMoveFromEZOCClasses[owner].push('motorized');
 eq(M.validProfile(mismatch),false,'reject ungranted start-EZOC exception '+owner);
 const overlap=copy(cavalry);overlap.fullSpecialMovementClasses[owner].push('cavalry');
 eq(M.validProfile(overlap),false,'reject incompatible full/half allowance '+owner);
}
const composed=C.compose(base,ext);
const board=A.build(base,ext,composed,rail,cities).board;
eq(board.metadata.hexes,261,'real combined 261-hex board');
eq(board.metadata.impassableSeaOrCoast,100,'all Sea/Coast restrictions retained');
throws(()=>G.build(composed),/source-geometry-not-gameplay-certified/,'production movement gate remains closed');
const unit=(owner,hex='1106',mp=4,klass='cavalry')=>({id:'cav',owner,nationality:owner==='german'?'romanian':'soviet',class:klass,size:'corps',hex,mp});
const ctx=(owner,kind='special-movement',u=unit(owner),enemies=[])=>({board,profile:cavalry,
 phase:{owner,kind},turn:2,units:Object.fromEntries([u,...enemies].map(x=>[x.id,x]))});
for(const owner of ['german','soviet']){
 let context=ctx(owner),u=context.units.cav;
 const two=M.move(context,{unitId:u.id,path:['1106','1206','1107']});
 ok(two.ok,owner+' cavalry 2 MP special move legal');eq(two.cost,2,owner+' two cost');eq(two.remaining,0,owner+' half movement consumed');
 const one=M.move(context,{unitId:u.id,path:['1106','1107']});
 ok(one.ok,owner+' direct ground shortcut legal');eq(one.cost,1,owner+' direct shortcut cheaper');
 eq(M.move(context,{unitId:u.id,path:['1106','1206','1107','1108']}).reason,'insufficient-movement-points',owner+' third MP disallowed special');
 eq(M.move(ctx(owner,'special-movement',unit(owner,'1106',3)),{unitId:'cav',path:['1106','1206','1107']}).reason,'insufficient-movement-points',owner+' odd allowance rounds down');
 ok(M.move(ctx(owner,'movement'),{unitId:'cav',path:['1106','1206','1107','1108']}).ok,owner+' normal movement uses full allowance');
 eq(M.move(context,{unitId:'cav',path:['1106','1206','1107'],mode:'rail'}).reason,'rail-ineligible',owner+' cavalry cannot masquerade as Soviet rail-mode infantry');
 const enemyOwner=owner==='german'?'soviet':'german';
 const enemy={id:'enemy',hex:'1006',owner:enemyOwner,class:'infantry',mp:4,size:'corps'};
 ok(M.enemyZOC(ctx(owner,'special-movement',u,[enemy]),'1106',owner),owner+' enemy ZOC at origin');
 ok(M.move(ctx(owner,'special-movement',u,[enemy]),{unitId:'cav',path:['1106','1206']}).ok,owner+' cavalry can begin Special Movement in EZOC');
 eq(M.move(ctx(owner,'special-movement',unit(owner,'1106',4,'infantry'),[enemy]),{unitId:'cav',path:['1106','1206']}).reason,'special-ineligible',owner+' ordinary infantry still blocked in initial EZOC');
 eq(M.move({...ctx(owner,'special-movement',u,[enemy]),profile:kiev},{unitId:'cav',path:['1106','1206']}).reason,'special-ineligible',owner+' no cavalry exception leaks to Kiev');
 const zocTarget={...enemy,hex:'1007'};
 ok(M.move(ctx(owner,'special-movement',u,[zocTarget]),{unitId:'cav',path:['1106','1107']}).ok,owner+' cavalry can enter EZOC as final hex');
 eq(M.move(ctx(owner,'movement',u,[zocTarget]),{unitId:'cav',path:['1106','1107','1108']}).reason,'ezoc-stops-movement',owner+' cannot pass through newly entered EZOC');
 const routes=L.search(ctx(owner),{unitId:'cav',maxDepth:4,maxStates:20000});
 eq(routes.costTo('1107'),1,owner+' legal-action route finder selects shortest cost');
 const railRoute=L.search(ctx(owner),{unitId:'cav',mode:'rail',maxDepth:4,maxStates:20000});
 eq(railRoute.costTo('1107'),Infinity,owner+' no illicit cavalry rail-only paths');
}
// Remain fully bound to the source Sea/Coast geometry for cavalry as for infantry.
const landCoast=board.edges.filter(e=>e.lake&&!e.allSea);
eq(landCoast.length,7,'seven explicitly authored land-land Coast barriers');
for(const e of landCoast){
 const context=ctx('soviet','movement',unit('soviet',e.a));
 eq(M.move(context,{unitId:'cav',path:[e.a,e.b]}).reason,'impassable-hexside','cavalry Coast barrier '+e.a+':'+e.b);
}
const sea=board.edges.filter(e=>e.allSea);
eq(sea.length,93,'Sea-adjacent barriers');
for(const e of sea)ok(e.impassable,'source Sea crossing remains blocked '+e.a+':'+e.b);
// Attempted expansion must not silently authorize Home Army movement or country annexation.
const home=unit('german','1106',4,'romanian-home-army');
eq(M.move(ctx('german','special-movement',home),{unitId:'cav',path:['1106','1107']}).reason,'special-ineligible','Home Army not treated as cavalry');
const result={version:'v498',checkpoint:264,status:'source-reviewed-diagnostic-not-live',rule:'odessa-rules.pdf §9.4.3',
 mapHexes:261,seaCoastBarriers:100,cavalryCountries:['soviet','romanian'],
 candidateOnly:true,unresolved:cavalry.unresolvedOdessaRules,checks};
if(process.env.WRITE_AUDIT==='1')fs.writeFileSync('rules/audit/odessa-cavalry-special-movement-v498.json',JSON.stringify(result,null,2)+'\n');
console.log('PASS Odessa opt-in cavalry §9.4.3 v498',checks,'assertions');
