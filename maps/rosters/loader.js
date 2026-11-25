/* Universal historical roster loader: same contract in Node and browser. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameRosterLoader=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const R=root.WargameRoster||(typeof require==='function'?require('../../core/roster'):null);
 const browserData=root.WargameRosterBrowserData;
 const fs=typeof require==='function'?require('node:fs'):null;
 const path=typeof require==='function'?require('node:path'):null;
 const base=path?path.resolve(__dirname,'../..'):null;
 function read(p){
  if(browserData){if(!Object.prototype.hasOwnProperty.call(browserData.files,p))throw Error('Roster browser source missing '+p);return JSON.parse(JSON.stringify(browserData.files[p]));}
  if(!fs||!base)throw Error('No roster source provider');
  return JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
 }
 const entries=read('maps/rosters/registry.json').entries;
 function load(id){
  const entry=entries.find(e=>e.id===id);
  if(!entry)throw Error('Unknown roster '+id);
  if(entry.adapter==='canonical-engine-unit')return R.fromB4M(read(entry.units),read(entry.counterConfig));
  if(entry.adapter==='printed-pair')return R.fromPrintedPairs(id,read(entry.counterConfig));
  if(entry.adapter==='composite-overlay')return R.compose(load(entry.base),R.fromOverlay(id,read(entry.overlay),read(entry.counterConfig)));
  throw Error('Unsupported roster adapter '+entry.adapter);
 }
 function sourceUnits(id){
  const entry=entries.find(e=>e.id===id);
  if(!entry||entry.adapter!=='canonical-engine-unit')throw Error('No canonical executable units for '+id);
  return read(entry.units).units;
 }
 return {load,sourceUnits,list:()=>entries.map(e=>({id:e.id,status:e.status})),validate:R.validate,select:R.select};
});
