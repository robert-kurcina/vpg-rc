#!/usr/bin/env python3
"""Verify original-sheet Fleet Support thumbnails are correctly re-cropped and rendered.

Uses the shipped historical engine, game page, source photos, and in-memory
Chromium fixture; never constructs a new game renderer or image-generation art.
"""
from pathlib import Path
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
import base64, io, json

ROOT=Path(__file__).resolve().parents[1]
VISUAL=ROOT/'rules/audit/visual'
VISUAL.mkdir(parents=True,exist_ok=True)
meta=json.loads((ROOT/'assets/support-counters/crop-overrides.json').read_text())['faces']
assert meta=={
 'odessa-front-r01c01':[20,7,71,69],
 'odessa-front-r02c01':[20,76,71,70]
}
checks=0
def ok(condition,why):
 global checks
 assert condition,why
 checks+=1
source=Image.open(ROOT/'assets/official-counters/source-sheets/counters-odessa-front.jpg').convert('RGB')
for face,box in meta.items():
 x,y,w,h=box
 png=Image.open(ROOT/'assets/support-counters'/f'{face}.png').convert('RGB')
 ok(png.size==(w,h),f'{face} thumbnail dimensions')
 ok(ImageChops.difference(source.crop((x,y,x+w,y+h)),png).getbbox() is None,
    f'{face} is the original-sheet crop with sheet-edge strip removed')

# Fixture imports the original supported page/asset builder without executing
# the lengthy full-campaign acceptance test.
ns={'__file__':str(ROOT/'tests/odessa-contested-seven-turn-browser-v537.py')}
fixture=(ROOT/'tests/odessa-contested-seven-turn-browser-v537.py').read_text().split('with sync_playwright() as pw:')[0]
exec(fixture,ns)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
    args=['--no-sandbox','--disable-dev-shm-usage'])
 for kind,kwargs in [('desktop',{'viewport':{'width':1600,'height':1000},'device_scale_factor':1}),
                     ('tablet',{'viewport':{'width':768,'height':910},'device_scale_factor':1,'is_mobile':True,'has_touch':True})]:
  page=browser.new_page(**kwargs)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(ns['html'],wait_until='load',timeout=60000)
  page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=35000)
  if kind=='tablet':
   # Touch layout initially collapses the Support panel to protect map space.
   if not page.locator('#support-window-body').is_visible():page.locator('[data-support-collapse]').click()
  img=page.locator('[data-support-fleet] img')
  ok(img.count()==1,kind+' original Fleet counter rendered')
  ok(img.evaluate('(i)=>i.complete && i.naturalWidth === 71 && i.naturalHeight === 69'),kind+' complete uncropped Fleet front square')
  ok(img.get_attribute('data-support-face-id')=='odessa-front-r01c01',kind+' original Fleet face selected')
  src=img.get_attribute('src')
  ok(src.startswith('data:image/png;base64,'),kind+' self-contained photo loaded')
  ok(base64.b64decode(src.split(',',1)[1])==(ROOT/'assets/support-counters/odessa-front-r01c01.png').read_bytes(),kind+' actual thumbnail bytes match cropped source')
  style=img.evaluate('(i)=>({fit:getComputedStyle(i).objectFit,rect:(()=>{const r=i.getBoundingClientRect();return {width:r.width,height:r.height}})()})')
  ok(style['fit']=='contain' and style['rect']=={'width':52,'height':52},kind+' full counter fits in visible Support thumbnail')
  ok(page.locator('.support-art-fallback').count()==0,kind+' no broken images')
  ok(page.locator('[data-support-fleet]').is_visible(),kind+' Fleet card visible')
  ok(not errors,kind+' no JavaScript exceptions '+str(errors))
  page.locator('[data-support-window]').screenshot(path=str(VISUAL/f'odessa-fleet-support-crop-{kind}-v542.png'))
  page.close()
 browser.close()
print('PASS v542 Black Sea Fleet original-sheet Support thumbnail:',checks,'source/Chromium assertions')
