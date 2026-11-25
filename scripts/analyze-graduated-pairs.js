'use strict';
// Compare actual played modes, not counterfactual rescoring. Does not certify balance.
const fs=require('node:fs'), path=require('node:path');
const Graduated=require('../core/graduated_mode');
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
function winner(r){
 const outcome=r.terminal?.outcome;
 const fromOutcome=outcome===undefined?undefined:({'german-victory':'german','soviet-victory':'soviet','draw':'draw','unresolved-source-rule':'unresolved'})[outcome];
 const values=[r.winner,r.terminal?.winner,fromOutcome].filter(x=>x!==undefined);
 if((outcome!==undefined&&fromOutcome===undefined)||!values.length||!['german','soviet','draw','unresolved'].includes(values[0])||values.some(x=>x!==values[0]))return null;
 return values[0];
}
function analyze(rows){
 if(!Array.isArray(rows)||!rows.length)throw Error('Nonempty campaign reports required');
 const pairs=new Map(), excluded=[];
 for(const r of rows){
  if(!r||!['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa'].includes(r.scenario)||!['historical','double'].includes(r.stacking??'historical')||(r.scenario!=='battle-for-moscow'&&(r.stacking??'historical')!=='historical')||!['standard','advanced'].includes(r.variant)||!Number.isSafeInteger(r.seed)||!['historical','graduated'].includes(r.victoryMode??'historical')){excluded.push({reason:'invalid-identifiers',scenario:r?.scenario});continue;}
  const mode=r.victoryMode??'historical',stacking=r.stacking??'historical';
  const key=JSON.stringify(stable([r.scenario,r.variant,r.seed,stacking,r.grades??null,r.factionPolicies??null,r.policy??null,r.matchup??null]));
  if(!pairs.has(key))pairs.set(key,{});
  const p=pairs.get(key);if(p[mode])throw Error('Duplicate mode and matched configuration: '+key);
  p[mode]=r;
 }
 const matched=[];
 for(const [key,p] of pairs){
  const [scenario,variant,seed,stacking]=JSON.parse(key);
  if(!p.historical||!p.graduated){excluded.push({scenario,variant,seed,stacking,reason:'unpaired-mode'});continue;}
  const a=p.historical,b=p.graduated;
  if([a,b].some(r=>r.status!=='complete'||r.exactRestore!==true||!r.terminal||!r.cityControl)){
   excluded.push({scenario,variant,seed,stacking,reason:'incomplete-or-unverified'});continue;
  }
  if(a.graduated||a.terminal.graduated){excluded.push({scenario,variant,seed,stacking,reason:'historical-report-has-graduated-score'});continue;}
  const profile=Graduated.profile(scenario);
  let historicalRescored,graduatedRescored;
  try{historicalRescored=Graduated.evaluate(profile,a.cityControl);graduatedRescored=Graduated.evaluate(profile,b.cityControl);}
  catch{excluded.push({scenario,variant,seed,stacking,reason:'invalid-city-ledger'});continue;}
  const historicalWinner=winner(a),graduatedWinner=winner(b);
  if(!historicalWinner||!graduatedWinner||graduatedWinner!==graduatedRescored.winner){
   excluded.push({scenario,variant,seed,stacking,reason:'terminal-winner-mismatch'});continue;
  }
  if([a,b].some(r=>r.terminal.cityControl&&!equal(r.terminal.cityControl,r.cityControl))){
   excluded.push({scenario,variant,seed,stacking,reason:'terminal-ledger-mismatch'});continue;
  }
  if(!equal(b.graduated??b.terminal.graduated,graduatedRescored)||(b.graduated&&b.terminal.graduated&&!equal(b.graduated,b.terminal.graduated))){
   excluded.push({scenario,variant,seed,stacking,reason:'graduated-report-mismatch'});continue;
  }
  matched.push({scenario,variant,seed,stacking,historicalWinner,graduatedWinner,
   historicalCounterfactualGrade:historicalRescored.grade,graduatedGrade:graduatedRescored.grade,
   historicalGermanVP:historicalRescored.germanVP,graduatedGermanVP:graduatedRescored.germanVP,
   changedCityControl:!equal(a.cityControl,b.cityControl)});
 }
 function summarize(items){
  const summary={pairs:items.length,historicalWins:{german:0,soviet:0,draw:0,unresolved:0},graduatedWins:{german:0,soviet:0,draw:0},changedCityControl:0};
  for(const m of items){for(const [mode,field] of [['historical','historicalWinner'],['graduated','graduatedWinner']]){
   const w=m[field];if(!Object.hasOwn(summary[mode+'Wins'],w))throw Error('Unknown winner: '+w);summary[mode+'Wins'][w]++;
  }if(m.changedCityControl)summary.changedCityControl++;}
  return summary;
 }
 const byScenario=Object.fromEntries([...new Set(matched.map(m=>m.scenario))].sort().map(scenario=>{
  const items=matched.filter(m=>m.scenario===scenario);
  return [scenario,{...summarize(items),distinctSeeds:new Set(items.map(m=>m.seed)).size,graduatedGermanVP:items.map(m=>m.graduatedGermanVP)}];
 }));
 return {status:'exploratory-not-human-balance',summary:summarize(matched),byScenario,matched,excluded};
}
if(require.main===module){
 const inputs=process.argv.slice(2);if(!inputs.length)throw Error('Usage: node scripts/analyze-graduated-pairs.js report-directory|audit.json [...]');
 const rows=[];
 for(const input of inputs){
  if(fs.statSync(input).isDirectory()){
   for(const f of fs.readdirSync(input).filter(f=>f.endsWith('.json')&&!f.endsWith('.journal.json')&&f!=='summary.json'))rows.push(JSON.parse(fs.readFileSync(path.join(input,f),'utf8')));
  }else{
   const audit=JSON.parse(fs.readFileSync(input,'utf8'));
   if(Array.isArray(audit.reports))rows.push(...audit.reports);
   else for(const mode of ['historical','graduated']){
    if(!Array.isArray(audit[mode]?.results))throw Error('Expected report array or archived mode results in '+input);
    for(const result of audit[mode].results)if(result.success===true&&result.code===0&&result.report)rows.push(result.report);
   }
  }
 }
 process.stdout.write(JSON.stringify(analyze(rows),null,2)+'\n');
}
module.exports={analyze};
