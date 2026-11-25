/* Transactional transport fixture for storage contract testing. Not a browser
 * IndexedDB implementation or a substitute for real-origin acceptance. */
(function(root){'use strict';
 function fixture(){
  const records=new Map();let created=false,failWrite=null,commits=0,reads=0;
  const db={objectStoreNames:{contains:()=>created},createObjectStore(){created=true;},close(){},
   transaction(_name,mode){
    const ops=[];let aborted=false;const tx={error:null,abort(){aborted=true;},objectStore(){return {
     get(k){const req={};ops.push(map=>{reads++;req.result=map.has(k)?structuredClone(map.get(k)):undefined;});return req;},
     put(v,k){if(mode!=='readwrite')throw Error('Readonly transaction');const val=structuredClone(v);ops.push(map=>map.set(k,val));},
     delete(k){if(mode!=='readwrite')throw Error('Readonly transaction');ops.push(map=>map.delete(k));}
    };}};
    setTimeout(()=>{if(aborted){tx.onabort?.();return;}const next=new Map(records);try{for(const op of ops)op(next);
     if(mode==='readwrite'&&failWrite){const error=failWrite;failWrite=null;throw error;}
     if(mode==='readwrite'){records.clear();for(const [k,v] of next)records.set(k,v);commits++;}
     tx.oncomplete?.();}catch(e){tx.error=e;tx.onabort?.();}},0);
    return tx;
   }};
  return {indexedDB:{open(){const req={result:db};setTimeout(()=>{if(!created)req.onupgradeneeded?.();req.onsuccess?.();},0);return req;}},
   failNextWrite(e){failWrite=e;},get commits(){return commits;},get reads(){return reads;}};
 }
 function quotaStorage(limit=5*1024*1024){const map=new Map();return {getItem:k=>map.get(k)??null,removeItem:k=>map.delete(k),setItem(k,value){const v=String(value),next=new Map(map);next.set(k,v);let size=0;for(const [key,val] of next)size+=2*(key.length+val.length);if(size>limit)throw new DOMException('Storage capacity exceeded','QuotaExceededError');map.set(k,v);}};}
 const api={fixture,quotaStorage};if(typeof module==='object'&&module.exports)module.exports=api;else root.MissionStorageFixture=api;
})(typeof globalThis!=='undefined'?globalThis:this);
