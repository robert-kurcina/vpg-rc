'use strict';const A=require('node:assert/strict');
const R=require('../core/source_rail_reconciliation');
const audit=require('../tools/audit-arduous-rail-reconciliation-v411').audit;
const map=require('../maps/arduous.json');
const ext=require('../rules/audit/arduous-kiev-svg-first-rail-graph-v318.json').maps.arduous;
const clone=o=>JSON.parse(JSON.stringify(o));
const real=audit(),expected={registeredRailLinks:85,measuredSvgCrossings:88,explicitlyRemovedCrossings:3,traceableRailLinks:85};
A.deepEqual(real.counts,expected);A.deepEqual(real.excludedCrossings,['1801:1802','1804:1805','1807:1808']);
A.equal(real.authorizedForMovement,false);
const ids=new Set(real.railLinks.flatMap(l=>l.sourceSvgIds));let checks=3;
const failure=(m,e,x)=>{A.throws(()=>R.inspect({map:m,derived:e,svgIds:x,excludedPairs:m.v310UserRailDeploymentAudit.removedRailLinks}),/source-rail-reconciliation/);checks++;};
{const m=clone(map);m.hexCenterRailConnections.push({...m.hexCenterRailConnections[0]});failure(m,ext,ids);}
{const m=clone(map);m.hexCenterRailConnections.pop();failure(m,ext,ids);}
{const m=clone(map);m.hexCenterRailConnections.push({from:'1801',to:'1802',sourceSvgIds:['path1']});failure(m,ext,ids);}
{const m=clone(map);m.hexCenterRailConnections[0].sourceSvgIds=['absent-id'];failure(m,ext,ids);}
{const m=clone(map);m.v310UserRailDeploymentAudit.removedRailLinks=[];failure(m,ext,ids);}
{const m=clone(map);m.v310UserRailDeploymentAudit.removedRailLinks.push(['0105','0106']);failure(m,ext,ids);}
{const m=clone(map);m.hexCenterRailConnections[0].to='9999';failure(m,ext,ids);}
{const e=clone(ext);e.adjacencyPairs.pop();failure(map,e,ids);}
console.log('PASS Arduous source-rail reconciliation:',checks,'assertions');
