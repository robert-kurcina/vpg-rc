'use strict';
/* Historical regression entry point, maintained against the latest approved
 * v554 retreat presentation. The earlier two-tone v541 styles are superseded. */
const fs=require('node:fs'),assert=require('node:assert/strict');
let n=0;const ok=(x,msg)=>{assert.ok(x,msg);n++};
const js=fs.readFileSync('core/historical_browser_app.js','utf8');
const css=fs.readFileSync('games/leningrad/native-preview/style.css','utf8');
const route=fs.readFileSync('core/historical_retreat_map_ux.js','utf8');
ok(js.includes('retreat-arrow-block'),'live map draws filled sharp-cornered block arrows');
ok(js.includes('RetreatMap.blockArrowPoints'),'shared pure geometry builds arrow shape');
ok(!js.includes('marker-end="url(#retreat-arrow-head)"'),'rounded arrow marker no longer used');
ok(js.includes('retreat-arrow-hit'),'keyboard/touch click target preserved');
ok(css.includes('.retreat-arrow-block{fill:#72c9ff;stroke:none'),'full arrow remains uniform light blue');
ok(css.includes('.hex-hit.retreat-target-hex{fill:rgba(10,88,202,.10);stroke:#0a58ca'),'destination uses distinct cobalt blue');
ok(css.includes('.hex-hit.retreat-target-selected{fill:rgba(10,88,202,.23);stroke:#0a58ca'),'selected hex uses cobalt blue');
ok(css.includes('.hex-highlight-pulse.retreat-highlight{stroke:#0a58ca}'),'pulse matches hex cobalt blue');
ok(route.includes('function blockArrowPoints('),'block-arrow helper retained');
ok(css.includes('.hex-hit.support-target-hex{fill:rgba(175,135,0,.10);stroke:#9e7900'),'Support gold unchanged');
console.log('PASS current approved sharp-cornered retreat presentation:',n,'style assertions');
