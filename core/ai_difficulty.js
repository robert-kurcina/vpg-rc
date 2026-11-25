/* Optional graded AI effort presets. No changes to rules, unit values or RNG. */
(function(root){
'use strict';
const unlimited=Number.MAX_SAFE_INTEGER;
// Grade zero is a compatibility sentinel, not an eleventh difficulty grade.
// These are uncalibrated effort presets; strength need not be monotonic.
// Historical optional moves, attacks, detailed candidates, trials, nodes;
// native optional moves and battles. Mandatory decisions are not budgeted here.
const rows=Object.freeze([
 [3,1,2,32,16,2,1], [5,1,3,40,20,3,1], [7,2,4,48,24,4,2],
 [10,2,5,56,28,5,2], [14,3,6,64,32,6,3], [18,4,8,64,32,8,3],
 [24,6,8,80,40,10,4], [unlimited,8,10,96,48,12,5],
 [unlimited,unlimited,12,112,56,16,6], [unlimited,unlimited,16,128,64,60,20]
].map(Object.freeze));
function validate(value){if(!Number.isInteger(value)||value<0||value>10)throw Error('Invalid AI difficulty');return value;}
function native(grade=0){validate(grade);if(!grade)return {};const row=rows[grade-1];return {maxMovesPerPhase:row[5],maxBattlesPerPhase:row[6],maxActions:400};}
function historical(grade=0){validate(grade);if(!grade)return {};const row=rows[grade-1];return {maxGroundMovesPerPhase:row[0],maxCombatsPerPhase:row[1]};}
function continuation(grade=0){validate(grade);if(!grade)return {};const row=rows[grade-1];return {maxCandidates:row[2],maxTrials:row[3],maxNodes:row[4]};}
// Player-facing presets do not change internal numerical profiles or saved values.
const expert=Object.freeze({'battle-for-moscow':8,arduous:4,leningrad:7,kiev:7,'kiev-odessa':7});
function presets(scenario){if(!Object.hasOwn(expert,scenario))throw Error('Unknown difficulty scenario');return Object.freeze([0,1,3,expert[scenario]]);}
function restoreSelect(select,value){
 validate(value);const key=String(value);
 for(const option of Array.from(select.options))if(option.dataset.legacyGrade==='true'&&option.value!==key)option.remove();
 if(!Array.from(select.options).some(option=>option.value===key)){
  const option=select.ownerDocument.createElement('option');option.value=key;option.textContent='Legacy grade '+key;option.dataset.legacyGrade='true';select.appendChild(option);
 }
 select.value=key;
 if(!select.dataset.legacyGradeBound){select.dataset.legacyGradeBound='true';select.addEventListener('change',()=>{for(const option of Array.from(select.options))if(option.dataset.legacyGrade==='true'&&option.value!==select.value)option.remove();});}
}
const api=Object.freeze({validate,native,historical,continuation,presets,restoreSelect});
if(typeof module==='object'&&module.exports)module.exports=api;else root.WargameAIDifficulty=api;
})(globalThis);
