'use strict';
const assert=require('node:assert/strict');const M=require('../core/mission_storage');
const entries=new Map();const s={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
for(const id of M.missions){assert.equal(M.read(s,id),null);M.write(s,id,{scenario:id,state:{turn:2}});}
for(const id of M.missions)assert.deepEqual(M.read(s,id),{scenario:id,state:{turn:2}});
M.remove(s,'kiev');assert.equal(M.read(s,'kiev'),null);assert.equal(M.read(s,'kiev-odessa').scenario,'kiev-odessa');
assert.throws(()=>M.key('unknown'));assert.throws(()=>M.write(s,'kiev',null));
s.setItem(M.key('kiev'),JSON.stringify({version:1,mission:'arduous',save:{}}));assert.throws(()=>M.read(s,'kiev'));
s.setItem(M.key('kiev'),'{');assert.throws(()=>M.read(s,'kiev'));
assert.throws(()=>M.write({setItem(){throw Error('quota');}},'kiev',{}),/quota/);
console.log('PASS five isolated mission saves, removal, invalid envelopes and storage failure');
