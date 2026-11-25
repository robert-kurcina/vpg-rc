const fs=require('fs'),assert=require('assert');
const T=require('../core/terrain_tiles'), P=require('../core/presentation');
const registry=JSON.parse(fs.readFileSync('maps/registry.json','utf8'));
const C=require('../maps/composer');
const boards={};
for(const i of registry.maps){if(i.file)boards[i.id]=JSON.parse(fs.readFileSync('maps/'+i.file,'utf8'));}
for(const i of registry.maps){if(i.compose)boards[i.id]=C.compose(boards[i.compose.base],JSON.parse(fs.readFileSync('maps/'+i.compose.extension,'utf8')));}
for(const item of registry.maps){
 const svg=fs.readFileSync(`exports-v304/${item.id}.svg`,'utf8');
 const board=boards[item.id];
 assert(svg.includes('class="shoreline-reinforcement-masked"'),`${item.id} lacks reinforcement mask`);
 assert(!svg.includes('class="forest-shadow-layer"'),`${item.id} still has removed forest shadow`);
 assert(svg.includes('-dry-coast-mask'),`${item.id} missing dry-coast mask`);
 for(const c of board.cells.filter(c=>c.terrain==='sea')){
  assert(!svg.includes(`data-number-cell="${c.id}"`),`${item.id} shows sea number ${c.id}`);
 }
 const actual=(svg.match(/class="reinforcement-water-knockout"/g)||[]).length;
 const boundaries=(svg.match(/class="entry-boundary entry-/g)||[]).length;
 assert.equal(actual,boundaries,`${item.id} coast knockout does not cover every visible reinforcement line`);
 assert(svg.includes('mask="url(#hex-clip-export-'+item.id+'-dry-coast-mask)"'),`${item.id} overlays lack dry-coast mask`);
 console.log(`PASS ${item.id}: ${board.cells.length} hexes, ${actual} reinforcement knockouts`);
}
