/* Portable browser gameplay configuration; authoritative engine saves remain intact. */
(function(root){
'use strict';
const hash=typeof module==='object'&&module.exports?s=>require('node:crypto').createHash('sha256').update(s).digest('hex'):s=>root.WargameSyncSha256.sha256(s);
const Difficulty=typeof module==='object'&&module.exports?require('./ai_difficulty.js'):root.WargameAIDifficulty;
const assignments=['manual','german','soviet','both'];
function defaults(strategies){return {assignment:'manual',german:strategies[0],soviet:strategies[0]};}
function validate(config,strategies){
 const keys=config&&Object.keys(config).sort().join(',');
 if(!config||!['assignment,german,soviet','assignment,german,germanDifficulty,soviet,sovietDifficulty'].includes(keys)||!assignments.includes(config.assignment)||!strategies.includes(config.german)||!strategies.includes(config.soviet))throw Error('Invalid saved player configuration');
 if(keys==='assignment,german,soviet')return {...config};
 const germanDifficulty=Difficulty.validate(config.germanDifficulty),sovietDifficulty=Difficulty.validate(config.sovietDifficulty);
 return {assignment:config.assignment,german:config.german,soviet:config.soviet,...(germanDifficulty||sovietDifficulty?{germanDifficulty,sovietDifficulty}:{})};
}
function pack(save,config,strategies){
 const players=validate(config,strategies);
 if(!save||typeof save!=='object'||Array.isArray(save)||Object.hasOwn(save,'playerSession'))throw Error('Invalid engine save');
 const metadata={version:Object.hasOwn(players,'germanDifficulty')?2:1,players};
 // Unconfigured legacy sessions retain their exact previous format.
 if(JSON.stringify(players)===JSON.stringify(defaults(strategies)))return save;
 return {...save,playerSession:{...metadata,sha256:hash(JSON.stringify([save,metadata]))}};
}
function unpack(input,strategies){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid saved session');
 if(!Object.hasOwn(input,'playerSession'))return {save:input,players:defaults(strategies)};
 const {playerSession:record,...save}=input;
 if(!record||![1,2].includes(record.version)||Object.keys(record).sort().join(',')!=='players,sha256,version')throw Error('Invalid player session metadata');
 const {sha256,...metadata}=record;
 if(sha256!==hash(JSON.stringify([save,metadata])))throw Error('Player session checksum mismatch');
 const players=validate(record.players,strategies);
 if((record.version===2)!==Object.hasOwn(players,'germanDifficulty')||
    (record.version===1&&Object.hasOwn(record.players,'germanDifficulty')))throw Error('Invalid player session grade version');
 return {save,players};
}
const api={defaults,validate,pack,unpack};if(typeof module==='object'&&module.exports)module.exports=api;root.WargamePlayerSaveConfig=api;
})(globalThis);
