'use strict';
/* Native browser compatibility must not change the Node source-of-truth rules,
 * session format, or Battle for Moscow's production legacy route. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const sha=require('../core/sync_sha256.js').sha256;
const native=require('../core/native_session_actions.js');
const saver=require('../core/native_session_save.js');
const S=require('../core/session.js'),E=require('../core/engine.js');
const projected=require('../core/native_preview_config.js');
const {load}=require('../tools/audit-b4m-native-preview-v360.js');
const {original,config}=load(),g=E.build(projected.project(original,config));
let hashes=0,saves=0;
for(const msg of ['', 'abc', 'SHA-256: AIGen', 'Çöму🧊', 'The quick brown fox jumps over the lazy dog', 'ab'.repeat(200000)]){
 assert.equal(sha(msg),crypto.createHash('sha256').update(msg).digest('hex'));hashes++;
}
for(const seed of [1,17,101,1941,0xffffffff]){
 let session=S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state:E.start(g,seed,'auto-reference')});
 const initial=S.serialize(session);
 assert.equal(initial.sha256,crypto.createHash('sha256').update(JSON.stringify((({sha256,...p})=>p)(initial))).digest('hex'));
 const c=S.execute(session,{type:'finish-phase'});
 assert(c.ok);session=c.session;
 const candidates=session.state.units.filter(u=>u.army===session.state.side&&u.position)
  .map(u=>({id:u.id,moves:S.legal(session,{type:'move',unitId:u.id})})).find(x=>x.moves.length);
 assert(candidates);
 const m=candidates.moves[0];
 const r=S.execute(session,{type:'move',unitId:candidates.id,x:m.x,y:m.y});assert(r.ok);
 session=r.session;
 const payload=S.serialize(session),restored=S.restore(JSON.parse(JSON.stringify(payload)),{scenarioId:g.game.id,engine:'generic-hex-v1',config:g});
 assert.deepEqual(restored.state,session.state);assert.deepEqual(restored.history,session.history);
 assert.deepEqual(S.undo(restored).session.state,c.session.state);
 saves++;
}
assert.equal(original.game.engine,'generic-hex-v1');
assert.equal(require('../games/battle-for-moscow/game.json').engine,'generic-hex-v1');
assert.equal(typeof native.execute,'function');assert.equal(typeof saver.serialize,'function');
const source=fs.readFileSync(path.join(root,'core/native_browser_view.js'),'utf8');
assert(!/require\(['"]\.\.\/legacy/.test(source),'Browser view must not import legacy engine');
assert(source.includes('S.execute('),'Browser actions must use the shared session');
assert(!source.includes("'battle-for-moscow'"),'Browser code must not branch on scenario name');
assert(source.includes('T.svgMap('),'Browser map must use universal renderer');
assert(source.includes('Counters.piece('),'Browser counters must use official shared template');
const html=fs.readFileSync(path.join(root,'games/battle-for-moscow/native-preview/index.html'),'utf8');
assert(html.includes('native_browser_view.js'));
assert(html.includes('native_session_actions.js')&&html.includes('native_session_save.js'));
for(const ref of html.matchAll(/(?:src|href)="(\.{1,2}\/[^"#]+)"/g)){
 assert(fs.existsSync(path.resolve(root,'games/battle-for-moscow/native-preview',ref[1])),`Missing browser dependency ${ref[1]}`);
}
console.log(JSON.stringify({status:'PASS',checkpoint:133,hashes,saves,productionEngine:original.game.engine,sharedActionApi:true,sharedRendering:true}));
