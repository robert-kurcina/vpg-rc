const fs=require('fs'),assert=require('assert');
const T=require('../core/terrain_tiles');
for (const id of ['arduous','leningrad']) {
 const board=JSON.parse(fs.readFileSync('maps/'+id+'.json','utf8'));
 const svg=fs.readFileSync('exports-v299/'+id+'.svg','utf8');
 assert.equal(board.railwayPresentation.geometry,'center-face-center');
 assert(svg.includes('data-rail-geometry="hex-face-midpoint"'));
 const byId=new Map(board.cells.map(c=>[c.id,c]));
 const rxry=T.gridRadii(board.geometry);
 const p=x=>x.map(v=>Number(v).toFixed(2)).join(',');
 let n=0;
 for(const e of board.hexCenterRailConnections){
  const a=byId.get(e.from),b=byId.get(e.to);
  const dir=T.DIRS.find(d=>T.neighbor(a,d,board.geometry)===b.id);
  assert(dir,`nonadjacent link ${e.from}/${e.to}`);
  const start=T.coord(a,board.geometry),end=T.coord(b,board.geometry);
  // Common face midpoint of adjacent regular calibrated hexes is the midpoint
  // of their center-to-center line. Exact midpoint equality is verified via
  // SVG geometry, rounded to rendering precision.
  const mid=[(start[0]+end[0])/2,(start[1]+end[1])/2];
  const re=new RegExp(`<path d="M([\\d.-]+),([\\d.-]+) L([\\d.-]+),([\\d.-]+) L([\\d.-]+),([\\d.-]+)"[^>]*class="grid-face-rail" data-rail-from="${e.from}" data-rail-to="${e.to}"`);
  const match=svg.match(re);
  assert(match,`${id} link ${e.from}/${e.to} lacks grid-face geometry`);
  const actual=match.slice(1).map(Number);
  const expected=[...start,...mid,...end];
  expected.forEach((v,i)=>assert(Math.abs(v-actual[i])<.02,`${id} link ${e.from}/${e.to} coordinate ${i}: ${actual[i]} vs ${v}`));
  n++;
 }
 assert.equal((svg.match(/class="grid-face-rail"/g)||[]).length,board.hexCenterRailConnections.length+board.railwayBoundaryExits.length);
 assert.equal((svg.match(/class="authored-center-rail"/g)||[]).length,0);
 console.log(`PASS ${id}: ${n} exact center/face/center connections, ${board.railwayBoundaryExits.length} exits`);
}
