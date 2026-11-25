'use strict';
// Independent headless historical campaigns; no changes to engine or RNG.
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {spawn}=require('node:child_process');
const runner=path.resolve(__dirname,'../tests/historical-operational-qualification-v644.test.js');
const nativeRunner=path.resolve(__dirname,'run-native-campaign.js');
const Difficulty=require('../core/ai_difficulty');
async function main(){
 const [input,out,workerArg]=process.argv.slice(2);
 if(!input||!out) throw Error('usage: node scripts/run-campaign-batch.js jobs.json new-output-directory [workers]');
 const workers=workerArg===undefined?Math.min(4,os.availableParallelism()):Number(workerArg);
 if(!Number.isSafeInteger(workers)||workers<1||workers>64)throw Error('workers must be 1–64');
 const jobs=JSON.parse(fs.readFileSync(input,'utf8'));
 if(!Array.isArray(jobs)||!jobs.length)throw Error('nonempty jobs array required');
 const ids=new Set();
 for(const j of jobs){
  if(!j||typeof j.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(j.id)||ids.has(j.id)||j.id==='summary'||!['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa'].includes(j.scenario)||!['standard','advanced'].includes(j.variant)||!Number.isSafeInteger(j.seed)||j.seed<0||!Number.isSafeInteger(j.limit??5000)||(j.limit??5000)<1||(j.limit??5000)>5000||!['campaign','turn'].includes(j.fleetBudgetScope??'campaign')||!['baseline','reserve-relief'].includes(j.objectivePolicy??'baseline'))throw Error('invalid or duplicate job: '+JSON.stringify(j));
  for(const key of ['germanDifficulty','sovietDifficulty'])Difficulty.validate(Object.hasOwn(j,key)?j[key]:0);
  if(j.scenario==='battle-for-moscow'&&(j.seed>0xffffffff||j.seed<1||j.objectivePolicy==='reserve-relief'||j.fleetBudgetScope==='turn'))throw Error('Unsupported native seed or policy: '+j.id);
  if(!['historical','graduated'].includes(j.victoryMode??'historical'))throw Error('Invalid victory mode: '+j.id);
  if(!['historical','double'].includes(j.stacking??'historical')||(j.scenario!=='battle-for-moscow'&&j.stacking!==undefined))throw Error('Invalid stacking profile: '+j.id);
  for(const k of ['germanTacticalPolicy','sovietTacticalPolicy'])if(j[k]!==undefined&&(j.scenario!=='battle-for-moscow'||!['armored-concentration-v1','concentrated-defense-v1','mobile-concentration-v1','adaptive-concentration-v1'].includes(j[k])))throw Error('Invalid experimental policy: '+j.id);
  ids.add(j.id);
 }
 fs.mkdirSync(out,{recursive:false}); const root=path.resolve(out), results=new Array(jobs.length); let next=0;
 const started=Date.now();
 async function worker(){while(next<jobs.length){const i=next++, j=jobs[i], base=path.join(root,j.id), t=Date.now();
  results[i]=await new Promise(resolve=>{
   const stdout=fs.openSync(base+'.stdout','wx'), stderr=fs.openSync(base+'.stderr','wx');
   const grades=[String(j.germanDifficulty??0),String(j.sovietDifficulty??0)];
    const args=j.scenario==='battle-for-moscow'?[nativeRunner,j.variant,String(j.seed),String(j.limit??5000),...grades]:[runner,j.scenario,j.variant,String(j.seed),String(j.limit??5000),j.fleetBudgetScope??'campaign',j.objectivePolicy??'baseline','greedy','same',...grades];
    const p=spawn(process.execPath,args,{stdio:['ignore',stdout,stderr],env:{...process.env,VICTORY_MODE:j.victoryMode??'historical',B4M_STACKING:j.stacking??'historical',GERMAN_TACTICAL_POLICY:j.germanTacticalPolicy??'',SOVIET_TACTICAL_POLICY:j.sovietTacticalPolicy??'',AUDIT_PATH:base+'.json',JOURNAL_PATH:base+'.journal.json'}});
   fs.closeSync(stdout);fs.closeSync(stderr);
   let error; p.on('error',e=>{error=e.message;});p.on('close',(code,signal)=>{
    let report=null;try{report=JSON.parse(fs.readFileSync(base+'.json','utf8'));}catch(e){error??=e.message;}
    const success=code===0&&report?.exactRestore===true&&(report.status==='complete'||((j.limit??5000)<5000&&report.reason==='controller-action-budget'&&report.actions===j.limit));
    resolve({id:j.id,success,code,signal,error,wallMs:Date.now()-t,report});
   });
  });
 }}
 await Promise.all(Array.from({length:Math.min(workers,jobs.length)},worker));
 const summary={workers,jobs:jobs.length,wallMs:Date.now()-started,successful:results.filter(r=>r.success).length,results};
 fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({workers,jobs:jobs.length,wallMs:summary.wallMs,successful:summary.successful}));if(summary.successful!==jobs.length)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
