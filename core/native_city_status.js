/* Read-only city ownership view model for the shared native session.
 * Source of truth: the engine's city cells, state.control (last entrant), and
 * live units. Map labels are borrowed from the same registered visual cells.
 * No ownership, victory, or tournament rules are implemented here.
 */
(function(root,factory){
 const E=(typeof module==='object'&&module.exports)?require('./engine.js'):root.WargameCore;
 const Tournament=(typeof module==='object'&&module.exports)?require('./native_tournament_scoring.js'):root.WargameNativeTournamentScoring;
 const api=factory(E,Tournament);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameNativeCityStatus=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E,Tournament){
'use strict';
const key=(x,y)=>`${x},${y}`;
const hex=(x,y)=>`${String(x+1).padStart(2,'0')}${String(y+1).padStart(2,'0')}`;
function decisionCells(predicate,out){
 if(!predicate||typeof predicate!=='object')return;
 if(predicate.type==='controls'&&Array.isArray(predicate.cell)&&predicate.cell.length===2)
  out.add(key(predicate.cell[0],predicate.cell[1]));
 for(const p of predicate.children||[])decisionCells(p,out);
 if(predicate.child)decisionCells(predicate.child,out);
}
function read(session,visualBoard){
 if(!session?.config?.cells||!session.state||!E)throw Error('City status requires a native shared-engine session');
 const {config:g,state:s}=session;
 const sides=new Set((g.game.factions||[]).map(f=>f.id));
 const labels=new Map();
 for(const cell of visualBoard?.cells||[]){
  const p=cell.sourceRef;
  if(!p||!Number.isInteger(p.x)||!Number.isInteger(p.y))continue;
  const markers=(cell.tileMarkers||[]).filter(m=>['city','majorCity'].includes(m.kind)&&typeof m.label==='string'&&m.label.trim());
  if(markers.length>1)throw Error('Conflicting city labels in visual map: '+key(p.x,p.y));
  if(markers.length){
   const id=key(p.x,p.y);
   if(labels.has(id)&&labels.get(id)!==markers[0].label)throw Error('Conflicting city labels for '+id);
   labels.set(id,markers[0].label);
  }
 }
 const objectives=new Set();
 for(const d of g.objectives.victory?.decisions||[])decisionCells(d.if,objectives);
 const cities=[];
 for(const c of g.cells.values()){
  if(!c.city||c.city==='none')continue;
  const id=key(c.x,c.y),owner=s.control[id]||null;
  if(owner&&!sides.has(owner))throw Error('Unknown city owner '+owner+' at '+id);
  const occupants=s.units.filter(u=>u.position?.x===c.x&&u.position?.y===c.y&&u.strength!=='dead'&&!E.support(u));
  if(occupants.some(u=>!sides.has(E.unitSide(u))))throw Error('Unknown city garrison at '+id);
  const occupyingSides=new Set(occupants.map(u=>E.unitSide(u)));
  if(occupyingSides.size>1)throw Error('Mixed-faction city occupation at '+id);
  // A newly occupied city must belong to its current non-support entrant.
  if(occupants.length&&owner!==E.unitSide(occupants[0]))throw Error('City ownership and occupant diverge at '+id);
  cities.push({id,hex:hex(c.x,c.y),name:labels.get(id)||hex(c.x,c.y),
   owner,occupants:occupants.map(u=>u.id),objective:objectives.has(id)});
 }
 cities.sort((a,b)=>a.hex.localeCompare(b.hex));
 const counts=Object.fromEntries([...sides].map(side=>[side,cities.filter(c=>c.owner===side).length]));
 counts.unclaimed=cities.filter(c=>!c.owner).length;
 const tournament=g.objectives.tournamentVariant;
 const tournamentPreview=tournament?.status==='reference-scoring-only'?Tournament.read(g,s,tournament):null;
 return {cities,counts,total:cities.length,
  evaluated:s.over,verdict:s.over?s.winner:E.result(g,s),
  evaluationPolicy:g.objectives.victory?.evaluation||'end-of-campaign',
  tournamentAvailable:false, // The mandatory reserve-redeployment setup is not available.
  tournamentStatus:tournament?.status||null,tournamentPreview};
}
return {read};
});
