/* Shared pre-roll attack decision arithmetic. No state, random draws or hidden faces.
 * Utilities are comparable position values, not odds or calibrated probabilities.
 * Threat forecasts must be supplied by a separate observable-state evaluator.
 */
'use strict';
const CRT=require('./historical_crt');
const REASONS=Object.freeze(['conventional','desperation','preemptive','breakout','relief','objective','attrition','disruption','last-turn']);
function evaluate({odds,variant='standard',outcomeUtility,inactionUtility,opportunityCost=0,reason='conventional',eliminationRisk=null}={}){
 CRT.normalizeVariant(variant);
 if(!Number.isFinite(odds)||odds<0||!Number.isFinite(inactionUtility)||!Number.isFinite(opportunityCost)||opportunityCost<0||!REASONS.includes(reason)||
 (eliminationRisk!==null&&(!Number.isFinite(eliminationRisk)||eliminationRisk<0||eliminationRisk>1)))throw Error('Invalid attack utility inputs');
 if(odds===0)return {eligible:false,reason:'automatic-NE',expectedUtility:inactionUtility,delta:0,distribution:{}};
 const rolls=CRT.columns(variant)[String(odds)];
 if(!rolls)throw Error('Invalid attack utility CRT column');
 const distribution={};let total=0;
 for(const result of rolls){
  if(!Number.isFinite(outcomeUtility?.[result]))throw Error('Missing finite utility for '+result);
  total+=outcomeUtility[result];distribution[result]=(distribution[result]||0)+1;
 }
 const expectedUtility=total/6-opportunityCost,delta=expectedUtility-inactionUtility;
 // These are consideration gates, not permission to attack at negative utility.
 // Risk estimates are optional and must not be invented from isolation alone.
 const desperationThreshold=odds===0.5?0.75:odds===1?0.5:0;
 const justified=odds>1||(reason!=='conventional'&&(reason!=='desperation'||(eliminationRisk!==null&&eliminationRisk>=desperationThreshold)));
 return {eligible:justified&&delta>0,reason:!justified?'low-odds-justification-required':delta<=0?'nonpositive-utility':reason,expectedUtility,delta,distribution};
}
module.exports=Object.freeze({evaluate,REASONS});
