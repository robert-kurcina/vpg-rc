#!/usr/bin/env python3
"""Chromium screenshot of original shared-engine SVG and configured mauve polygons."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
svg=(ROOT/'exports/kiev-odessa.svg').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--disable-dev-shm-usage','--no-sandbox'])
 page=browser.new_page(viewport={'width':1360,'height':1350},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content('<!doctype html><html><head><style>body{margin:0;background:white}svg{width:1360px;height:1350px;display:block}</style></head><body>'+svg+'</body></html>',wait_until='domcontentloaded',timeout=60000)
 mauve=page.locator('[data-layer="setup-region-outlines"] polygon[data-region="bessarabia"]')
 romanian=page.locator('[data-layer="setup-region-outlines"] polygon[data-region="romanian-turn1-setup"]')
 assert mauve.count()==19,mauve.count()
 assert romanian.count()==4,romanian.count()
 expected=set('1111 1112 1113 1114 1115 1116 1211 1212 1213 1214 1215 1312 1313 1314 1315 1316 1413 1414 1514'.split())
 assert set(mauve.evaluate_all('(els)=>els.map(el=>el.getAttribute("data-region-hex"))'))==expected
 for element in [mauve.first,romanian.first]:
  assert element.get_attribute('stroke-width')=='4.50'
  assert element.get_attribute('stroke-dasharray')=='10 4'
 assert mauve.first.get_attribute('stroke')=='#9475A9'
 assert page.locator('[data-layer="territory-outlines"]').count()==0
 assert page.locator('[data-layer="railways"]').count()==1
 assert not errors,errors
 screenshot=ROOT/'rules/audit/visual/odessa-bessarabia-per-hex-browser-v502.png'
 page.screenshot(path=str(screenshot),clip={'x':610,'y':560,'width':550,'height':630},animations='disabled')
 browser.close()
print('PASS v502 Chromium shared-engine Bessarabia: 19 mauve and 4 Romanian per-hex polygons, style parity, no perimeter')
