/* Versioned, domain-separated mission randomness. Counters are derived from
 * committed history, not from speculative searches or UI rendering. */
'use strict';
const crypto=require('node:crypto');
const STREAMS=Object.freeze(['deployment','combat','naval','ai','test']);
function validate(seed){if(typeof seed!=='string'||!/^[0-9a-f]{32}$/.test(seed))throw Error('Invalid mission master seed');return seed;}
function generate(){const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
function integer(seed,stream,index,size){validate(seed);if(!STREAMS.includes(stream)||!Number.isSafeInteger(index)||index<0||!Number.isSafeInteger(size)||size<1||size>4294967296)throw Error('Invalid mission random request');const limit=4294967296-(4294967296%size);for(let retry=0;;retry++){const n=crypto.createHash('sha256').update(JSON.stringify(['mission-rng-v1',seed,stream,index,retry])).digest().readUInt32BE(0);if(n<limit)return n%size;}}
function actionStream(input){const a=input?.type==='combat'?input.action:input;if(!Number.isInteger(a?.die))return null;if(['resolve-battle','commit-fleet-displacement'].includes(a.type))return 'combat';if(['roll-fleet-attack','roll-fleet-displacement','roll-fleet-move','roll-naval-ground-transport','resolve-forced-ground-move'].includes(a.type))return 'naval';return null;}
function count(journal,stream){return journal.reduce((n,r)=>n+(actionStream(r.action)===stream?1:0),0);}
function die(seed,journal,stream){return 1+integer(seed,stream,count(journal,stream),6);}
module.exports=Object.freeze({validate,generate,integer,actionStream,count,die,STREAMS});
