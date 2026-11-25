const assert=require('node:assert/strict');const P=require('../core/player_save_config.js');
let n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++;};const throws=(fn)=>{assert.throws(fn);n++;};
for(const strategies of [['diagnostic','operational','reserve-relief'],['baseline','objective','capture']]){
 const raw={format:'engine-save',version:1,state:{seed:42},integrity:{digest:'engine-owned'}};
 eq(P.pack(raw,P.defaults(strategies),strategies),raw);eq(P.unpack(raw,strategies),{save:raw,players:P.defaults(strategies)});
 for(const assignment of ['manual','german','soviet','both'])for(const german of strategies)for(const soviet of strategies){const players={assignment,german,soviet};const encoded=P.pack(raw,players,strategies);eq(P.unpack(JSON.parse(JSON.stringify(encoded)),strategies),{save:raw,players});if(encoded.playerSession){const changed=structuredClone(encoded);changed.state.seed++;throws(()=>P.unpack(changed,strategies));const other=structuredClone(encoded);other.playerSession.players.assignment='invalid';throws(()=>P.unpack(other,strategies));}}
 throws(()=>P.pack(raw,{assignment:'both',german:'wrong',soviet:strategies[0]},strategies));throws(()=>P.pack(raw,{...P.defaults(strategies),running:true},strategies));
}
console.log('PASS player configuration round trip, legacy defaults, tampering and transient exclusions:',n);
