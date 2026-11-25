/* Shared historical CRT lookup. Browser and Node compatible; pure and deterministic. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameHistoricalCRT=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const COLUMNS={"1":["DR","EX","EX","NE","NE","AL"],"2":["DR","DR","EX","EX","NE","NE"],"3":["DR","DR","DR","EX","EX","DRL"],"4":["DR","DR","EX","DRL","DRL","DE"],"5":["DR","DRL","DRL","DRL","DE","DE"],"6":["DRL","DRL","DE","DE","DE","DE"]};
// Optional player-selected Advanced CRT transcribed from the supplied eight-column chart.
// This matrix is not the Oberlabs standard CRT; never mutate the standard columns.
const ADVANCED_COLUMNS=Object.freeze({
 "0.5":["NE","NE","EX","EX","AL","AL"],
 "1":["DR","NE","NE","EX","EX","AL"],
 "1.5":["DR","NE","NE","EX","EX","EX"],
 "2":["DR","DR","NE","NE","EX","EX"],
 "3":["DRL","DR","DR","DR","EX","EX"],
 "4":["DE","DRL","DRL","DR","DR","EX"],
 "5":["DE","DE","DRL","DRL","DRL","DR"],
 "6":["DE","DE","DE","DE","DRL","DRL"]
});
const ADVANCED_ODDS=Object.freeze([0.5,1,1.5,2,3,4,5,6]);
const HISTORICAL_GAMES=Object.freeze(["battle-for-moscow", "arduous", "leningrad", "kiev", "kiev-odessa"]);
function normalizeVariant(variant='standard'){
 if(!['standard','advanced'].includes(variant))throw Error('Unsupported CRT variant '+variant);
 return variant;
}
function columns(variant='standard'){return normalizeVariant(variant)==='advanced'?ADVANCED_COLUMNS:COLUMNS;}
function result(odds,die,variant='standard'){
 const col=String(odds),table=columns(variant);
 if(!Object.prototype.hasOwnProperty.call(table,col))throw Error('Unsupported CRT odds '+col);
 if(!Number.isInteger(die)||die<1||die>6)throw Error('CRT roll must be 1..6');
 return table[col][die-1];
}
// Ratios below the lowest rolled column return zero (automatic NE). CRT shifts
// always move whole columns, never interpolate or round 3:2 up to 2:1.
function columnForRatio(ratio,variant='standard'){
 normalizeVariant(variant);
 if(!Number.isFinite(ratio)||ratio<0)throw Error('Invalid combat odds ratio');
 if(variant==='standard')return Math.min(6,Math.floor(ratio));
 let col=0;
 for(const value of ADVANCED_ODDS){if(ratio>=value)col=value;else break;}
 return col;
}
function shiftColumn(column,shift,max=6,variant='standard'){
 normalizeVariant(variant);
 if(!Number.isInteger(shift)||!Number.isInteger(max)||max<1||max>6)throw Error('Invalid CRT shift');
 if(variant==='standard')return Math.max(0,Math.min(max,column+shift));
 const positions=[0,...ADVANCED_ODDS.filter(x=>x<=max)];
 const index=positions.indexOf(column);
 if(index<0)throw Error('Invalid advanced CRT base column '+column);
 return positions[Math.max(0,Math.min(positions.length-1,index+shift))];
}
function label(odds){return odds===0.5?'1:2':odds===1.5?'3:2':String(odds)+':1';}
function tableFor(gameId,variant='standard'){
 if(!HISTORICAL_GAMES.includes(gameId))throw Error('Unknown historical CRT game '+gameId);
 return JSON.parse(JSON.stringify(columns(variant)));
}
return Object.freeze({id:'oberlabs-battle-for-moscow-crt-v1',result,tableFor,columns,columnForRatio,shiftColumn,label,normalizeVariant,games:HISTORICAL_GAMES});
});
