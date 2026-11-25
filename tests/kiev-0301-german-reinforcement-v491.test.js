'use strict';
/* User-corrected, presentation-only Kiev 0301 German perimeter at north and northeast. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const C=require('../maps/composer');
const b=require('../maps/kiev.json');
const ext=require('../maps/odessa-extension.json');
let checks=0;const yes=(x,msg)=>{assert.ok(x,msg);checks++};
const equal=(x,y,msg)=>{assert.deepEqual(x,y,msg);checks++};
const id='0301',directions=['N','NE','NW'];
const cell=b.cells.find(c=>c.id===id);
yes(cell,'Kiev 0301 exists');
for(const d of directions)equal(cell.entryEdgeTags[d],'german','source cell border '+d);
const route=b.entryBoundarySelections.paths.find(p=>p.side==='german'&&p.edges.some(e=>e.cellId===id));
yes(route,'German entry line exists');
equal(route.edges.slice(0,3).map(e=>[e.cellId,e.dir,e.reverse]),[['0301','NE',true],['0301','N',true],['0301','NW',true]],'continuous perimeter from northeast to northwest');
equal(b.entryBoundarySelections.userCorrections[0].addedDirs,['N','NE'],'user approval recorded without changing historical source SVG');
const [rx,ry]=T.gridRadii(b.geometry);
const segs=T.gridSegmentData(b,rx,ry);
for(const dir of directions){const s=segs.find(s=>s.cellId===id&&s.dir===dir);yes(s&&!s.neighborId,'user border is exterior '+dir);}
for(let i=1;i<4;i++){
 const a=segs.find(s=>s.cellId===route.edges[i-1].cellId&&s.dir===route.edges[i-1].dir);
 const c=segs.find(s=>s.cellId===route.edges[i].cellId&&s.dir===route.edges[i].dir);
 const end=route.edges[i-1].reverse?a.a:a.b,start=route.edges[i].reverse?c.b:c.a;
 yes(Math.hypot(end[0]-start[0],end[1]-start[1])<.2,'continuous edge join '+(i-1)+'->'+i);
}
equal(T.validate(b,{requireReciprocal:false}).errors,[],'Kiev remains valid');
const svg=fs.readFileSync('exports/kiev.svg','utf8');
yes(svg.includes('data-layer="entry-edges"'),'actual map export includes universal reinforcement layer');
yes(svg.includes('entry-german'),'German line uses standard universal style');
yes(svg.includes('data-border-segments="41"'),'German path contains 2 additional contiguous exterior sides');
const composite=C.compose(b,ext);
const actual=composite.compositeEntryEdges.filter(e=>e.cellId===id&&e.side==='german').map(e=>e.dir).sort();
equal(actual,directions.slice().sort(),'composite already has N, NE, NW without duplication');
yes(fs.readFileSync('exports/kiev-odessa.svg','utf8').includes('entry-german'),'composite still renders entry border');
for(const game of ['battle-for-moscow','arduous','leningrad'])yes(fs.existsSync('exports/'+game+'.svg'),'non-Kiev exports retained');
console.log('PASS Kiev 0301 German reinforcement visual border',checks,'assertions');
