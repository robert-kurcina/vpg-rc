#!/usr/bin/env node
/* Actual shared-engine export + source/geometry diagnostic layer.
 * The diagnostic is never loaded by the gameplay renderer.
 */
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const T=require('../core/terrain_tiles');
const Compose=require('../maps/composer');
const Border=require('../core/composite_entry_border_reconciliation');
const evidence=require('../maps/movement-configs/odessa-entry-border-geometry-v527.json');
const map=Compose.compose(require('../maps/kiev.json'),require('../maps/odessa-extension.json'));
const diag=Border.reconcile(map,evidence);
const cells=new Map(map.cells.map(c=>[c.id,c]));
const [rx,ry]=T.gridRadii(map.geometry);
const p=T.hexPoints(rx,ry);
const sides={N:[p[4],p[5]],NE:[p[5],p[0]],SE:[p[0],p[1]],S:[p[1],p[2]],SW:[p[2],p[3]],NW:[p[3],p[4]]};
const pt=v=>Number(v).toFixed(2);
let out='<g data-layer="border-topology-diagnostic" data-gameplay-authorized="false" pointer-events="none">';
for(const side of ['german','soviet']){
 for(const status of ['exterior','internal']){
  const rec=status==='exterior'?diag.activePaths[side]:diag.paths[side];
  const isWarning=status==='internal';
  const color=isWarning?'#df340a':side==='soviet'?'#166b35':'#175cb0';
  const lineWidth=isWarning?6.2:4.5;
  for(const item of rec[status]){
   const center=cells.get(item.hex).pixelCenter;
   const [a,b]=sides[item.dir];
   const x1=center[0]+a[0],y1=center[1]+a[1],x2=center[0]+b[0],y2=center[1]+b[1];
   const label=item.hex+' '+item.dir+(isWarning?' (legacy internal) → '+item.adjacentHex:' (active composite exterior candidate)');
   out+=`<path data-border-faction="${side}" data-border-side="${item.hex}:${item.dir}" data-border-status="${status}" d="M${pt(x1)} ${pt(y1)} L${pt(x2)} ${pt(y2)}" stroke="${color}" stroke-width="${lineWidth}" stroke-opacity="${isWarning?'.95':'.78'}" stroke-linecap="round" fill="none"><title>${label}</title></path>`;
   if(isWarning){
    const mx=(x1+x2)/2,my=(y1+y2)/2;
    out+=`<circle cx="${pt(mx)}" cy="${pt(my)}" r="5" fill="#fff" stroke="${color}" stroke-width="2.6"/>`;
   }
  }
 }
}
out+='</g>';
const file=path.join(root,'exports/kiev-odessa.svg');
const svg=fs.readFileSync(file,'utf8');
if(!svg.includes('class="hex-tile-map"')||!svg.endsWith('</svg>'))throw Error('Missing canonical engine export');
const annotated=svg.slice(0,-6)+out+'</svg>';
const dest=path.join(root,'rules/audit/visual/odessa-entry-boundary-topology-v527.svg');
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,annotated);
const png=dest.replace(/\.svg$/,'.png');
const run=cp.spawnSync('inkscape',[dest,'--export-filename='+png],{encoding:'utf8',timeout:120000});
if(run.error||run.status!==0)throw Error('SVG export failed: '+(run.error?.message||run.stderr));
// Embedded source textures and original map are already preserved in the PNG.
fs.unlinkSync(dest);
console.log('Rendered actual-engine border diagnostic',png,fs.statSync(png).size);
