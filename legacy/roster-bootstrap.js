/* Fail-closed roster validation before the existing Oberlabs UI starts.
 * Bound data is projected onto the legacy scenario shape to preserve replay hashes.
 */
(function(root){'use strict';
 const R=root.WargameRoster,L=root.WargameRosterLoader,scenario=root.B4M_SCENARIO;
 if(!R||!L||!scenario)throw Error('B4M shared roster bootstrap requires roster, loader and source scenario');
 const units=L.sourceUnits('battle-for-moscow');
 const roster=L.load('battle-for-moscow');
 const bound=R.bindExecutable(roster,units,'battle-for-moscow');
 if(scenario.units.length!==bound.length)throw Error('B4M browser/core roster unit count mismatch');
 const byId=new Map(bound.map(u=>[u.id,u]));
 const projected=scenario.units.map(raw=>{
  const authoritative=byId.get(raw.id);
  if(!authoritative)throw Error('Unknown B4M browser unit '+raw.id);
  for(const [k,v] of Object.entries(raw)){
   if(JSON.stringify(authoritative[k])!==JSON.stringify(v))throw Error('B4M browser roster discrepancy: '+raw.id+' / '+k);
  }
  return Object.fromEntries(Object.keys(raw).map(k=>[k,JSON.parse(JSON.stringify(authoritative[k]))]));
 });
 root.B4M_VERIFIED_SCENARIO={...scenario,units:projected};
 root.B4M_ROSTER_BOOTSTRAP={schemaVersion:1,game:'battle-for-moscow',units:roster.length,validated:true};
})(typeof globalThis!=='undefined'?globalThis:this);
