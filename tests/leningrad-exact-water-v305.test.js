const assert = require('node:assert/strict');
const fs=require('node:fs'), crypto=require('node:crypto');
const P=require('../core/presentation');
const map=JSON.parse(fs.readFileSync('maps/leningrad.json','utf8'));
const svg=fs.readFileSync('exports-v305/leningrad.svg','utf8');
const prior=fs.readFileSync('../hex_wargame_v304/exports-v304/leningrad.svg','utf8');
const source=fs.readFileSync('maps/source/user-svg/leningrad-main(1).svg');
const sha=crypto.createHash('sha256').update(source).digest('hex');
assert.equal(sha,map.authoredSourceVectors.sourceSvgSha256);
assert.equal(map.authoredSourceVectors.rivers.length,10);
assert.equal(map.v305RiverGeometryAudit.riverMajorPaths,0);
assert.equal(P.options('leningrad').authoredRiverMode,'source-exact-stroke');
assert.equal((svg.match(/data-river-render-mode="source-exact-stroke"/g)||[]).length,10);
assert.equal((svg.match(/class="svg-authored-river-ribbon /g)||[]).length,0);
assert.equal((svg.match(/data-display-smoothing="none"/g)||[]).length,10);
for(const item of map.authoredSourceVectors.rivers){
 const name=item.id.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
 assert(new RegExp('data-authored-path="'+name+'"[^>]+d="'+item.d.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')+'"').test(svg),item.id+' SVG path geometry modified');
}
for(const id of ['battle-for-moscow','arduous','kiev','kiev-odessa']){
 const before=fs.readFileSync('../hex_wargame_v304/exports-v304/'+id+'.svg');
 const after=fs.readFileSync('exports-v305/'+id+'.svg');
 assert(before.equals(after),id+' altered unexpectedly');
}
console.log('PASS v305: all 10 Leningrad river paths exact, no wave deformation, all four other maps unchanged');
