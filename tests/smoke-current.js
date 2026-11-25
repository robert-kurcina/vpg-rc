const fs=require('fs');const assert=require('assert');const path=require('path');
const root=path.resolve(__dirname,'..');
const CRT=require('../core/historical_crt');
const reg=JSON.parse(fs.readFileSync(path.join(root,'maps/registry.json')));
for(const m of reg.maps){assert(fs.existsSync(path.join(root,'exports',m.id+'.svg')),m.id+' missing SVG');assert(fs.existsSync(path.join(root,'exports',m.id+'.png')),m.id+' missing PNG');}
for(let d=1;d<=6;d++)for(let o=1;o<=6;o++)assert(CRT.result(o,d));
assert(fs.existsSync(path.join(root,'PLAN.md')));
for(const n of ['arduous','b4m','kiev','leningrad','odessa'])assert(fs.existsSync(path.join(root,'references/rules',n+'-rules.pdf')));
console.log('PASS current package smoke: five maps + shared CRT + sources');
