#!/usr/bin/env python3
"""Actual shared-engine SVG Chromium test for corrected printed Odessa city name."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
svg=(ROOT/'exports/kiev-odessa.svg').read_text()
assert '<svg' in svg and 'data-label-hex="1016"' in svg
out=ROOT/'rules/audit/visual/odessa-braila-city-chromium-v497.png'
checks=0
def check(condition,msg):
 global checks
 assert condition,msg
 checks+=1
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1400,'height':1450},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content('<!doctype html><html><head><style>body{margin:0;background:white} svg{width:1360px;height:1350px;display:block}</style></head><body>'+svg+'</body></html>',wait_until='domcontentloaded',timeout=30000)
 label=page.locator('svg [data-label-hex="1016"] .city-label')
 check(label.count()==1,'1016 label exists')
 check(label.text_content()=='Brăila','label displays Brăila')
 check(page.locator('svg text.city-label').count()==20,'20 city labels')
 check(page.locator('svg text.city-label').filter(has_text='Balti').count()==0,'obsolete Balti absent')
 for name in ['Lublin','Iasi','Brăila','Odessa','Nikolaev','Kiev']:
  check(page.locator('svg text.city-label').filter(has_text=name).count()==1,'exact named city '+name)
 check(page.locator('[data-layer="railways"]').count()==1,'approved rails present')
 check(page.locator('[data-layer="setup-region-outlines"]').count()==1,'Romanian setup borders present')
 check(not errors,'no SVG script error')
 page.screenshot(path=str(out),clip={'x':475,'y':990,'width':520,'height':350})
 browser.close()
print('PASS v497 Odessa city shared-engine Chromium',checks,'checks',out)
