'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const Composer=require('../maps/composer'),T=require('../core/terrain_tiles');
const A=require('../core/composite_land_movement_candidate');
const G=require('../core/map_movement_graph'),P=require('../core/pathfinding'),M=require('../core/movement_rules');
const base=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const railway=require('../maps/movement-configs/odessa-source-route-rail-ledger-v496.json');
const cities=require('../maps/victory-configs/odessa-source-city-ledger-v497.json');
const composed=Composer.compose(base,ext),review=A.build(base,ext,composed,railway,cities);
const board=review.board,byId=new Map(composed.cells.map(c=>[c.id,c]));
let checks=0;const eq=(a,b,s)=>{assert.deepEqual(a,b,s);checks++;};
const ok=(x,s)=>{assert.ok(x,s);checks++;};const rejects=(f,p,s)=>{assert.throws(f,p,s);checks++;};
const clone=x=>JSON.parse(JSON.stringify(x));const key=(a,b)=>[a,b].sort().join(':');
eq(board.metadata.hexes,261,'all source hexes');eq(board.metadata.physicalEdges,714,'physical adjacency');
eq(board.metadata.impassableSeaOrCoast,100,'all impassable barriers');
eq(board.metadata.landCandidates,614,'614 potential land links');
eq(board.metadata.sourceRailEdges,117,'source traced rail');
eq(board.metadata.sourceOrdinaryRiverEdges,105,'ordinary river');
eq(board.metadata.sourceMajorRiverEdges,22,'major river');
eq(board.metadata.terrain,{sea:31,open:139,forest:53,swamp:18,city:18,majorCity:2},'explicit city overlay');
eq(board.cells['1016'].terrain,'city','Braila is City, not arbitrary Open');
eq(board.cells['1513'].terrain,'major-city','Odessa is Major City');
eq(board.cells['1404'].terrain,'major-city','Kiev is Major City');
eq(board.cells['1811'].terrain,'city','Nikolaev is City');
eq(board.cells['0701'].terrain,'swamp','Kiev swamp unaffected');
eq(board.metadata.noRulesAuthorization,true,'no gameplay authorization');
eq(review.sourceRailReconciliation.excludedAnnotations,['1106:1107','1106:1205'],'two shortcuts remain nonrail');
const observed=new Set();let rail=0,water=0,shore=0,river=0,major=0;
for(const edge of board.edges){
 const k=key(edge.a,edge.b);ok(!observed.has(k),'no duplicate physical connection '+k);observed.add(k);
 const a=byId.get(edge.a),b=byId.get(edge.b);
 ok(T.DIRS.some(dir=>T.neighbor(a,dir,composed.geometry)===b.id),'neighbors share a real hexside '+k);
 if(edge.rail){rail++;ok(!edge.impassable&&!edge.allSea&&!edge.lake,'rail cannot cross barrier '+k);}
 if(edge.river)river++;if(edge.majorRiver)major++;
 if(edge.impassable){water++;ok(edge.allSea||edge.lake,'only source Sea/Coast blocks '+k);}
 if(edge.lake&&!edge.allSea){shore++;ok(edge.impassable,'land-land Coast impassable '+k);}
}
eq(rail,117,'all rail candidates');eq(water,100,'100 barrier edges');eq(shore,7,'seven authored Coast land-land barriers');
eq(river,105,'ordinary river count');eq(major,22,'major river count');
const graph=P.compile(board),profile=require('../maps/movement-configs/kiev.json');
const ground=P.search(graph,{origin:'1106',edgeCost:x=>P.terrainCost(profile,x)});
eq(ground.pathTo('1107'),['1106','1107'],'direct ground shortcut into City');
eq(ground.costTo('1107'),1,'City costs 1 MP');
eq(ground.pathTo('1205'),['1106','1205'],'second direct shortcut');
const byRail=P.search(graph,{origin:'1106',edgeCost:x=>x.edge.rail?P.terrainCost(profile,x):Infinity});
eq(byRail.pathTo('1107'),['1106','1206','1107'],'source rail detour, never invented rail shortcut');
eq(byRail.costTo('1107'),2,'rail detour 2 MP');
const unit={id:'source-reviewed-soviet-infantry',hex:'1106',owner:'soviet',class:'infantry',mp:6,size:'corps'};
const ctx={board,units:{[unit.id]:unit},profile,phase:{owner:'soviet',kind:'special-movement'},turn:2};
eq(M.move(ctx,{unitId:unit.id,path:['1106','1107'],mode:'rail'}).reason,'rail-route-required','direct shortcut cannot claim rail mode');
ok(M.move(ctx,{unitId:unit.id,path:['1106','1206','1107'],mode:'rail'}).ok,'source rail detour legal in isolated empty test');
const seven=board.edges.filter(x=>x.lake&&!x.allSea);eq(seven.length,7,'seven Coast land-land cases');
for(const edge of seven){
 const u={...unit,hex:edge.a};const context={...ctx,phase:{owner:'soviet',kind:'movement'},units:{[u.id]:u}};
 eq(M.move(context,{unitId:u.id,path:[edge.a,edge.b]}).reason,'impassable-hexside','coast cannot be crossed '+edge.a+':'+edge.b);
}
const withSea=board.edges.filter(e=>e.allSea);eq(withSea.length,93,'all Sea-related connections accounted for');
for(const edge of withSea){
 ok(edge.impassable&&(!board.cells[edge.a].verified||!board.cells[edge.b].verified),'Sea is impassable '+key(edge.a,edge.b));
}
rejects(()=>G.build(composed),/source-geometry-not-gameplay-certified/,'production composite still blocked');
{const altered=clone(cities);altered.cities.find(c=>c.name==='Brăila').name='Balti';rejects(()=>A.build(base,ext,composed,railway,altered),/map-city-disagreement/,'wrong city name rejects candidate');}
{const altered=clone(railway);altered.links.pop();rejects(()=>A.build(base,ext,composed,altered,cities),/source-route-ledger-disagreement/,'missing railway rejects candidate');}
{const altered=clone(composed);altered.cells.find(x=>x.id==='1513').terrain='sea';rejects(()=>A.build(base,ext,altered,railway,cities),/source-route-ledger-disagreement|map-city-disagreement|rail-crosses-sea-or-coast/,'tampered port terrain rejects candidate');}
const report={checkpoint:263,version:'v497',status:'diagnostic-not-gameplay-authorized',counts:board.metadata,shortcuts:['1106:1107','1106:1205'],unresolved:['Odessa-specific movement and cavalry rules','Fleet/port resolution','full rule-driven victory isolation','historical setup and campaign acceptance'],checks};
if(process.env.WRITE_AUDIT==='1')fs.writeFileSync('rules/audit/odessa-source-land-city-graph-v497.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS Odessa source land/City graph v497',checks,'assertions');
