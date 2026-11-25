/* Battle for Moscow: asynchronous off-main-thread AI runner. */
'use strict';
importScripts('assets/honeycomb.min.js','engine.js','data/opening-book-data.js','opening-book.js','outcome-learning.js','pivot-policy.js','opening-stage.js','capital-assault.js','soviet-defense.js','german-assault-v15.js','assault-retention-v16.js');
const E=self.B4MEngine,B=self.B4MOpeningBook,L=self.B4MOutcomeLearning,P=self.B4MPivot,Stage=self.B4MStage,C=self.B4MCapitalAssault,D=self.B4MSovietDefense,V=self.B4MGermanAssaultV15,Q=self.B4MAssaultRetentionV16;
let stopped=false;
self.onmessage=async ({data:d})=>{
 if(d.cmd==='stop'){stopped=true;return;}
 if(d.cmd!=='start')return;
 stopped=false;
 try{
  const c=E.buildScenario(d.scenario,d.profile);
  const next=(s)=>(s.side==='soviet'&&d.sovietAI==='fortress-v14')?D.playSide(c,s):(s.side==='german'&&d.doctrine==='assault-retention-v16')?((s.turn===2||s.turn>=5)?Q.playSide(c,s,B.selectedPolicy(s,B.get('german',d.germanOpening))):B.play(c,s,d.germanOpening,d.sovietOpening)):(s.side==='german'&&d.doctrine==='screen-breach-v15')?((s.turn===2||s.turn>=5)?V.playSide(c,s,B.selectedPolicy(s,B.get('german',d.germanOpening))):B.play(c,s,d.germanOpening,d.sovietOpening)):(s.side==='german'&&d.doctrine==='capital-assault')?C.playFromOpening(c,s,d.germanOpening,d.sovietOpening,{beginTurn:d.assaultBeginTurn||5}):(s.side==='german'&&d.doctrine==='conditional-pivot')?P.play(c,s,'G2',d.sovietOpening,d.pivotProfile||'guarded'):((s.side==='german'&&d.doctrine==='openingbook')||(s.side==='soviet'&&d.sovietAI==='openingbook'))?(d.adaptiveBook?B.playFlexible(c,s,d.germanOpening,d.sovietOpening):B.play(c,s,d.germanOpening,d.sovietOpening)):s.side==='soviet'?(d.sovietAI==='adversarial'?E.playSovietAdversarial(c,s,d.doctrine,true).state:E.playSide(c,s,'fortress')):
   d.doctrine==='formation'?E.playAI(c,s,d.depth,d.width,false,'formation').state:
   ['adaptive','interdict','envelop','north-route'].includes(d.doctrine)?E.playSide(c,s,d.doctrine):
   E.playAI(c,s,d.depth,d.width,d.doctrine==='sweep','legacy').state;
  const run=async (seed,state,idx,total)=>{
   let s=state||(['openingbook','conditional-pivot','capital-assault','screen-breach-v15','assault-retention-v16'].includes(d.doctrine)?B.setup(c,d.doctrine==='conditional-pivot'?'G2':d.germanOpening,seed,d.deploymentSeed||0):E.makeState(c,seed,['sweep','formation','adaptive','interdict','envelop'].includes(d.doctrine)?'manual':'automated'));
   if(!state&&!['openingbook','conditional-pivot','capital-assault','screen-breach-v15','assault-retention-v16'].includes(d.doctrine)&&['sweep','formation','adaptive','interdict','envelop'].includes(d.doctrine))E.autoSetup(c,s,'sweep');
   const started=performance.now();
   while(!s.over&&!stopped){
    if(performance.now()-started>d.maxMatchMs)return {seed,doctrine:d.doctrine,status:'timeout',ply:s.ply,elapsedMs:Math.round(performance.now()-started)};
    s=next(s);E.validate(c,s);
    self.postMessage({type:'progress',state:d.kind==='single'?s:undefined,message:`Match ${idx}/${total}: side-turn ${s.ply}/14 · ${Math.round((performance.now()-started)/1000)}s`});
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   return {seed,doctrine:d.doctrine,status:s.over?'complete':'stopped',winner:s.winner,ply:s.ply,moscow:s.control['10,2'],garrison:E.occupant(s,10,2)?.id||null,unitStrength:{german:E.units(s,'german').reduce((v,u)=>v+E.strength(u),0),soviet:E.units(s,'soviet').reduce((v,u)=>v+E.strength(u),0)},elapsedMs:Math.round(performance.now()-started),state:d.kind==='single'?s:undefined};
  };
  if(d.kind==='defense-paired'){
    const rows=[],total=Math.max(1,Math.min(3,Number(d.seedsEach)||1))*2;
    for(let k=0;k<total/2&&!stopped;k++)for(const variant of ['v13','v14']){
      if(stopped)break;
      const seed=(d.seed+k)>>>0||1,start=performance.now();let s=B.setup(c,d.germanOpening,seed,d.deploymentSeed||0),status='complete';
      while(!s.over&&!stopped){
        if(performance.now()-start>d.maxMatchMs){status='timeout';break;}
        s=variant==='v13'?C.playFromOpening(c,s,d.germanOpening,d.sovietOpening,{beginTurn:d.assaultBeginTurn||5}):D.playFromOpening(c,s,d.germanOpening,d.sovietOpening,{beginTurn:d.assaultBeginTurn||5});
        E.validate(c,s);
        self.postMessage({type:'defense-progress',message:`Soviet defense ${rows.length+1}/${total} · seed ${seed} · ${variant} · ${s.ply}/14 side-turns`});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      const row={...B.summary(c,s,{seed,variant,germanId:d.germanOpening,sovietId:d.sovietOpening}),status:s.over?'complete':stopped?'stopped':status,shockFinalMoscow:E.occupant(s,10,2)?.id==='s1sh',elapsedMs:Math.round(performance.now()-start)};
      rows.push(row);self.postMessage({type:'defense-row',row});
    }
    const complete=rows.filter(r=>r.status==='complete');
    self.postMessage({type:'completed',results:{rows,scheduled:total,completed:complete.length,germanWins:{v13:complete.filter(r=>r.variant==='v13'&&r.winner==='german').length,v14:complete.filter(r=>r.variant==='v14'&&r.winner==='german').length}},message:`Defense comparison: ${complete.length}/${total} games completed.`});return;
  }
  if(d.kind==='capital-paired'){
    const rows=[],total=Math.max(1,Math.min(3,Number(d.seedsEach)||1))*2;
    for(let k=0;k<total/2&&!stopped;k++)for(const variant of ['baseline','capital']){
      if(stopped)break;
      const seed=(d.seed+k)>>>0||1,start=performance.now();
      let s=B.setup(c,d.germanOpening,seed,d.deploymentSeed||0),status='complete';
      while(!s.over&&!stopped){
        if(performance.now()-start>d.maxMatchMs){status='timeout';break;}
        s=variant==='baseline'?B.play(c,s,d.germanOpening,d.sovietOpening):C.playFromOpening(c,s,d.germanOpening,d.sovietOpening,{beginTurn:d.assaultBeginTurn||5});
        E.validate(c,s);
        self.postMessage({type:'capital-progress',message:`Capital comparison ${rows.length+1}/${total} · seed ${seed} · ${variant} · ${s.ply}/14 side-turns`});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      const row={...B.summary(c,s,{seed,variant,germanId:d.germanOpening,sovietId:d.sovietOpening,beginTurn:d.assaultBeginTurn||5}),status:s.over?'complete':stopped?'stopped':status,elapsedMs:Math.round(performance.now()-start)};
      // Report results and separately preserve the raw number of side-turns;
      // avoid inferring an attack count from the *final* Moscow occupant.
      rows.push(row);self.postMessage({type:'capital-row',row});
    }
    const complete=rows.filter(r=>r.status==='complete');
    self.postMessage({type:'completed',results:{rows,scheduled:total,completed:complete.length,germanWins:{baseline:complete.filter(r=>r.variant==='baseline'&&r.winner==='german').length,capital:complete.filter(r=>r.variant==='capital'&&r.winner==='german').length}},message:`Capital comparison: ${complete.length}/${total} completed through final Soviet turn.`});return;
  }
  if(d.kind==='pivot-probe'){
    const state=d.state||B.setup(c,'G2',d.seed),result=P.probe(c,state);
    self.postMessage({type:'completed',results:result,message:'Pivot probe complete (one German and one Soviet side-turn per branch).'});return;
  }
  if(d.kind==='pivot-compare'){
    const rows=[],seeds=Math.max(1,Math.min(10,Number(d.seedsEach)||2));
    const profiles=['fixed',d.pivotProfile||'guarded'];
    for(let k=0;k<seeds&&!stopped;k++)for(const profile of profiles){
      if(stopped)break;
      const seed=(d.seed+k)>>>0||1,started=performance.now(),state=B.setup(c,'G2',seed);
      let s=state,completed=true;
      while(!s.over&&!stopped){
        if(performance.now()-started>d.maxMatchMs){completed=false;break;}
        s=profile==='fixed'?B.play(c,s,'G2',d.sovietOpening):P.play(c,s,'G2',d.sovietOpening,profile);
        E.validate(c,s);
        self.postMessage({type:'pivot-progress',message:`Pivot ${profile} seed ${seed}, ${s.ply}/14 side-turns`});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      const result={...B.summary(c,s,{seed,germanId:'G2',sovietId:d.sovietOpening,profile,complete:completed&&s.over,elapsedMs:Math.round(performance.now()-started)}),ruleset:'oberlabs_2009_web'};
      rows.push(result);self.postMessage({type:'pivot-row',result});
    }
    const complete=rows.filter(r=>r.complete);
    self.postMessage({type:'completed',results:{rows,completed:complete.length,total:rows.length,germanWins:complete.filter(r=>r.winner==='german').length},message:`Pivot comparison: ${complete.length}/${rows.length} completed; see pivot results.`});return;
  }
  if(d.kind==='postmortem'){
    const trace=L.trace(c,d.seed,d.germanOpening,d.sovietOpening);
    self.postMessage({type:'postmortem-progress',message:`Replay complete (${trace.final.winner}); investigating German side-turn alternatives.`});
    await new Promise(resolve=>setTimeout(resolve,0));
    const tests=[];
    // A single chosen German side-turn keeps the offline replay bounded.
    const ply=Math.max(0,Math.min(12,((Number(d.forkTurn)||6)-1)*2));
    if(!stopped){
      const t=trace.states[ply];
      if(!t||t.side!=='german')throw Error('Expected German side-turn checkpoint');
      const original=trace.decisions[ply].policy;
      const alternatives=['sweep','envelop','interdict','north-route','aggressive'].filter(x=>x!==original).slice(0,1);
      const row=L.fork(c,trace,ply,alternatives,{samples:Math.max(1,Math.min(4,Number(d.postmortemTrials)||1)),pairedDice:!!d.pairedDice});
      tests.push(row);
      self.postMessage({type:'postmortem-progress',message:`Counterfactual German turn ${t.turn} evaluated (${row.summaries.length} policies)`});
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    const results={type:'outcome-postmortem',seed:d.seed,germanId:d.germanOpening,sovietId:d.sovietOpening,baseline:trace.final,tests,disclaimer:'Opening policies are fixed following each single side-turn deviation. Matching the PRNG checkpoint seed does not match battle-level die rolls if actions diverge.'};
    self.postMessage({type:'completed',results,message:`Post-mortem complete: ${tests.length} German turn checkpoints, winner ${trace.final.winner}.`});return;
  }
  if(d.kind==='stage'){
    const gs=d.scope==='all'?B.ids('german'):B.familyLeads(), ss=B.ids('soviet');let idx=0;
    for(const g of gs){if(stopped)break;
      for(const so of ss){if(stopped)break;
        const result=Stage.reachTurn3(c,{germanId:g,sovietId:so,combatSeed:d.seed,deploymentSeed:d.deploymentSeed||0});
        self.postMessage({type:'stage-row',result});idx++;
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    self.postMessage({type:'completed',results:{positions:idx,expected:gs.length*ss.length,complete:!stopped},message:`Computed ${idx}/${gs.length*ss.length} pre-mud position measurements. These are not final outcomes.`});return;
  }
  if(d.kind==='recommend'){
    // Each pairing is a distinct two-side-turn legal game continuation.
    const rows=[];let completed=0;
    for(const g of B.familyLeads()){
      if(stopped)break;const first=B.play(c,B.setup(c,g,d.seed,d.deploymentSeed||0),g,'S1');
      for(const sov of B.ids('soviet')){
      if(stopped)break;const after=B.play(c,first,g,sov);
      rows.push({germanId:g,sovietId:sov,score:E.strategicValue(c,after,'german'),moscow:after.control['10,2'],sovietGarrison:E.occupant(after,10,2)?.id||null,ply:after.ply});completed++;
      self.postMessage({type:'recommend-row',completed,pair:`${g}/${sov}`});
      await new Promise(resolve=>setTimeout(resolve,0));
    }}
    if(!stopped){const candidates=B.familyLeads().map(g=>{const vs=rows.filter(r=>r.germanId===g).sort((a,b)=>a.score-b.score||a.sovietId.localeCompare(b.sovietId));return {germanId:g,worstResponse:vs[0].sovietId,worstScore:vs[0].score,meanScore:vs.reduce((t,r)=>t+r.score,0)/vs.length};}).sort((a,b)=>b.worstScore-a.worstScore||b.meanScore-a.meanScore||a.germanId.localeCompare(b.germanId));
      self.postMessage({type:'completed',results:{recommended:candidates[0],candidates,rows,depth:'two side turns'},message:'Opening maximin preview finished (static evaluation only)'});
    }return;
  }
  if(d.kind==='matrix'){
   const seedsEach=Math.max(1,Math.min(20,Number(d.seedsEach)||1)),results=[],gs=d.scope==='all'?B.ids('german'):B.familyLeads(),ss=B.ids('soviet'),total=seedsEach*gs.length*ss.length;let idx=0;
   for(let k=0;k<seedsEach&&!stopped;k++)for(const g of gs)for(const sov of ss){
    if(stopped)break;idx++;let seed=(d.seed+k)>>>0||1;let s=B.setup(c,g,seed,d.deploymentSeed||0),began=performance.now();let status='complete';
    while(!s.over&&!stopped){if(performance.now()-began>d.maxMatchMs){status='timeout';break;}
     s=d.adaptiveBook?B.playFlexible(c,s,g,sov):B.play(c,s,g,sov);E.validate(c,s);
     self.postMessage({type:'progress',message:`Matrix ${idx}/${total} · ${g}/${sov} · side-turn ${s.ply}/14`});
     await new Promise(resolve=>setTimeout(resolve,0));
    }
    const result={...B.summary(c,s,{seed,combatSeed:seed,deploymentSeed:d.deploymentSeed||0,germanId:g,sovietId:sov}),complete:s.over&&s.ply===14,adaptiveBook:!!d.adaptiveBook,ruleset:'oberlabs_2009_web',status:s.over?'complete':stopped?'stopped':status,elapsedMs:Math.round(performance.now()-began)};
    results.push(result);self.postMessage({type:'matrix-row',result});
   }
   const stats={scheduled:total,completed:results.filter(r=>r.complete).length,german:results.filter(r=>r.complete&&r.winner==='german').length,soviet:results.filter(r=>r.complete&&r.winner==='soviet').length,draw:results.filter(r=>r.complete&&r.winner==='draw').length};
   self.postMessage({type:'completed',results:stats,message:`Matrix completed ${stats.completed}/${stats.scheduled}. German ${stats.german}, Soviet ${stats.soviet}, draws ${stats.draw}; download JSON to inspect.`});return;
  }
  if(d.kind==='single'){

   const result=await run(d.seed,d.state,1,1);
   self.postMessage({type:'completed',state:result.state,results:result,message:`Match ${result.status}: ${result.winner||'undecided'} (${result.ply}/14 side-turns)`});
  }else{
   let results=[];
   for(let i=0;i<d.count&&!stopped;i++){let r=await run(d.seed+i,null,i+1,d.count);results.push(r);}
   const summary={completed:results.filter(x=>x.status==='complete').length,timeouts:results.filter(x=>x.status==='timeout').length,german:results.filter(x=>x.winner==='german').length,soviet:results.filter(x=>x.winner==='soviet').length,draw:results.filter(x=>x.winner==='draw').length,results};
   self.postMessage({type:'completed',results:summary,message:`${summary.completed}/${results.length} games complete; ${summary.timeouts} timed out · German ${summary.german}, Soviet ${summary.soviet}, draw ${summary.draw}`});
  }
 }catch(e){self.postMessage({type:'failed',message:String(e.stack||e)});}
};
