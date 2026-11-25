'use strict';
const fs=require('node:fs'), {measure,evaluate,evaluateWeighted}=require('../core/graduated_victory');
const [input,thresholdFile]=process.argv.slice(2);
if(!input)throw Error('usage: node scripts/score-graduated-research.js batch-summary.json [research-thresholds.json]');
const batch=JSON.parse(fs.readFileSync(input,'utf8'));
const thresholds=thresholdFile?JSON.parse(fs.readFileSync(thresholdFile,'utf8')):null;
if(!Array.isArray(batch.results))throw Error('Batch summary required');
const records=[],excluded=[];
for(const r of batch.results){if(!r.success||r.report?.status!=='complete'){excluded.push(r.id);continue;}const config=thresholds?.[r.report.scenario];const m=thresholds?(Array.isArray(config)?evaluate(r.report,config):evaluateWeighted(r.report,config)):measure(r.report);records.push({id:r.id,...m,factionPolicies:r.report.factionPolicies});}
console.log(JSON.stringify({status:'research-only',records,excluded},null,2));
