'use strict';
const assert=require('node:assert/strict');
const {placement}=require('../core/terrain_tooltips');
const W=290,H=180;
const cases=[
 {x:420,y:340,vw:1200,vh:800,side:'right'},
 {x:1150,y:350,vw:1200,vh:800,side:'left'},
 {x:150,y:150,vw:340,vh:800,side:'bottom'},
 {x:150,y:690,vw:340,vh:800,side:'top'},
 {x:15,y:16,vw:1200,vh:800,side:'right'},
 {x:1186,y:786,vw:1200,vh:800,side:'left'},
 ];
let assertions=0;
function check(ok,label){assert(ok,label);assertions++;}
for(const c of cases){
 const p=placement(c.x,c.y,W,H,c.vw,c.vh);
 check(p.side===c.side,JSON.stringify({c,p}));
 check(p.left>=8&&p.top>=8&&p.left+W<=c.vw-8&&p.top+H<=c.vh-8,'panel within viewport');
 check(p.arrowX>=0&&p.arrowY>=0&&p.arrowX+9<=c.vw&&p.arrowY+9<=c.vh,'pointer inside viewport');
 const borderX=p.side==='right'?p.left:p.side==='left'?p.left+W:null;
 const borderY=p.side==='bottom'?p.top:p.side==='top'?p.top+H:null;
 check((borderX===null||Math.abs(p.arrowX-borderX)<=8)&&(borderY===null||Math.abs(p.arrowY-borderY)<=8),'arrow base adjoins border');
 const directionGap=(p.side==='right'?p.arrowX-c.x:p.side==='left'?c.x-(p.arrowX+9):p.side==='bottom'?p.arrowY-c.y:c.y-(p.arrowY+9));
 check(directionGap>=8&&directionGap<=12,'pointer tip 8-12px away from mouse');
 check(p.side==='right'||p.side==='left'?
   Math.abs(p.arrowY+8-c.y)<=18:Math.abs(p.arrowX+8-c.x)<=18,'pointer aligned on approach axis');
 }
// A direction with insufficient room should never create an off-screen panel.
for(let vw of [310,400,800])for(let vh of [245,410,900]){
 for(const x of [5,35,vw/2,vw-35,vw-5])for(const y of [5,35,vh/2,vh-35,vh-5]){
  const width=Math.min(W,vw-16),height=Math.min(H,vh-16);
  const p=placement(x,y,width,height,vw,vh);
  check(p.left>=8&&p.left+width<=vw-8&&p.top>=8&&p.top+height<=vh-8,'bounded at every corner');
  check(['right','left','bottom','top'].includes(p.side),'orientation');
 }
}
console.log('PASS responsive tooltip pointer placement',assertions,'assertions');
