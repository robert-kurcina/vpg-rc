const A=require('node:assert/strict'),P=require('../core/phase_runtime'),X=require('../core/phase_actions');
const registry=require('../maps/scenarios/registry.json');
let count=0;
for(const id of ['arduous','leningrad','kiev','kiev-odessa']){
 const c=require('../maps/phase-configs/'+id+'.json');A.equal(P.validate(c),true);
 const game=registry.games.find(x=>x.id===id);
 A.equal(game.mode,'historical-non-executable');
 A.equal(game.domains.phases.source,`maps/phase-configs/${id}.json`);
 let cur=P.start(c), steps=[];
 while(!cur.complete){steps.push(P.current(c,cur).id);cur=P.advance(c,cur,()=>true);A.ok(steps.length<100)}
 A.equal(steps.length,id==='leningrad'?70:id==='kiev-odessa'?68:61);A.equal(steps[0],'german-combat');
 A.equal(steps[id==='kiev-odessa'?8:7],'german-buildup');
 const begin=P.start(c), state={a:0};
 const b={config:c,cursor:begin,actor:'german',state,rules:{},complete:()=>true};
 A.throws(()=>X.execute(b,'declare-attack',{}),/No verified rules binding/);
 A.throws(()=>X.execute(b,'move',{}),/not permitted/);
 A.throws(()=>X.finish({...b,complete:undefined}),/No source-backed/);
 A.throws(()=>X.finish({...b,complete:()=>false}),/unfinished/);
 const next=X.finish(b); A.equal(P.current(c,next.cursor).id,'german-special-movement');
 const action={config:c,cursor:begin,actor:'german',state,rules:{'declare-attack':{
   legal:(s,cmd)=>cmd.valid===true&&s.a===0,
   apply:(s)=>{s.a++;return {ok:true,state:s,result:{changed:true}}}
 }}};
 A.equal(X.legal(action,'declare-attack',{valid:true}),true);
 A.equal(X.execute(action,'declare-attack',{valid:false}).ok,false);
 A.deepEqual(state,{a:0});
 const success=X.execute(action,'declare-attack',{valid:true});A.equal(success.ok,true);A.equal(success.state.a,1);A.equal(state.a,0);
 A.throws(()=>X.execute({...action,actor:'soviet'},'declare-attack',{valid:true}),/Wrong phase actor/);
 count++;
}
const base=require('../maps/phase-configs/kiev.json'), ext=require('../maps/phase-configs/kiev-odessa.json');
A.deepEqual(ext.phases.filter(p=>p.kind!=='naval-operations'),base.phases);A.equal(ext.extends,'kiev');
A.equal(ext.turns,base.turns);A.equal(ext.firstTurnStart,base.firstTurnStart);
console.log(`PASS ${count} historical phase bindings, 61/68/70-step schedules, permissions, fail-closed execution`);
