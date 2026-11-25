'use strict';
/* Adds transparent source-certification rings to the genuine shared-engine
 * SVG export. An audit overlay, not an alternate map renderer or a country
 * boundary guess. The approved export remains byte-for-byte untouched. */
const fs=require('node:fs');const path=require('node:path');const cp=require('node:child_process');
const T=require('../core/terrain_tiles');
const M=require('../maps/kiev.json');
const {audit}=require('./audit-kiev-territory-v444');
const root=path.resolve(__dirname,'..');const evidence=audit();
const source=path.join(root,'exports/kiev.svg');
const approved=fs.readFileSync(source,'utf8');
if(!approved.includes('data-layer="terrain')||!approved.endsWith('</svg>'))throw Error('Expected actual shared-engine Kiev SVG');
const cells=new Map(M.cells.map(c=>[c.id,c]));
const [rx,ry]=T.gridRadii(M.geometry);
const boundary=(id,color,dash)=>{
 const [cx,cy]=T.coord(cells.get(id),M.geometry);
 const points=T.hexPoints(rx*.88,ry*.88).map(([dx,dy])=>`${(cx+dx).toFixed(2)},${(cy+dy).toFixed(2)}`).join(' ');
 return `<polygon data-evidence-hex="${id}" points="${points}" fill="none" stroke="${color}" stroke-width="4.5" stroke-dasharray="${dash}" stroke-linejoin="round" opacity=".95"/>`;
};
let overlay='<g data-layer="kiev-romanian-setup-evidence-v444" pointer-events="none" aria-label="Known starting setup and border origins only; not a national territory mask">';
for(const id of evidence.certifiedFromPrintedSetupAndApprovedMap.romanianInitialAxisHexes)overlay+=boundary(id,'#ed8d30','10 4');
for(const id of evidence.certifiedFromPrintedSetupAndApprovedMap.sovietEligibleOpeningHexes)overlay+=boundary(id,'#0ea6de','4 6');
overlay+='</g>';
const svg=approved.slice(0,-6)+overlay+'</svg>';
const dest=path.join(root,'rules/audit/visual/kiev-romania-evidence-v444.svg');
const png=dest.replace(/\.svg$/,'.png');
fs.writeFileSync(dest,svg);
const render=cp.spawnSync('inkscape',[dest,'--export-filename='+png,'--export-width=1800'],{encoding:'utf8'});
if(render.error||render.status!==0)throw Error(render.error?.message||render.stderr);
console.log('PASS v444 actual-render map with diagnostic-only Romanian setup/eligible-origin outlines');
