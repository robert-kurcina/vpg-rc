'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),D=require('../core/ai_difficulty');
const routes={'battle-for-moscow':'native-preview',arduous:'native-preview',leningrad:'native-preview',kiev:'setup-preview','kiev-odessa':'experimental-preview'};
const experts=[8,4,7,7,7];let checks=0;
for(const [i,[scenario,route]] of Object.entries(routes).entries()){
 const values=[0,1,3,experts[i]];
 assert.deepEqual(D.presets(scenario),values);checks++;
 const html=fs.readFileSync(path.join(__dirname,'..','games',scenario,route,'index.html'),'utf8');
 for(const id of ['ai-difficulty','ai-difficulty-soviet']){
  const options=html.match(new RegExp(`<select id="${id}">([\\s\\S]*?)</select>`))[1];
  const actual=Array.from(options.matchAll(/<option value="(\d+)">([^<]+)<\/option>/g),m=>[Number(m[1]),m[2]]);
  assert.deepEqual(actual,values.map((v,j)=>[v,['Strategy defaults (unchanged)','Novice','Standard','Expert'][j]]));checks++;
 }
}
assert.throws(()=>D.presets('odessa'));checks++;
// All legacy internal profiles remain valid; no changes to engine budgets.
for(let g=0;g<=10;g++){assert.equal(D.validate(g),g);checks++;}
console.log(`PASS named difficulty routes and internal profile compatibility: ${checks} checks`);
