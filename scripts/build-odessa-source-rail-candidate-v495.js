'use strict';
/* Deterministic source trace evidence. NEVER updates movement authorization. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),rel=f=>path.join(root,f),buf=f=>fs.readFileSync(rel(f));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const base=require('../maps/kiev.json'),extension=require('../maps/odessa-extension.json');
const board=require('../maps/composer').compose(base,extension);
const trace=require('../core/composite_source_rail_audit').trace(board);
const sourcePaths=['maps/kiev.json','maps/odessa-extension.json','maps/source/user-svg/kiev-odessa-main.svg'];
const evidence={schemaVersion:1,id:'odessa-source-railway-path-trace-v495',status:'read-only-not-authorized-for-gameplay',
 sources:Object.fromEntries(sourcePaths.map(f=>[f,{sha256:sha(buf(f)),bytes:buf(f).length}])),...trace};
const out=rel('rules/audit/odessa-source-railway-trace-v495.json');
fs.writeFileSync(out,JSON.stringify(evidence,null,2)+'\n');
console.log('WROTE',out,JSON.stringify(trace.metadata));
