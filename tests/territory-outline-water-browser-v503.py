#!/usr/bin/env python3
"""Chromium screenshot: actual 269/v503 SVG. No mockup or replacement map."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
svg=(ROOT/'exports/kiev-odessa.svg').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1450,'height':1400},device_scale_factor=2)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content('<!doctype html><html><head><style>body{margin:0;background:#fff}svg{width:1360px;height:1350px;display:block}</style></head><body>'+svg+'</body></html>',wait_until='domcontentloaded',timeout=60000)
 got=page.evaluate('''() => {
  const svg=document.querySelector('svg');const tags=['terrain','fortifications','setup-region-outlines','rivers','water-bodies','roads','railways','hex-grid','coordinates'];
  return tags.map(x=>{const el=svg.querySelector('[data-layer="'+x+'"]');return {name:x,exists:!!el,index:el ? Array.from(svg.querySelectorAll('[data-layer]')).indexOf(el) : -1}})
 }''')
 by={x['name']:x['index'] for x in got}
 assert all(v>=0 for v in by.values()),by
 assert by['terrain']<by['fortifications']<by['setup-region-outlines']<by['rivers']<by['water-bodies']<by['roads']<by['railways']<by['hex-grid']<by['coordinates'],by
 assert page.locator('[data-layer="setup-region-outlines"] [data-region="romanian-turn1-setup"]').count()==4
 assert page.locator('[data-layer="setup-region-outlines"] [data-region="bessarabia"]').count()==19
 assert page.locator('[data-layer="territory-outlines"]').count()==0
 assert not errors,errors
 screenshot=ROOT/'rules/audit/visual/odessa-territory-under-water-browser-v503.png'
 page.screenshot(path=str(screenshot),clip={'x':450,'y':490,'width':700,'height':680},animations='disabled')
 browser.close()
print('PASS v503 Chromium: correct water/layer order, 4 Romania + 19 Bessarabia; actual engine screenshot')
