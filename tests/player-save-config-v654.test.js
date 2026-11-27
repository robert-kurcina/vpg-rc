const assert=require('node:assert/strict');const P=require('../core/player_save_config.js');
let n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++;};const throws=(fn)=>{assert.throws(fn);n++;};
for(const strategies of [['diagnostic','operational','reserve-relief'],['baseline','objective','capture']]){
 const raw={format:'engine-save',version:1,state:{seed:42},integrity:{digest:'engine-owned'}};
 eq(P.pack(raw,P.defaults(strategies),strategies),raw);eq(P.unpack(raw,strategies),{save:raw,players:P.defaults(strategies)});
 for(const assignment of ['manual','german','soviet','both'])for(const german of strategies)for(const soviet of strategies){const players={assignment,german,soviet};const encoded=P.pack(raw,players,strategies);eq(P.unpack(JSON.parse(JSON.stringify(encoded)),strategies),{save:raw,players});if(encoded.playerSession){const changed=structuredClone(encoded);changed.state.seed++;throws(()=>P.unpack(changed,strategies));const other=structuredClone(encoded);other.playerSession.players.assignment='invalid';throws(()=>P.unpack(other,strategies));}}
 throws(()=>P.pack(raw,{assignment:'both',german:'wrong',soviet:strategies[0]},strategies));throws(()=>P.pack(raw,{...P.defaults(strategies),running:true},strategies));
}
console.log('PASS player configuration round trip, legacy defaults, tampering and transient exclusions:',n);

const crypto=require('node:crypto'),vm=require('node:vm'),fs=require('node:fs');
const H=require('../core/sync_sha256.js'),browser={TextEncoder};
vm.runInNewContext(fs.readFileSync(require.resolve('../core/sync_sha256.js'),'utf8'),browser);
for(const value of [null,false,0,'Brăila 🧊',[],{b:1,a:2},{a:2,b:1},
 {nested:[undefined,NaN,-0],omit:undefined},{'2':'two','1':'one',z:'last'}]){
 const expected=crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
 assert.equal(H.jsonChecksum(value),expected);
 assert.equal(browser.WargameSyncSha256.jsonChecksum(value),expected);
}
assert.notEqual(H.jsonChecksum({a:1,b:2}),H.jsonChecksum({b:2,a:1}));
const cyclic={};cyclic.self=cyclic;
assert.throws(()=>H.jsonChecksum(cyclic),TypeError);
assert.throws(()=>browser.WargameSyncSha256.jsonChecksum(cyclic),/circular/i);
const raw={format:'engine-save',state:{name:'Brăila'}};
const players={assignment:'both',german:'baseline',soviet:'capture'};
const packed=P.pack(raw,players,['baseline','capture']);
assert.equal(packed.playerSession.sha256,crypto.createHash('sha256').update(JSON.stringify([raw,{version:1,players}])).digest('hex'));
console.log('PASS ordinary JSON checksum compatibility and property order');
