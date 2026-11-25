#!/usr/bin/env node
/* Reproducible candidate-to-user-SVG provenance audit. Run from any directory. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const audit=require('../core/source_edge_evidence');
const sources={arduous:'arduous-map-temp(3).svg',kiev:'kiev-odessa-main.svg'};
const maps={};
for(const [name,svgName] of Object.entries(sources)){
 const svgPath=path.join(root,'maps/source/user-svg',svgName);
 const data=fs.readFileSync(svgPath,'utf8');
 const ids=new Set([...data.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));
 const map=JSON.parse(fs.readFileSync(path.join(root,'maps',name+'.json'),'utf8'));
 const record=audit.inspect(map,ids);
 if(record.missingSvgIds.length)throw Error(name+' references missing SVG elements');
 maps[name]={sourceSvg:'maps/source/user-svg/'+svgName,sourceSvgSHA256:crypto.createHash('sha256').update(data).digest('hex'),...record};
}
const result={schemaVersion:1,description:'Source-element traceability and hexside reciprocity diagnostic. Kiev uses definitive SVG; movement remains uncertified.',maps};
if(process.argv.includes('--write')){
 const dest=path.join(root,'rules/audit/arduous-kiev-svg-edge-trace-v427.json');
 fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
 console.log('Wrote '+path.relative(root,dest));
}else console.log(JSON.stringify(Object.fromEntries(Object.entries(maps).map(([n,m])=>[n,m.counts])),null,2));
module.exports=result;
