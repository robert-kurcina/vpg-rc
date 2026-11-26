'use strict';
// Summarize V8 samples, not instrumented call counts. Inclusive time credits
// each frame once per stack (including recursive functions), self time credits
// the sampled leaf. Report GC and idle separately rather than attributing them
// to the game engine.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const [profileFile,baselineFile,profiledFile,baseSaveFile,profiledSaveFile]=process.argv.slice(2);
assert.ok(profiledSaveFile,'Usage: summarize-campaign-profile.js profile.cpuprofile baseline.json profiled.json baseline-save.json profiled-save.json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const profile=read(profileFile),baseline=read(baselineFile),profiled=read(profiledFile);
const before=read(baseSaveFile),after=read(profiledSaveFile);
assert.deepEqual(after,before,'Sampling changed authenticated campaign');
assert.deepEqual(profiled.terminal,baseline.terminal);
assert.equal(profiled.actions,baseline.actions);
assert.equal(profile.samples.length,profile.timeDeltas.length);
const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map();
for(const n of nodes.values())for(const child of n.children||[])parent.set(child,n.id);
function key(n){
 const f=n.callFrame;
 const url=f.url?f.url.replace(/^file:\/\//,''):'';
 const name=url.startsWith(process.cwd()+'/')?path.relative(process.cwd(),url):url;
 return [f.functionName||'(anonymous)',name,f.lineNumber+1].join(' | ');
}
const rows=new Map();
const row=k=>{if(!rows.has(k))rows.set(k,{frame:k,selfUs:0,inclusiveUs:0});return rows.get(k);};
let totalUs=0;
for(let i=0;i<profile.samples.length;i++){
 const us=profile.timeDeltas[i],leaf=profile.samples[i];assert.ok(Number.isFinite(us)&&us>=0);totalUs+=us;
 let id=leaf;const seen=new Set();
 row(key(nodes.get(leaf))).selfUs+=us;
 while(id!==undefined){const k=key(nodes.get(id));if(!seen.has(k)){row(k).inclusiveUs+=us;seen.add(k);}id=parent.get(id);}
}
const top=(field)=>[...rows.values()].sort((a,b)=>b[field]-a[field]).slice(0,30).map(r=>({frame:r.frame,selfMs:Math.round(r.selfUs/100)/10,inclusiveMs:Math.round(r.inclusiveUs/100)/10,selfPct:+(100*r.selfUs/totalUs).toFixed(2),inclusivePct:+(100*r.inclusiveUs/totalUs).toFixed(2)}));
const report={scenario:baseline.scenario,seed:baseline.seed,actions:baseline.actions,terminal:baseline.terminal,exactCampaign:true,journalFingerprint:crypto.createHash('sha256').update(JSON.stringify(before.journal)).digest('hex'),node:process.version,baselineMs:baseline.computeElapsedMs,profiledMs:profiled.computeElapsedMs,samplingWindowMs:(profile.endTime-profile.startTime)/1000,sampledMs:totalUs/1000,samples:profile.samples.length,topSelf:top('selfUs'),topInclusive:top('inclusiveUs')};
console.log(JSON.stringify(report,null,2));
