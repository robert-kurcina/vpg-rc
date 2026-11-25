'use strict';
// Capture or verify the unchanged v316 executable B4M baseline.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const E=require('../../legacy/engine-v316-frozen.js');
const base=path.resolve(__dirname,'../..');
const raw=JSON.parse(fs.readFileSync(path.join(base,'legacy/data/scenario.json')));
const profileData=JSON.parse(fs.readFileSync(path.join(base,'legacy/data/rules_profiles.json')));
const profile=profileData.profiles[profileData.defaultRuleset];
const c=E.buildScenario(raw,profile);
const sha=obj=>crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const seed=123456;
let s=E.makeState(c,seed);
const snapshots=[];
function record(label){E.validate(c,s);const compact={turn:s.turn,side:s.side,phase:s.phase,seed:s.seed,ply:s.ply,over:s.over,winner:s.winner,units:s.units.map(u=>[u.id,u.strength,u.position]),control:Object.entries(s.control).sort(),log:s.log};snapshots.push({label,turn:s.turn,side:s.side,phase:s.phase,seed:s.seed,unitHash:sha(compact.units),controlHash:sha(compact.control),logHash:sha(compact.log),stateHash:sha(compact)});}
record('auto-setup');
const firstGerman=s.units.find(u=>u.army==='german'&&u.position);
const firstMoves=E.legalMoves(c,s,firstGerman).map(x=>({x:x.x,y:x.y,cost:x.cost,path:x.path}));
const firstCandidates=E.attackCandidates(c,s).map(a=>({defender:a.defender,attackers:a.attackers,odds:a.odds,modifiers:a.modifiers}));
const probes={initialUnitCount:s.units.length,initialSide:s.side,firstGermanUnit:firstGerman.id,firstMovesHash:sha(firstMoves),firstMovesCount:firstMoves.length,firstCandidatesHash:sha(firstCandidates),firstCandidatesCount:firstCandidates.length,crtHash:sha(profile.crtByOdds),replacementBudget:E.replacementBudget(c,s),mudTurns:profile.mudTurns};
const turns=[];
for(let i=0;i<14&&!s.over;i++){
 const before={turn:s.turn,side:s.side};
 s=E.playSide(c,s,'balanced');
 const events=s.log.filter(ev=>ev.t===before.turn&&ev.side===before.side);
 turns.push({...before,actions:events.length,eventsHash:sha(events)});
 record(`after-${before.side}-turn-${before.turn}`);
}
const output={schema:1,baseline:'v316',engineSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(base,'legacy/engine-v316-frozen.js'))).digest('hex'),scenarioSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(base,'legacy/data/scenario.json'))).digest('hex'),profileSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(base,'legacy/data/rules_profiles.json'))).digest('hex'),policy:'balanced',seed,probes,turns,snapshots};
const target=path.join(__dirname,'fixtures/b4m-balanced-seed123456.json');
if(process.argv.includes('--write')){fs.writeFileSync(target,JSON.stringify(output,null,2)+'\n');console.log('WROTE '+target);}else {const previous=JSON.parse(fs.readFileSync(target));assert.deepStrictEqual(output,previous,'B4M frozen baseline diverged');console.log(`PASS B4M v316 frozen trace: ${snapshots.length} states, ${turns.length} half-turns`);}
