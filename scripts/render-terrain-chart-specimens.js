#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const cp=require('child_process');
const root=path.resolve(__dirname,'..');
const T=require(path.join(root,'core/terrain_tiles'));
const P=require(path.join(root,'core/presentation'));
const composer=require(path.join(root,'maps/composer'));
const registry=require(path.join(root,'maps/registry.json')).maps;
const chart=require(path.join(root,'maps/presentation/kiev-terrain-effects.json'));
const MAPS={};
for(const item of registry){try{MAPS[item.id]=require(path.join(root,'maps',item.file));}catch{}}
MAPS['kiev-odessa']=composer.compose(require(path.join(root,'maps/kiev.json')),require(path.join(root,'maps/odessa-extension.json')));
const CANVAS={width:140,height:130,padding:10,center:[70,65],rx:37.8,ry:37.8};
function mimeFor(file){const ext=path.extname(file).toLowerCase(); if(ext==='.svg')return 'image/svg+xml'; if(ext==='.png')return 'image/png'; if(ext==='.webp')return 'image/webp'; if(ext==='.jpg'||ext==='.jpeg')return 'image/jpeg'; throw new Error('Unsupported asset type '+file);}
function dataUri(file){const abs=path.join(root,file); return 'data:'+mimeFor(file)+';base64,'+fs.readFileSync(abs).toString('base64')}
function clone(v){return JSON.parse(JSON.stringify(v));}
function sourceMapId(row){return row.sampleMap||'kiev';}
function sourceBundle(row){const sourceMap=sourceMapId(row),board=MAPS[sourceMap]; if(!board)throw new Error('Missing map '+sourceMap+' for '+row.id); const cell=board.cells.find(c=>c.id===row.sampleHex); if(!cell)throw new Error('Missing sample hex '+row.sampleHex+' on '+sourceMap+' for '+row.id); const profile=registry.find(item=>item.id===sourceMap); if(!profile)throw new Error('Missing map profile '+sourceMap); return {sourceMap,board,cell:clone(cell),profile};}
function bareCell(source,row,terrainOverride=null){const cell=clone(source.cell); cell.id=row.sampleHex; cell.column=1; cell.row=1; cell.pixelCenter=[...CANVAS.center]; cell.tileMarkers=[]; cell.tileEdges={}; cell.city=undefined; delete cell.objective; if(terrainOverride)cell.terrain=terrainOverride; return cell;}
function marker(kind,extra={}){return {kind,label:'',status:'tec-engine-specimen',...extra};}
function hexVertices(cx,cy,rx,ry){return [0,60,120,180,240,300].map(a=>[cx+rx*Math.cos(a*Math.PI/180),cy+ry*Math.sin(a*Math.PI/180)]);}
function specimenBoard(row){
 const source=sourceBundle(row);
 const cell=bareCell(source,row);
 const board={id:'tec-specimen-'+row.id,sourceGame:'TEC specimen '+row.name,geometry:{columnParityDown:'even'},cells:[cell]};
 switch(row.id){
  case 'open': case 'forest': case 'swamp': cell.terrain=row.id; break;
  case 'fortification': {
   const fort=source.cell.tileMarkers?.find(m=>m.kind==='fortification');
   if(!fort)throw Error('Fortification specimen must come from an actual source marker');
   cell.tileMarkers=[clone(fort)];break;
  }
  case 'city': cell.terrain='open'; cell.tileMarkers=[marker('city')]; break;
  case 'major-city': cell.terrain='open'; cell.tileMarkers=[marker('majorCity')]; break;
  case 'river': cell.terrain='open'; cell.tileEdges={N:[{kind:'river',status:'tec-engine-specimen'}],NE:[{kind:'river',status:'tec-engine-specimen'}],SE:[{kind:'river',status:'tec-engine-specimen'}]}; break;
  case 'major-river': cell.terrain='open'; cell.tileEdges={N:[{kind:'majorRiver',status:'tec-engine-specimen'}],NE:[{kind:'majorRiver',status:'tec-engine-specimen'}],SE:[{kind:'majorRiver',status:'tec-engine-specimen'}]}; break;
  case 'coast': {
   cell.terrain='sea';
   board.sourceCoastRenderingMode='exact-source-paths';
   board.sourceCoastStrokeWidth=7;
   board.sourceCoastColor='#275a80';
   const v=hexVertices(CANVAS.center[0],CANVAS.center[1],CANVAS.rx,CANVAS.ry);
   board.sourceWaterRoutes=[{kind:'coast',sourceSvgId:'tec-coast-top-three',points:[v[3],v[4],v[5],v[0]]}];
   break;
  }
  case 'lake': {
   cell.terrain='open';
   board.sourceLakeRenderingMode='exact-source-paths';
   board.sourceLakeStrokeWidth=16;
   board.sourceLakeColor='#30b9bf';
   const v=hexVertices(CANVAS.center[0],CANVAS.center[1],CANVAS.rx,CANVAS.ry);
   board.sourceWaterRoutes=[{kind:'lake',sourceSvgId:'tec-lake-smooth-joint',points:[v[5],v[0],v[1]]}];
   break;
  }
  case 'sea': cell.terrain='sea'; break;
  case 'railroad': cell.terrain='open'; cell.tileEdges={NE:[{kind:'rail',status:'tec-engine-specimen'}],SW:[{kind:'rail',status:'tec-engine-specimen'}]}; break;
  case 'deployment':
   cell.terrain='open';
   cell.tileMarkers=[
    marker('cross',{faction:'german'}),
    marker('star',{faction:'soviet'}),
    marker('fixedInfantry',{faction:'german'}),
    marker('fixedCavalry',{faction:'soviet'}),
    marker('fixedMechanized',{faction:'german'})
   ];
   break;
  case 'romanian': case 'bessarabia': cell.terrain='open'; break;
  default: throw new Error('Unhandled terrain chart row '+row.id);
 }
 return {source,board};
}
function renderOptions(row,profile){
 const sourceMap=sourceMapId(row);
 const textures=Object.fromEntries(P.KINDS.map(kind=>[kind,dataUri(P.textures()[kind])]));
 const custom={id:'tec-specimen-'+row.id,textures,showGrid:true,showNumbers:false,showWaterBodies:!['sea','coast','lake'].includes(row.id),showEntryEdges:false,width:CANVAS.width,height:CANVAS.height,padding:CANVAS.padding,rx:CANVAS.rx,ry:CANVAS.ry,hexRegionOutlines:[]};
 if(row.id==='deployment')custom.deploymentMarkerLayout={useStandardScale:true,slotOffsets:[{dx:-11,dy:-16},{dx:11,dy:-16},{dx:-11,dy:0},{dx:11,dy:0},{dx:0,dy:16}]};
 for(const key of ['fortificationArtwork','cityHexArtwork']) if(profile.renderOptions?.[key]) custom[key]=dataUri(profile.renderOptions[key]);
 const opts=P.options(sourceMap,custom);
 if(row.id==='romanian' || row.id==='bessarabia'){
  const regionId=row.id==='romanian'?'romanian-turn1-setup':'bessarabia';
  const base=(profile.renderOptions?.hexRegionOutlines||[]).find(item=>item.id===regionId);
  if(!base)throw new Error('Missing outline '+regionId+' on '+sourceMap);
  opts.hexRegionOutlines=[{...clone(base),hexes:[row.sampleHex]}];
 }
 return opts;
}
function outDirFor(row){return path.join(root,'assets','terrain-chart',sourceMapId(row));}
const supplemental=[{id:'fortification',name:'Fortification',sampleHex:'0501',sampleMap:'battle-for-moscow'}];
let count=0;
for(const row of [...chart.rows,...supplemental]){
 const {source,board}=specimenBoard(row);
 const opts=renderOptions(row,source.profile);
 const svg=T.svgMap(board,opts);
 const outDir=outDirFor(row); fs.mkdirSync(outDir,{recursive:true});
 const stem=path.join(outDir,row.id); const svgFile=stem+'.svg', pngFile=stem+'.png';
 fs.writeFileSync(svgFile,svg,'utf8');
 const run=cp.spawnSync('inkscape',[svgFile,'--export-filename='+pngFile],{encoding:'utf8'});
 if(run.error||run.status!==0)throw new Error('Inkscape export failed for '+row.id+': '+(run.error?.message||run.stderr||run.stdout));
 fs.unlinkSync(svgFile); console.log(`${row.id.padStart(12)} ${path.relative(root,pngFile)}`); count++;
}
console.log('Rendered',count,'terrain-chart specimens from the shared engine.');
