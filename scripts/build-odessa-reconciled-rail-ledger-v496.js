'use strict';
/* Regenerate a READ-ONLY railway link ledger from pinned source SVG routes. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(ROOT,p));
const sha=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const map=require('../maps/composer').compose(require('../maps/kiev.json'),require('../maps/odessa-extension.json'));
const source=require('../core/composite_source_rail_audit').trace(map);
const sources=['maps/kiev.json','maps/odessa-extension.json','maps/source/user-svg/kiev-odessa-main.svg'];
const ledger={schemaVersion:1,id:'odessa-source-route-rail-ledger-v496',mapId:map.id,
 status:'diagnostic-not-gameplay-authorized',hexCount:map.cells.length,
 railCount:source.tracedLinks.length,physicalEdgeCount:714,sourceHashes:Object.fromEntries(sources.map(p=>[p,sha(p)])),
 links:source.tracedLinks.map(({a,b,sourceSvgIds})=>({a,b,sourceSvgIds})),
 excludedAnnotations:source.annotationsWithoutTrace.map(({a,b})=>a+':'+b),
 policy:'Only drawn source-centerline rail sides count as railway. Other adjacent land sides retain ordinary ground passage unless blocked by Sea, Coast or other rules.'};
if(ledger.railCount!==117||ledger.excludedAnnotations.join(',')!=='1106:1107,1106:1205')
 throw Error('Unexpected source-trace count or exclusions; review before rebuilding');
const review=require('../core/composite_rail_reconciliation').reconcile(map,ledger);
if(review.railwayReconciliation.sourceOnlyConnections!==77)throw Error('Unexpected source-only rail count');
fs.writeFileSync(path.join(ROOT,'maps/movement-configs/odessa-source-route-rail-ledger-v496.json'),JSON.stringify(ledger,null,2)+'\n');
console.log('WROTE source-pinned diagnostic rail ledger',ledger.railCount,'links,',ledger.excludedAnnotations.length,'excluded annotations');
