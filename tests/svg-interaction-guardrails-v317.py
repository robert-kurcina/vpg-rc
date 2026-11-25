#!/usr/bin/env python3
"""Chromium hit-test on real shared map/counter SVG renderer output.
Uses a minimal renderer fixture; does not claim full game/action parity.
"""
import pathlib, subprocess, json, os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
JS=r'''
const T=require('./core/terrain_tiles'), C=require('./core/counter_visuals');
const board={id:'test',geometry:{originX:80,originY:90,pitchX:110,pitchY:110,staggerY:0},cells:[{id:'0101',column:1,row:1,terrain:'open',tileMarkers:[{kind:'city',label:'Moscow'}]}]};
const map=T.svgMap(board,{width:290,height:210,rx:43,ry:43});
const counter=C.piece({id:'g24',army:'german',strength:'full',movement:4,combatFull:6,combatReduced:3},165,72,'#d0dbd4');
console.log(JSON.stringify({map,counter}));
'''
DATA=json.loads(subprocess.check_output(['node','-e',JS],cwd=ROOT,text=True))
STYLE=(ROOT/'core/svg_interaction.css').read_text()
HTML=f'''<!doctype html><html><head><style>body{{margin:0}}#board{{width:580px;height:420px;display:block}}{STYLE}</style></head>
<body><svg id="board" viewBox="0 0 290 210">{DATA['map'].replace('<svg ', '<svg ', 1)}
<g data-layer="unit-counters">{DATA['counter']}</g></svg><p id="status"></p>
<script>window.events=[];for(const h of document.querySelectorAll('[data-hex-id]'))h.addEventListener('click',e=>{{if(e.target.closest('[data-interaction="hex-body"]'))window.events.push('hex');}});
for(const c of document.querySelectorAll('[data-unit-id]'))c.addEventListener('click',e=>{{if(e.target.closest('[data-interaction="counter-body"]')){{e.stopPropagation();window.events.push('counter');}}}});</script>
</body></html>'''
def main():
 with sync_playwright() as p:
  exe=os.getenv('B4M_CHROMIUM') or ('/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else p.chromium.executable_path)
  browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':800,'height':550});page.set_content(HTML)
  # Visible artwork inside the SVG cannot become selected.
  for sel in ['#board','.counter-vector','.counter-vector text','.city-label']:
   for e in page.locator(sel).all():
    assert e.evaluate('e=>getComputedStyle(e).userSelect')=='none', sel
  # Event targeting: only explicit hit areas receive events.
  targets=page.evaluate('''() => {
   const root=document.getElementById('board'), r=root.getBoundingClientRect();
   function at(x,y){let e=document.elementFromPoint(r.left+x*2,r.top+y*2);return {cls:e?.getAttribute('class'),target:e?.getAttribute('data-interaction')}}
   return {hex:at(80,90),city:at(92,78),counter:at(185,92),empty:at(270,180)};
  }''')
  assert targets['hex']['target']=='hex-body',targets
  assert targets['city']['target']=='hex-body',targets
  assert targets['counter']['target']=='counter-body',targets
  assert targets['empty']['target'] is None,targets
  page.mouse.click(160,180);page.mouse.click(184,156);page.mouse.click(370,184);page.mouse.click(540,360)
  assert page.evaluate('window.events')==['hex','hex','counter'],page.evaluate('window.events')
  # Direct clicks on decorative nodes do not become counter selections.
  page.evaluate('document.querySelector(".official-counter title").dispatchEvent(new MouseEvent("click",{bubbles:true}))')
  assert page.evaluate('window.events')==['hex','hex','counter']
  browser.close()
 print('PASS Chromium SVG pointer targets, map label click-through, counter body clicks, non-selectability')
if __name__=='__main__':main()
