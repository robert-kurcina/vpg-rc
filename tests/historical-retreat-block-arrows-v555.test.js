'use strict';
const assert=require('node:assert/strict');
const R=require('../core/historical_retreat_map_ux');
let checks=0;
const check=(v,why)=>{assert.ok(v,why);checks++};
const points=(a,b,opt)=>{
 const rendered=R.blockArrowPoints(a,b,opt);
 return rendered&&rendered.split(' ').map(s=>s.split(',').map(Number));
};
for(const [a,b] of [ [[0,0],[42,0]], [[42,0],[0,0]], [[0,0],[0,42]], [[0,0],[30,30]], [[-30,15],[12,-8]] ]){
 const pts=points(a,b);
 check(pts?.length===7,'Seven vertices for crisp square-shouldered arrow');
 check(pts.flat().every(Number.isFinite),'No invalid coordinates');
 check(Math.hypot(pts[3][0]-b[0],pts[3][1]-b[1])<.008,'Exact tip at validated segment endpoint');
 const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),u=[dx/len,dy/len];
 const axis=q=>(q[0]-a[0])*u[0]+(q[1]-a[1])*u[1];
 check(Math.abs(axis(pts[0])-axis(pts[6]))<.02,'Shaft tail edge perpendicular to route');
 check(Math.abs(axis(pts[1])-axis(pts[2]))<.02 && Math.abs(axis(pts[4])-axis(pts[5]))<.02,'Head shoulders square');
 check(Math.hypot(pts[2][0]-pts[4][0],pts[2][1]-pts[4][1])>Math.hypot(pts[1][0]-pts[5][0],pts[1][1]-pts[5][1]),'Head is wider than shaft');
}
check(R.blockArrowPoints([0,0],[0,0])===null,'Degenerate segment omitted');
check(R.blockArrowPoints([0,0],[7,0])===null,'Too-short segment omitted');
check(R.blockArrowPoints([0,0],[42,0],{shaftHalfWidth:6,headHalfWidth:4})===null,'No inverted shoulders');
check(R.blockArrowPoints([0,0],[42,0],{headLength:NaN})===null,'Nonfinite geometry rejected');
const segment=R.segment([0,0],[42,0]);
check(segment!==null,'Longer default retreat segment exists');
check(segment.start[0]===5 && segment.end[0]===37,'Arrow trim reduced to 5 units at both ends');
check(segment.end[0]-segment.start[0]===32,'Arrow gains 14 units compared with prior 12-unit trims');
check(points(segment.start,segment.end)?.length===7,'Extended segment remains a sharp seven-vertex block arrow');
console.log('PASS v555 extended sharp retreat block-arrow geometry:',checks,'assertions');
