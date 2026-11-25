#!/usr/bin/env python3
"""Real shared counter-renderer Chromium acceptance for Kiev source field colors."""
from pathlib import Path
import json
import subprocess
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT/'rules/audit/visual/kiev-source-counter-palette-damage-browser-v492.png'
checks=0

JS=r'''
const cfg=require('./maps/counter-configs/kiev.json');
const Projection=require('./core/historical_counter_face_projection');
const Visuals=require('./core/counter_visuals');
const cases=[
 ['kiev-front-r01c03','German 48th Panzer','full'],
 ['kiev-front-r02c03','German 54th Infantry','full'],
 ['kiev-front-r04c02','Soviet Mechanized A','full'],
 ['kiev-front-r04c03','Soviet Mechanized B','full'],
 ['kiev-front-r05c03','Soviet Mechanized C','full'],
 ['kiev-back-r04c02','Soviet 40th reduced','reduced'],
 ['kiev-front-r02c08','Romanian Army','full'],
 ['kiev-front-r04c08','Hungarian Corps','full']
];
const fronts=new Map(cfg.faces.front.map(x=>[x.faceId,x]));
const backs=new Map(cfg.faces.back.map(x=>[x.faceId,x]));
let markup='';let metadata=[];
for(let i=0;i<cases.length;i++){
 const [faceId,label,status]=cases[i];
 const face=fronts.get(faceId)||backs.get(faceId);
 const front=status==='reduced'?fronts.get(face.pairedFaceId):face;
 const back=status==='reduced'?face:backs.get(face.pairedFaceId);
 const unit={id:'test-face-'+i,sourceFaceId:front.faceId,reverseFaceId:back.faceId,
  strengthStatus:status==='reduced'?'printed-reduced':'printed-full',
  size:front.visualTranscription.printedIdentifier==='Rom'?'army':'corps',
  activeFaceId:status==='reduced'?back.faceId:front.faceId};
 const projected=Projection.project(unit,cfg);
 const x=25+i%4*205,y=18+Math.floor(i/4)*157;
 markup+=Visuals.piece(projected.art,x,y,'#aabbcc',{width:92,height:92});
 markup+=`<text x="${x+46}" y="${y+114}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#223">${label}</text>`;
 markup+=`<text x="${x+46}" y="${y+133}" text-anchor="middle" font-family="monospace" font-size="12" fill="#435">${faceId.split('-').slice(-1)[0]}</text>`;
 metadata.push({id:'test-face-'+i,color:face.observedFieldColor,label,faceId});
}
process.stdout.write(JSON.stringify({svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 320" width="820" height="320"><rect width="820" height="320" fill="#f7f7f4"/>${markup}</svg>`, metadata}));
'''
result=subprocess.run(['node','-e',JS],cwd=ROOT,encoding='utf-8',capture_output=True,check=True)
obj=json.loads(result.stdout)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':840,'height':350},device_scale_factor=2)
 page.set_content('<!doctype html><html><body style="margin:10px;background:#f7f7f4">'+obj['svg']+'</body></html>')
 for item in obj['metadata']:
  base=page.locator(f'g[data-unit-id="{item["id"]}"] [data-role="primary"]')
  assert base.count()==1,item
  assert base.evaluate('(el)=>el.getAttribute("style")').lower().find(item['color'])!=-1,item
  checks+=2
 assert page.locator('g.counter-vector').count()==8
 checks+=1
 # A printed reduced side uses the source SVG's authored red vertical stripe.
 # This is NOT a synthetic art overlay or a different source field color.
 assert page.locator('g.counter-vector[data-damaged="true"]').count()==1
 assert page.locator('g.counter-vector[data-damaged="true"] [data-role="status_reduced"]').evaluate('(e)=>getComputedStyle(e).display')=='inline'
 checks+=2
 SCREENSHOT.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(SCREENSHOT))
 browser.close()
print('PASS Kiev source-painted counter Chromium v490',checks,'checks',SCREENSHOT)
