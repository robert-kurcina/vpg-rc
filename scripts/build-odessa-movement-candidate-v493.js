'use strict';
/* Reproducible read-only source-topology candidate; does NOT authorize Odessa play. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const P=(p)=>path.join(root,p),read=(p)=>fs.readFileSync(P(p));
const sha=(data)=>crypto.createHash('sha256').update(data).digest('hex');
const base=require('../maps/kiev.json'),extension=require('../maps/odessa-extension.json');
const T=require('../core/terrain_tiles'),C=require('../maps/composer'),A=require('../core/composite_graph_audit');
const composite=C.compose(base,extension),result=A.movementCandidate(base,extension,composite);
const cellById=new Map(composite.cells.map(c=>[c.id,c]));
const shore=[];
for(const h of composite.authoredShoreHexsides){
 const first=cellById.get(h.cellId),second=cellById.get(T.neighbor(first,h.dir,composite.geometry));
 const kind=!second?'outside':first.terrain==='sea'||second.terrain==='sea'?'land-sea':'land-land';
 const x=second?(first.pixelCenter[0]+second.pixelCenter[0])/2:first.pixelCenter[0];
 const y=second?(first.pixelCenter[1]+second.pixelCenter[1])/2:first.pixelCenter[1];
 shore.push({hex:h.cellId,side:h.dir,neighbor:second?.id||null,kind,sourceSvgId:h.sourceSvgId||null,impassableForGround:true,x,y});
}
shore.sort((a,b)=>a.hex.localeCompare(b.hex)||a.side.localeCompare(b.side));
const markers=result.edges.filter(e=>e.compositeSeam).map(e=>{
 const a=cellById.get(e.a),b=cellById.get(e.b);
 return {kind:'seam',a:e.a,b:e.b,x:(a.pixelCenter[0]+b.pixelCenter[0])/2,y:(a.pixelCenter[1]+b.pixelCenter[1])/2};
});
for(const h of shore.filter(x=>x.kind==='land-land'))markers.push({kind:'shore-land-land',a:h.hex,b:h.neighbor,x:h.x,y:h.y});
const files=['maps/kiev.json','maps/odessa-extension.json','maps/source/user-svg/kiev-odessa-main.svg',
 'references/rules/odessa-rules.pdf','maps/roster-overlays/kiev-odessa.json','exports/kiev-odessa.png'];
const audit={schemaVersion:1,id:'odessa-composite-topology-v493-corrected-coast-barrier-v494',status:'read-only-not-authorized-for-gameplay',
 sources:Object.fromEntries(files.map(f=>[f,{sha256:sha(read(f)),bytes:read(f).length}])),
 metadata:result.metadata,edges:result.edges,shore,markers};
const output=P('rules/audit/odessa-composite-movement-candidate-v493.json');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(audit,null,2)+'\n');
console.log('WROTE',output,JSON.stringify(result.metadata));
