const fs=require('fs'),assert=require('assert');
const base=JSON.parse(fs.readFileSync('maps/kiev.json','utf8'));
const ext=JSON.parse(fs.readFileSync('maps/odessa-extension.json','utf8'));
const comp=require('../maps/composer').compose(base,ext);
assert.deepStrictEqual(base.sourceRailRoutes.map(x=>x.sourceSvgId),ext.authoritativeRailRoutes.map(x=>x.sourceSvgId),'Standalone Kiev must have the same 24 authored source rail route identities');
assert.strictEqual(base.preRegisteredRailGeometry,true,'Standalone Kiev must retain composite-registered geometry without another snap');
assert.strictEqual(comp.preRegisteredRailGeometry,false,'Composite must continue its original registration');
assert.strictEqual(base.authoritativeRailPolylineGeometry,true,'Standalone Kiev must render exact source polylines');
assert.strictEqual(base.sourceRailRoutes.length,24);
assert.strictEqual(base.railwayBoundaryExits.length,0,'Obsolete exit connectors would duplicate railway art');
assert.strictEqual(base.hexCenterRailConnections.length,93,'Definitive authored rail graph changed without source reconciliation');
const svgA=fs.readFileSync('exports/kiev.svg','utf8');
const svgB=fs.readFileSync('exports/kiev-odessa.svg','utf8');
function data(svg){
 const paths=new Map();
 for(const m of svg.matchAll(/<path\b[^>]*\bclass="authored-center-rail"[^>]*>/g)){
  const tag=m[0],d=tag.match(/\bd="([^"]+)"/),id=tag.match(/\bdata-source-rail-path="([^"]+)"/);
  assert(d&&id,'Malformed authored railway track');
  assert(!paths.has(id[1]),'Repeated railway path '+id[1]);
  paths.set(id[1],d[1]);
 }
 return paths;
}
const a=data(svgA),b=data(svgB);
assert.strictEqual(a.size,24,'Standalone Kiev should contain 24 source-route tracks');
assert.strictEqual(b.size,24,'Composite should contain 24 source-route tracks');
assert.deepStrictEqual([...a].sort(),[...b].sort(),'Actual engine-authored railway path geometry differs');
assert(svgA.includes('clip-path="url(#authored-source-mask-kiev-native-draft-v231)'), 'Standalone Kiev railway network not clipped to hex footprint');
console.log('PASS v300: 24 identical authored railway paths, exact SVG rail geometry, clipped to Kiev hex footprint');
