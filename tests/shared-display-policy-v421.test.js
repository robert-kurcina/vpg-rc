'use strict';
const assert=require('node:assert/strict');
const D=require('../core/game_display_settings.js');
const T=require('../core/counter_visuals.js');
const fs=require('node:fs');
const path=require('node:path');
assert.deepEqual(D.normalize(),{largerCounters:false,showCoast:true,coastWavelets:true,terrainTooltips:true});
assert.deepEqual(D.normalize({largerCounters:1,showCoast:'false',coastWavelets:false}),
 {largerCounters:false,showCoast:true,coastWavelets:false,terrainTooltips:true});
assert.equal(D.counterScale({largerCounters:false}),1);
assert.equal(D.counterScale({largerCounters:true}),1.25);
const root=path.resolve(__dirname,'..');
for(const id of ['battle-for-moscow','arduous','leningrad']){
 const board=require('../maps/'+id+'.json');
 const expected=id==='leningrad';
 assert.equal(D.coastSupported(board),expected,`Coast existence: ${id}`);
 const base=T.sizeForMap(board),enlarged=base*D.counterScale({largerCounters:true});
 assert(enlarged<board.geometry?.calibration?.pitchY*0.9||id==='battle-for-moscow',`Oversized board counter: ${id}`);
 const exported=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 assert(exported.includes('data-layer="city-labels"')&&exported.includes('data-layer="terrain"'));
}
assert.equal(D.coastSupported({sourceWaterRoutes:[{kind:'coast'}]}),true);
assert.equal(D.coastSupported({authoredShoreHexsides:[{kind:'coast'}]}),true);
assert.equal(D.coastSupported({cells:[{tileEdges:{NE:[{kind:'coast'}]}}]}),true);
assert.equal(D.coastSupported({sourceWaterRoutes:[{kind:'lake'}]}),false);
console.log('PASS shared Settings defaults, Coast detection and 125% geometry');
