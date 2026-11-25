#!/usr/bin/env python3
"""Chromium verification of the actual shared-engine Kiev–Odessa map SVG (offline)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
svg=(ROOT/'exports/kiev-odessa.svg').read_text()
assert '<svg' in svg
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--disable-dev-shm-usage','--no-sandbox'])
 page=browser.new_page(viewport={'width':1450,'height':1400},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content('<!doctype html><html><head><style>body{margin:0;background:white}svg{width:1360px;height:1350px;display:block}</style></head><body>'+svg+'</body></html>',wait_until='domcontentloaded',timeout=60000)
 selected=page.locator('[data-layer=setup-region-outlines] .setup-region-outline[data-region=bessarabia]').count()
 assert selected==19, selected
 assert page.locator('[data-layer=territory-outlines]').count()==0
 assert page.locator('[data-hex-id="1211"]').count()==1
 assert page.locator('[data-hex-id="1514"]').count()==1
 assert page.locator('[data-layer="railways"]').count()==1
 assert page.locator('[data-layer="setup-region-outlines"]').count()==1
 assert not errors,errors
 page.screenshot(path=str(ROOT/'rules/audit/visual/odessa-bessarabia-browser-v501.png'),clip={'x':610,'y':570,'width':530,'height':620},animations='disabled')
 browser.close()
print('PASS Chromium actual shared-engine Bessarabia v501: 19 per-hex outlines, no perimeter, 6 browser checks')
