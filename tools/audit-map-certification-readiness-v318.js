#!/usr/bin/env node
'use strict';
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const root=path.resolve(__dirname,'..');process.chdir(root);
const inspect=require('../core/map_certification_readiness').inspect;
const extraction=JSON.parse(fs.readFileSync('rules/audit/arduous-kiev-svg-first-rail-graph-v318.json'));
const maps={};for(const name of ['arduous','kiev']){
 const raw=fs.readFileSync(`maps/${name}.json`),map=JSON.parse(raw),e=extraction.maps[name];
 if(!e||e.sourceMapSha256!==crypto.createHash('sha256').update(raw).digest('hex'))throw Error('stale-svg-extraction:'+name);
 const report=inspect(map,e);maps[name]=report;
 console.log(name,JSON.stringify(report.coverage));
}
const out={schemaVersion:1,semantics:'diagnostic-only',maps};
if(process.argv.includes('--write')){const file='rules/audit/arduous-kiev-certification-readiness-v318.json';fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');console.log('wrote',file);}
