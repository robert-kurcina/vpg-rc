#!/usr/bin/env node
/* Use the *same* shared engine and presentation configuration as maps/index.html.
 * Produces self-contained SVG map artifacts with embedded original terrain assets.
 */
const fs=require('fs'), path=require('path'), cp=require('child_process'), crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'), T=require('../core/terrain_tiles'), P=require('../core/presentation'), composer=require('../maps/composer');
const registry=JSON.parse(fs.readFileSync(path.join(root,'maps/registry.json'),'utf8'));
const boards={};
for(const item of registry.maps){if(item.file)boards[item.id]=JSON.parse(fs.readFileSync(path.join(root,'maps',item.file),'utf8'));}
for(const item of registry.maps){if(item.compose)boards[item.id]=composer.compose(boards[item.compose.base],JSON.parse(fs.readFileSync(path.join(root,'maps',item.compose.extension),'utf8')));}
// Keep PNGs and SVGs synchronized by default; use --svg-only only for explicit SVG-only workflows.
const args=process.argv.slice(2), png=!args.includes('--svg-only');
if(args.includes('--png')&&args.includes('--svg-only'))throw Error('Choose --png or --svg-only, not both');
const dpiArg=args.find(a=>a.startsWith('--width='));const pngWidth=dpiArg?Number(dpiArg.slice(8)):null;
if(pngWidth!==null&&(!Number.isSafeInteger(pngWidth)||pngWidth<200||pngWidth>10000))throw Error('Invalid --width for PNG');
const dest=path.resolve(args.find(a=>!a.startsWith('--'))||path.join(root,'exports'));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(dest,{recursive:true});
const dataUri=(filepath)=>{const abs=path.resolve(root,filepath);const ext=path.extname(filepath).toLowerCase();const mime=ext==='.svg'?'image/svg+xml':ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg';return 'data:'+mime+';base64,'+fs.readFileSync(abs).toString('base64');};
const textureFiles=P.textures();
const textures=Object.fromEntries(P.KINDS.map(kind=>[kind,dataUri(textureFiles[kind])]));
const manifest=[];
for(const item of registry.maps){
 const board=boards[item.id];if(!board)throw Error('No board for '+item.id);
 const report=T.validate(board,{requireReciprocal:false});
 const profileAssets=Object.fromEntries(['fortificationArtwork','cityHexArtwork'].filter(k=>item.renderOptions?.[k]).map(k=>[k,dataUri(item.renderOptions[k])]));
 const opts=P.options(item.id,{id:'export-'+item.id,textures,showGrid:true,showNumbers:true,showWaterBodies:true,showEntryEdges:true,...profileAssets});
 const svg=T.svgMap(board,opts);
 const output=path.join(dest,item.id+'.svg');fs.writeFileSync(output,svg,'utf8');
 const entryLayer=svg.match(/data-layer="entry-edges"[\s\S]*?<\/g\>/)?.[0]||'';
 const entryStrokes=(svg.match(/class="entry-boundary /g)||[]).length;
 const info={id:item.id,title:item.title,hexes:board.cells.length,file:path.basename(output),svgSHA256:digest(svg),viewBox:svg.match(/viewBox="([^"]+)"/)?.[1],entryStrokes,errors:report.errors.slice(0,10),warnings:report.warnings.slice(0,10),visualStatus:board.sourceStatus||board.playabilityStatus||'scenario-based'};
 if(png){const pngPath=path.join(dest,item.id+'.png');const c=cp.spawnSync('inkscape',[output,'--export-filename='+pngPath,...(pngWidth===null?[]:['--export-width='+pngWidth])],{encoding:'utf8'});if(c.error||c.status!==0)throw Error('PNG export needs Inkscape: '+(c.error?.message||c.stderr));info.png=path.basename(pngPath);info.pngSHA256=digest(fs.readFileSync(pngPath));}else{const pngPath=path.join(dest,item.id+'.png');if(fs.existsSync(pngPath))fs.unlinkSync(pngPath);}
 manifest.push(info);console.log(JSON.stringify(info));
}
fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
// Keep chart specimens synchronized with the actual map artwork, including
// Romanian outlines and rail z-order.  Never synthesize separate chart icons.
if(png && dest===path.join(root,'exports')){
 const update=cp.spawnSync('python3',[path.join(root,'scripts/build-kiev-terrain-chart-art.py')],{cwd:root,encoding:'utf8'});
 if(update.error||update.status!==0)throw Error('Kiev terrain chart sample build failed: '+(update.error?.message||update.stderr));
 process.stdout.write(update.stdout);
}
