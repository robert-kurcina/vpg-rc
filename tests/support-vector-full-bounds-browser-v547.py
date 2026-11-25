#!/usr/bin/env python3
"""Real historical browser: Support SVG includes authored edge/shadow bleed rather than clipping it."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
VIS=ROOT/'rules/audit/visual';VIS.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('historical_fixture',ROOT/'tests/arduous-browser-v419.py')
fx=importlib.util.module_from_spec(spec);spec.loader.exec_module(fx)
ns={'__file__':str(ROOT/'tests/odessa-contested-seven-turn-browser-v537.py')}
exec((ROOT/'tests/odessa-contested-seven-turn-browser-v537.py').read_text().split('with sync_playwright() as pw:')[0],ns)
checks=0
def ok(cond,label):
 global checks
 assert cond,label
 checks+=1
# SVG group getBBox() includes source path extents; it must be contained in the viewBox.
geometry="""els => els.map(svg => {
 const vb=svg.viewBox.baseVal;
 const box=svg.querySelector('.official-counter').getBBox();
 const holder=svg.closest('.support-window-counter');
 const svgRect=svg.getBoundingClientRect(),holderRect=holder.getBoundingClientRect();
 return {face:svg.dataset.sourceFaceId,svg:{w:svgRect.width,h:svgRect.height},holder:{w:holderRect.width,h:holderRect.height},
  view:{x:vb.x,y:vb.y,right:vb.x+vb.width,bottom:vb.y+vb.height},
  ink:{x:box.x,y:box.y,right:box.x+box.width,bottom:box.y+box.height},
  overflow:getComputedStyle(holder).overflow};
})"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for game,html,faces in [('leningrad',fx.html_for('leningrad'),3),('kiev-odessa',ns['html'],4)]:
  p=browser.new_page(viewport={'width':1500,'height':1000},device_scale_factor=2)
  errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  p.set_content(html,wait_until='load',timeout=60000)
  p.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
  art=p.locator('.support-window-counter svg.support-counter-svg');ok(art.count()==faces,game+' face count')
  for item in art.evaluate_all(geometry):
   v=item['view'];b=item['ink']
   ok(v['x']<=b['x']-1 and v['y']<=b['y']-1 and v['right']>=b['right']+1 and v['bottom']>=b['bottom']+1,game+' ink safely within viewBox '+item['face'])
   ok(item['svg']=={'w':62,'h':62} and item['holder']=={'w':62,'h':62},game+' artwork and holder same 62px')
   ok(item['overflow']=='visible',game+' no thumbnail clipping')
  ok(not errors,game+' no browser errors')
  p.locator('[data-support-window]').screenshot(path=str(VIS/f'{game}-support-uncropped-svg-v547.png'))
  p.close()
 # Tablet matches desktop: no special crop from media query.
 p=browser.new_page(viewport={'width':768,'height':910},has_touch=True,is_mobile=True,device_scale_factor=2)
 p.set_content(ns['html'],wait_until='load',timeout=60000)
 p.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
 if not p.locator('#support-window-body').is_visible():p.locator('[data-support-collapse]').click()
 for item in p.locator('.support-window-counter svg.support-counter-svg').evaluate_all(geometry):
  ok(item['overflow']=='visible' and item['svg']=={'w':62,'h':62},'tablet uncropped '+item['face'])
 p.locator('[data-support-window]').screenshot(path=str(VIS/'kiev-odessa-support-uncropped-svg-tablet-v547.png'))
 browser.close()
print('PASS v547 source-SVG full-bounds browser:',checks,'assertions')
