'use strict';
const assert=require('node:assert/strict');
const M=require('../core/mission_storage'), F=require('./fixtures/mission-indexeddb-fixture-v693');
(async()=>{
 const f=F.fixture(),storage=F.quotaStorage(),notices=[];
 const a=M.createStore({indexedDB:f.indexedDB,getStorage:()=>storage,notify:id=>notices.push(id)});
 const b=M.createStore({indexedDB:f.indexedDB,getStorage:()=>storage});
 const id='battle-for-moscow',other='kiev';
 const legacy={state:{turn:3},history:[{a:1}]};M.write(storage,id,legacy);M.write(storage,other,{turn:4});
 assert(await a.exists(id));assert.deepEqual(await a.read(id),legacy);assert.equal(f.commits,0);
 const big={state:{turn:8},history:['abcdef'.repeat(1500000)]};
 assert.throws(()=>M.write(storage,id,big),{name:'QuotaExceededError'});
 assert.deepEqual(M.read(storage,id),legacy);
 const p=a.write(id,big);assert.equal(f.commits,0);await p;
 assert.equal(f.commits,1);assert.deepEqual(notices,[id]);assert.equal(M.read(storage,id),null);
 assert(await b.exists(id));assert.deepEqual(await b.read(id),big);assert.deepEqual(await b.read(other),{turn:4});
 const prevReads=f.reads;await a.exists(id);assert.equal(f.reads-prevReads,1,'status does not read full payload');
 f.failNextWrite(new DOMException('quota','QuotaExceededError'));
 await assert.rejects(a.write(id,{state:{turn:9}}),{name:'QuotaExceededError'});
 assert.deepEqual(await a.read(id),big);assert.equal(f.commits,1);assert.deepEqual(notices,[id]);
 // A legacy value that cannot be cleaned up must never reappear after deletion.
 M.write(storage,id,legacy);const restricted={getItem:k=>storage.getItem(k),removeItem(){throw new DOMException('blocked','SecurityError');}};
 const c=M.createStore({indexedDB:f.indexedDB,getStorage:()=>restricted});
 await c.remove(id);assert.deepEqual(M.read(storage,id),legacy);assert.equal(await b.read(id),null);assert.equal(await b.exists(id),false);assert.deepEqual(await b.read(other),{turn:4});
 await a.write(id,{state:{turn:1}});assert.deepEqual(await c.read(id),{state:{turn:1}});
 const fallback=M.createStore({getStorage:()=>storage});await fallback.write('arduous',legacy);assert.deepEqual(await fallback.read('arduous'),legacy);await assert.rejects(fallback.write('arduous',big),{name:'QuotaExceededError'});assert.deepEqual(await fallback.read('arduous'),legacy);await fallback.remove('arduous');assert.equal(await fallback.exists('arduous'),false);
 // Accessor and read failures share exactly the same fallback policy.
 for(const getStorage of [
  ()=>{throw new DOMException('blocked','SecurityError');},
  ()=>({getItem(){throw new DOMException('blocked','SecurityError');}})
 ]){
  const primary=M.createStore({indexedDB:F.fixture().indexedDB,getStorage});
  assert.equal(await primary.read(id),null);
  assert.equal(await primary.exists(id),false);
  const fallbackOnly=M.createStore({getStorage});
  await assert.rejects(fallbackOnly.read(id),{name:'SecurityError'});
  await assert.rejects(fallbackOnly.exists(id),{name:'SecurityError'});
 }
 const unexpected=M.createStore({indexedDB:F.fixture().indexedDB,getStorage:()=>{throw Error('unexpected legacy failure');}});
 await assert.rejects(unexpected.read(id),/unexpected legacy failure/);
 await assert.rejects(a.write('invalid',{}),/Unknown mission/);
 // Concurrent callers share a failing open; the next operation retries.
 for(const failure of ['throw','error','blocked']){
  const backing=F.fixture(),local=F.quotaStorage();
  let opens=0,oldRequest,closed=0;
  const transient=M.createStore({getStorage:()=>local,indexedDB:{open(...args){
   if(++opens===1){
    if(failure==='throw')throw Error('transient open failure');
    const req={error:Error('transient open failure')};oldRequest=req;
    queueMicrotask(()=>failure==='blocked'?req.onblocked():req.onerror());
    return req;
   }
   return backing.indexedDB.open(...args);
  }}});
  const first=await Promise.allSettled([transient.read(id),transient.exists(id)]);
  assert(first.every(x=>x.status==='rejected'),failure);
  assert.equal(opens,1,'shared failed open');
  await transient.write(id,legacy);
  assert.equal(opens,2,'retry after failed open');
  if(failure==='blocked'){
   oldRequest.result={close(){closed++;}};
   oldRequest.onsuccess();
   assert.equal(closed,1,'late blocked connection closed');
  }
  assert.deepEqual(await transient.read(id),legacy);
  assert.equal(opens,2,'new connection remains cached');
  assert.equal(backing.commits,1);
 }
 console.log('PASS large-save database commit, rollback, legacy compatibility, cross-store read, scoped deletion, tombstone and quota fallback (transaction fixture)');
})().catch(e=>{console.error(e);process.exitCode=1;});
