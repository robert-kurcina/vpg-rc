/* Generic coordinate registry: logical cell IDs and source-facing printed IDs.
 * Read-only. Never changes a board's physical centers or movement topology.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargamePrintedCoordinates=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function resolve(board,formatNumber){
  if(!board||!Array.isArray(board.cells)||typeof formatNumber!=='function')throw Error('Board and number formatter required');
  const byPrinted=new Map(),byInternal=new Map(),invalid=[],duplicates=[];
  for(const cell of board.cells){
   const printed=String(formatNumber(cell));
   if(!/^\d{4}$/.test(printed)){invalid.push({internal:cell.id,printed,reason:'not-four-digits'});continue;}
   const col=Number(printed.slice(0,2)),row=Number(printed.slice(2,4));
   if(col<1||row<1){invalid.push({internal:cell.id,printed,reason:'zero-or-negative-coordinate'});continue;}
   if(byPrinted.has(printed)){duplicates.push({printed,internal:[byPrinted.get(printed).id,cell.id]});continue;}
   byPrinted.set(printed,cell);byInternal.set(cell.id,printed);
  }
  return {byPrinted,byInternal,invalid,duplicates,complete:invalid.length===0&&duplicates.length===0&&byPrinted.size===board.cells.length,
   printedToInternal(printed){const cell=byPrinted.get(printed);return cell?.id||null;},
   internalToPrinted(internal){return byInternal.get(internal)||null;}};
 }
 return {resolve};
});
