/* v1.4: Soviet capital-defense decision layer, using the original game rules.
   No changes to movement legality, replacements, CRT, reinforcement arrival, or victory. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B4MSovietDefense=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const E=typeof B4MEngine!=='undefined'?B4MEngine:require('./engine.js');
const B=typeof B4MOpeningBook!=='undefined'?B4MOpeningBook:require('./opening-book.js');
const M={x:10,y:2}, K=p=>`${p.x},${p.y}`;
const clone=v=>JSON.parse(JSON.stringify(v));
const near=(p,q=M)=>E.dist(p.x,p.y,q.x,q.y);
const isOn=(u,p)=>u?.position&&u.position.x===p.x&&u.position.y===p.y;
function shock(s){return s.units.find(u=>u.army==='soviet'&&u.type==='shock');}
function ring(c){return E.neighbours(c,10,2).map(p=>({x:p.x,y:p.y}));}
function germanThreat(c,s,p){let g=E.units(s,'german');let adj=g.filter(u=>near(u.position,p)===1),near2=g.filter(u=>near(u.position,p)<=2);return {adjacent:adj.length,adjacentStrength:adj.reduce((x,u)=>x+E.strength(u),0),near2:near2.length};}
function screenMetrics(c,s){const r=ring(c),sv=E.units(s,'soviet'),a=r.map(p=>{const occ=E.occupant(s,p.x,p.y),z=E.neighbours(c,p.x,p.y).some(n=>E.occupant(s,n.x,n.y)?.army==='soviet');const th=germanThreat(c,s,p);return {...p,occupied:occ?.army||null,occupant:occ?.id||null,reducedSoviet:occ?.army==='soviet'&&occ.strength==='reduced',zoc:z,threat:th};});
 return {garrison:E.occupant(s,10,2)?.id||null,shock:shock(s)?.position||null,ringSoviet:a.filter(v=>v.occupied==='soviet').length,ringReduced:a.filter(v=>v.reducedSoviet).length,ringGerman:a.filter(v=>v.occupied==='german').length,ringZoc:a.filter(v=>v.zoc).length,ringZocUnderThreat:a.filter(v=>v.zoc&&v.threat.near2).length,adjacentGermanStrength:germanThreat(c,s,M).adjacentStrength,ring:a};}
function scorePosition(c,s,u,p,mode){const h=E.hexAt(c,p.x,p.y),d=near(p),tr=germanThreat(c,s,p),moscowOcc=E.occupant(s,10,2),ownCapital=moscowOcc?.army==='soviet';
 if(isOn(u,M))return 100000;
 if(u.type==='shock'){
   // Move the reinforced 10-factor army toward the capital while preserving the
   // existing garrison until a complete, legal relief can be executed.
   let score=330-d*72+(d===1?270:0)+(h?.rail?.length?13:0);
   if(d===1&&tr.adjacentStrength>20)score-=45;
   return score;
 }
 const reduced=u.strength==='reduced';
 let score= -d*24 + (d<=1?60:d===2?43:0) + (h?.terrain==='fortification'?55:0) + (h?.city==='major'?16:0);
 // Reduced 4-factor formations form a delaying ZOC curtain; keep full 8-factor
 // formations as a reserve or counterattack force when possible.
 if(reduced){score+=(d<=2?95:0)+(d===1?55:0)+Math.min(3,tr.near2)*19;}
 else {score+=(d===1?13:0)+(d===2?34:0)+Math.min(3,tr.near2)*11;}
 if(ownCapital&&d<=2){
  // Reward overlapping ZOCs on accessible ring squares rather than a mere
  // unit-count around Moscow. This values screen geometry against breakthroughs.
  let coverage=ring(c).filter(x=>near(x,p)===1&&E.occupant(s,x.x,x.y)?.army!=='german').length;
  score+=coverage*(reduced?17:9);
 }
 if(tr.adjacentStrength>0&&reduced)score-=tr.adjacentStrength*.7;
 if(mode==='rail'&&d>2)score-=8;
 return score;
}
function scoreAction(c,s,u,p,mode){const before=scorePosition(c,s,u,u.position,mode);const old=u.position;u.position={x:p.x,y:p.y};const after=scorePosition(c,s,u,u.position,mode);u.position=old;
 const current=E.hexAt(c,old.x,old.y),emphasis= current?.city==='major'&&s.control[K(old)]==='soviet'&&near(old)>1?50:0;
 return after-before-emphasis;
}
function placeShock(c,s){const options=E.shockReinforcementOptions(c,s);if(!options.length)return false;
 const evaluated=options.map(p=>{
  let v=clone(s);E.performShockReinforcement(c,v,p);
  const u=shock(v),rail=E.legalMoves(c,v,u,'rail');
  const normals=E.legalMoves(c,v,u,'normal');
  const nearest=Math.min(near(p),...rail.map(x=>near(x)),...normals.map(x=>near(x)));
  // Immediate rail connectivity into the inner ring gets priority.
  const accessibleRing=rail.some(x=>near(x)===1);
  return {p,nearest,accessibleRing,railCount:rail.length,score:(accessibleRing?1000:0)-nearest*120+rail.length*2-near(p)};
 }).sort((a,b)=>b.score-a.score||a.p.x-b.p.x||a.p.y-b.p.y);
 const placed=E.performShockReinforcement(c,s,evaluated[0].p);
 s.log.push({t:s.turn,side:'soviet',type:'soviet-defender-shock-route',options:evaluated,selected:evaluated[0].p});
 return placed;
}
function replacementScore(c,s,r){const u=s.units.find(v=>v.id===r.id),p=r.type==='enter'?r:u.position,d=near(p),onM=d===0,occ=E.occupant(s,10,2);
 if(r.type==='restore'&&onM)return 10000;
 if(r.type==='enter'&&onM&&!occ)return 9000+u.combatReduced;
 if(r.type==='enter'){
  const h=E.hexAt(c,p.x,p.y),screen=p&&d<=2,th=germanThreat(c,s,p),freeScreen=screen&&(d===1||d===2);
  return 350+(freeScreen?350:0)+Math.min(3,th.near2)*40-d*38+(h?.terrain==='fortification'?90:0)+(u.type==='shock'?60:0);
 }
 // Save reduced 4-factor formations inside the defensive ring to retain ZOC
 // coverage; restoration of the Moscow garrison has already taken precedence.
 const h=E.hexAt(c,p.x,p.y),th=germanThreat(c,s,p);
 return 260 -d*18+(h?.terrain==='fortification'?80:0)+(th.adjacentStrength>0?120:0)+(d<=2?25:0)+(d===1&&u.strength==='reduced'?-90:0);
}
function replace(c,s){let used=[];const count=E.replacementBudget(c,s);
 for(let i=0;i<count;i++){
  const options=E.replacementOptions(c,s);if(!options.length)break;
  const ranked=options.map(r=>({r,score:replacementScore(c,s,r)})).sort((a,b)=>b.score-a.score||a.r.id.localeCompare(b.r.id));
  if(!E.applyReplacement(c,s,ranked[0].r))throw Error('Rejected legal Soviet replacement');used.push(ranked[0].r);
 }
 s.log.push({t:s.turn,side:'soviet',type:'soviet-defender-replacements',used});return used;
}
function planRelief(c,s){const old=E.occupant(s,10,2),sh=shock(s);
 if(!old||old.army!=='soviet'||!sh?.position||old.id===sh.id||E.strength(sh)<=E.strength(old))return false;
 if(near(sh.position)!==1)return false;
 const candidates=E.legalMoves(c,s,old,'normal').filter(h=>!E.occupant(s,h.x,h.y)&&!E.neighbours(c,h.x,h.y).some(n=>E.occupant(s,n.x,n.y)?.army==='german'));
 const viable=[];
 for(const p of candidates){const next=clone(s);
  if(!E.move(c,next,old.id,p.x,p.y))continue;
  if(!E.legalMoves(c,next,next.units.find(u=>u.id===sh.id),'normal').some(h=>h.x===10&&h.y===2))continue;
  const th=germanThreat(c,next,p),terrain=E.hexAt(c,p.x,p.y);
  let score=(terrain?.terrain==='fortification'?60:0)+(near(p)<=2?35:0)+(terrain?.city==='major'?20:0)-th.adjacentStrength*2-near(p)*8;
  viable.push({p,score});
 }
 viable.sort((a,b)=>b.score-a.score||a.p.x-b.p.x||a.p.y-b.p.y);
 if(!viable.length){s.log.push({t:s.turn,side:'soviet',type:'soviet-defender-relief-blocked',current:old.id,shock:sh.id});return false;}
 const target=viable[0].p; if(!E.move(c,s,old.id,target.x,target.y))throw Error('Relief first leg failed');
 if(!E.move(c,s,sh.id,10,2))throw Error('Relief second leg failed');
 s.log.push({t:s.turn,side:'soviet',type:'soviet-defender-relief',out:old.id,in:sh.id,to:target});return {from:old.id,to:sh.id};
}
function moveDefenders(c,s,mode,exclude=new Set()){const moved=[];
 // Shock gets the earliest rail slot to approach Moscow. Then move the fragile
 // screen units before strong reserves, avoiding displacement of the garrison.
 const candidates=E.units(s,'soviet').slice().sort((a,b)=>(a.type==='shock'?-1:0)-(b.type==='shock'?-1:0)||(a.strength==='reduced'?-1:0)-(b.strength==='reduced'?-1:0)||near(a.position)-near(b.position)||a.id.localeCompare(b.id));
 for(const u of candidates){if(isOn(u,M)||exclude.has(u.id))continue;
  if(mode==='rail'&&!(E.hexAt(c,u.position.x,u.position.y)?.rail||[]).length)continue;
  const choices=E.legalMoves(c,s,u,mode);
  let best=null,delta=0;
  for(const p of choices){const d=scoreAction(c,s,u,p,mode);
   if(d>delta+0.1){best=p;delta=d;}
  }
  if(best&&E.move(c,s,u.id,best.x,best.y,mode)){moved.push({id:u.id,to:{x:best.x,y:best.y},gain:Math.round(delta)});}
 }
 if(mode==='normal'){
  // A legal garrison handoff is a paired two-unit movement, never an illegal swap.
  // Attempt it after screening rail movements and before conventional movement.
 }
 s.log.push({t:s.turn,side:'soviet',type:'soviet-defender-moves',mode,moved});return moved;
}
function playSide(c,base,options={}){
 if(base.side!=='soviet')throw Error('Soviet defense requires Soviet-to-move state');
 const s=clone(base);if(s.over)return s;
 if(s.turn===4)placeShock(c,s);
 replace(c,s);
 moveDefenders(c,s,'rail');
 // Keep combat declaration/CRT/resolution from the original engine; avoid
 // attacking aggressively when the main job is holding capital screens.
 if(options.counterattacks!==false)E.strategicCombat(c,s,'conserve','soviet');
 const relief=planRelief(c,s);
 const moved=moveDefenders(c,s,'normal',relief?new Set([relief.from,relief.to]):new Set());
 // Never issue a second normal move to the units used for a garrison relief.
 s.log.push({t:s.turn,side:'soviet',type:'soviet-defense-end',relief:!!relief,metrics:screenMetrics(c,s)});
 E.endSide(c,s);E.validate(c,s);return s;
}
function playFromOpening(c,s,g='G2',so='S2',options={}){
 if(s.side==='soviet')return playSide(c,s,options);
 const C=typeof B4MCapitalAssault!=='undefined'?B4MCapitalAssault:require('./capital-assault.js');
 return C.playFromOpening(c,s,g,so,{beginTurn:options.beginTurn||5});
}
return {screenMetrics,germanThreat,placeShock,replace,planRelief,moveDefenders,playSide,playFromOpening,scoreAction};
});
