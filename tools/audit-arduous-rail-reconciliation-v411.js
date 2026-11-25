'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const R=require('../core/source_rail_reconciliation');
const root=path.resolve(__dirname,'..');
const raw=p=>fs.readFileSync(path.join(root,p));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function audit(){
 const mapRaw=raw('maps/arduous.json'),map=JSON.parse(mapRaw);
 const extraction=require('../rules/audit/arduous-kiev-svg-first-rail-graph-v318.json').maps.arduous;
 if(extraction.sourceMapSha256!==hash(mapRaw)||extraction.map!=='arduous')throw Error('historical rail extraction does not match exact current map');
 const svgRaw=raw('maps/source/user-svg/arduous-map-temp(3).svg');
 if(hash(svgRaw)!==map.authoredSourceVectors?.sourceSvgSha256)throw Error('historical source SVG checksum mismatch');
 const ids=new Set([...svgRaw.toString('utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 const excluded=map.v310UserRailDeploymentAudit?.removedRailLinks;
 const result=R.inspect({map,derived:extraction,svgIds:ids,excludedPairs:excluded});
 return {schemaVersion:1,checkpoint:177,sourceMapSha256:hash(mapRaw),sourceSvgSha256:hash(svgRaw),...result,
  sourceExclusions:'maps/arduous.json v310UserRailDeploymentAudit.removedRailLinks',
  remaining:['Terrain-base classification and 2 untranscribed source cells',
   'River/shore and source-grid registration still require gameplay reconciliation',
   'No source movement policy was promoted by this audit']};
}
if(require.main===module){const result=audit();if(process.argv.includes('--write'))fs.writeFileSync(path.join(root,'rules/audit/arduous-rail-reconciliation-v411.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.counts));}
module.exports={audit};
