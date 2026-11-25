#!/usr/bin/env python3
"""Chromium verification of real shared official SVG counter templates and source faces."""
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SCREENSHOT=ROOT/'rules/audit/visual/shared-counter-red-damage-white-bar-v535.png'
JAVASCRIPT=r'''
const cfg=require('./maps/counter-configs/kiev.json');
const Projection=require('./core/historical_counter_face_projection');
const Visuals=require('./core/counter_visuals');
const pairs=[
 {id:'kiev-front-r03c04',label:'Soviet red field',y:18},
 {id:'kiev-front-r05c03',label:'Ochre field',y:192},
];
let svg='';const cases=[];
for(const [groupIndex,entry] of pairs.entries()){
 const front=cfg.faces.front.find(f=>f.faceId===entry.id);
 const back=cfg.faces.back.find(b=>b.faceId===front.pairedFaceId);
 for(let i=0;i<2;i++){
  const status=i?'printed-reduced':'printed-full';
  const id=`sample-${groupIndex}-${i}`;
  const unit={id,sourceFaceId:front.faceId,reverseFaceId:back.faceId,
    activeFaceId:i?back.faceId:front.faceId,strengthStatus:status,size:'corps'};
  const rendered=Projection.project(unit,cfg);
  const x=60+i*250,y=entry.y+28;
  svg+=Visuals.piece(rendered.art,x,y,'#6e6e6e',{width:110,height:110});
  svg+=`<text x="${x+55}" y="${y+128}" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#111">${i?'Reduced':'Full'}</text>`;
  cases.push({id,damaged:!!i,color:i?'#'+(groupIndex===0?'ffffff':'ff0000'):'#'+(groupIndex===0?'ffffff':'ff0000'),field:rendered.art.counter.faces[i?'damaged':'full'].color});
 }
 svg+=`<text x="5" y="${entry.y+15}" font-family="sans-serif" font-size="15" fill="#222">${entry.label} — original Kiev source faces</text>`;
}
console.log(JSON.stringify({svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 530 365" width="530" height="365"><rect width="530" height="365" fill="#f6f6f2"/>${svg}</svg>`,cases}));
'''
result=subprocess.run(['node','-e',JAVASCRIPT],cwd=ROOT,check=True,capture_output=True,text=True)
payload=json.loads(result.stdout)
checks=0
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':550,'height':385},device_scale_factor=2)
    page.set_content('<!doctype html><body style="margin:10px;background:#f6f6f2">'+payload['svg']+'</body>')
    for case in payload['cases']:
        group=page.locator(f'[data-unit-id="{case["id"]}"]')
        assert group.count()==1,case;checks+=1
        assert group.get_attribute('data-damaged')==str(case['damaged']).lower(),case;checks+=1
        strip=group.locator('[data-role="status_reduced"]')
        assert strip.count()==1,case;checks+=1
        assert strip.evaluate('(el)=>getComputedStyle(el).fill')==('rgb(255, 255, 255)' if case['color']=='#ffffff' else 'rgb(255, 0, 0)'),case;checks+=1
        assert strip.evaluate('(el)=>getComputedStyle(el).display')==('inline' if case['damaged'] else 'none'),case;checks+=1
        primary=group.locator('[data-role="primary"]')
        assert primary.count()==1 and case['field'] in primary.get_attribute('style'),case;checks+=1
    assert page.locator('g.counter-vector').count()==4;checks+=1
    SCREENSHOT.parent.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(SCREENSHOT))
    browser.close()
print('PASS red damage bar real Chromium source SVG v535',checks,'assertions',SCREENSHOT)
