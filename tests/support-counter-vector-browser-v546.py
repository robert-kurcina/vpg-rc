#!/usr/bin/env python3
"""Chromium: Support cards must use actual shared SVG engine, no source-sheet PNGs.
Source gameplay browser, original counter-config metadata and original SVG modules.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
VIS=ROOT/'rules/audit/visual';VIS.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('fixture',ROOT/'tests/arduous-browser-v419.py')
fx=importlib.util.module_from_spec(spec);spec.loader.exec_module(fx)
ns={'__file__':str(ROOT/'tests/odessa-contested-seven-turn-browser-v537.py')}
exec((ROOT/'tests/odessa-contested-seven-turn-browser-v537.py').read_text().split('with sync_playwright() as pw:')[0],ns)
kn={'__file__':str(ROOT/'tests/kiev-support-window-browser-v516.py')}
exec((ROOT/'tests/kiev-support-window-browser-v516.py').read_text().split('with sync_playwright() as p:')[0],kn)
checks=0
def ok(condition,explain):
 global checks
 assert condition,explain
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for game,html,expected in [
   ('leningrad',fx.html_for('leningrad'),3),
   ('arduous',fx.html_for('arduous'),2),
   ('kiev',kn['html'],2),
   ('kiev-odessa',ns['html'],4),
 ]:
  page=browser.new_page(viewport={'width':1500,'height':1000},device_scale_factor=2)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='load',timeout=60000)
  page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
  panel=page.locator('[data-support-window]')
  ok(panel.is_visible(),game+' visible Support control')
  images=page.locator('.support-window-counter img, .support-window-counter image')
  ok(images.count()==0,game+' does not use raster thumbnails')
  faces=page.locator('.support-window-counter svg.support-counter-svg')
  ok(faces.count()==expected,game+' original support faces rendered with SVG')
  data=faces.evaluate_all('xs=>xs.map(x=>({source:x.getAttribute("data-source-face-id"),template:x.dataset.vectorTemplate,unit:x.querySelector(".official-counter")!==null,viewBox:x.getAttribute("viewBox"),width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height}))')
  ok(all(x['unit'] and x['source'] and x['template'] and x['viewBox']=='-3 -3 56 56' for x in data),game+' original official SVG used for every marker')
  ok(all(abs(x['width']-62)<.1 and abs(x['height']-62)<.1 for x in data),game+' same 62px complete counter viewport')
  ok(not errors,game+' no browser exceptions '+repr(errors))
  if game=='leningrad':
   ok(sorted(x['template'] for x in data)==['air','fleet','stuka'],'double-aircraft and single-aircraft graphics properly distinguished')
   ok(page.locator('[data-source-face-id="leningrad-front-r04c05"] [data-role="primary"]').first.evaluate('x=>getComputedStyle(x).fill')=='rgb(139, 163, 150)','source green field restored, not black silhouette sample')
   panel.screenshot(path=str(VIS/'leningrad-support-original-svg-browser-v546.png'))
  if game=='kiev-odessa':
   ok([x['template'] for x in data]==['air','air','air','fleet'],'Kiev + Romanian Air and Black Sea Fleet proper SVG templates')
   ok(page.locator('[data-source-face-id="odessa-front-r01c01"] [data-role="primary"]').first.evaluate('x=>getComputedStyle(x).fill')=='rgb(229, 69, 77)','source-red Black Sea field restored, not sheet-margin gray')
   ok(page.locator('[data-source-face-id="odessa-front-r01c07"] [data-role="primary"]').first.evaluate('x=>getComputedStyle(x).fill')=='rgb(144, 178, 215)','Romanian Air source blue preserved')
   panel.screenshot(path=str(VIS/'odessa-support-original-svg-browser-v546.png'))
   # Stage real combat support via the same player input as gameplay.
   start=page.evaluate('HistoricalBrowserPreview.snapshot()')
   air=page.locator('[data-support-pick^="air:"]')
   ok(air.count()>=1,'source Air Corps playable Support choice')
   air.first.click()
   ok(page.evaluate('!!HistoricalBrowserPreview.supportSelection()'),'clicking an actual SVG card stages only a Support target')
   ok(page.evaluate('HistoricalBrowserPreview.snapshot()')==start,'selection leaves campaign state untouched')
   page.keyboard.press('Escape')
   ok(page.evaluate('HistoricalBrowserPreview.supportSelection()') is None,'Escape cancels Support without gameplay mutation')
  page.close()
 # Real touch screen: same shared renderer, no clipped sheet grid.
 tablet=browser.new_page(viewport={'width':768,'height':910},has_touch=True,is_mobile=True)
 errors=[];tablet.on('pageerror',lambda e:errors.append(str(e)))
 tablet.set_content(ns['html'],wait_until='load',timeout=60000)
 tablet.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
 ok(tablet.locator('[data-support-window]').is_visible(),'iPad Support dock available')
 if not tablet.locator('#support-window-body').is_visible():tablet.locator('[data-support-collapse]').click()
 ok(tablet.locator('.support-window-counter svg.support-counter-svg').count()==4,'iPad same four SVG faces')
 ok(tablet.locator('.support-window-counter img').count()==0,'iPad zero cropped sheet thumbnails')
 ok(not errors,'iPad no browser errors')
 tablet.locator('[data-support-window]').screenshot(path=str(VIS/'odessa-support-original-svg-tablet-v546.png'))
 browser.close()
print('PASS v546 source SVG Support browser:',checks,'Chromium assertions')
