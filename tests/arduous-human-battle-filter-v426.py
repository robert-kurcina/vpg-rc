#!/usr/bin/env python3
"""Validate that filtering never removes legal battle proposal access/selection.
All button interactions execute the real Arduous shared browser engine.
"""
import sys
from pathlib import Path
from importlib import import_module
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).resolve().parent))
fixture=import_module('arduous-browser-v419')
ATTACKERS={'arduous-front-r02c02','arduous-front-r02c03','arduous-front-r02c08'}
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1536,'height':1024})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(fixture.html_for('arduous'),wait_until='domcontentloaded',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
 page.locator('#actions button').first.click() # finish air/sea
 view=page.evaluate('HistoricalBrowserPreview.view()')
 n=len(view['proposals'])
 assert n>30
 target=next(p for p in view['proposals'] if p['defenderHex']=='0305' and set(p['attackers'])==ATTACKERS)
 # One filter is shared between ordinary action commands and battle proposals.
 page.locator('#filter').fill('0305')
 matched=[p for p in view['proposals'] if '0305' in p['defenderHex'] or any('0305' in id for id in p['attackers'])]
 assert page.locator('#battle-proposals input[type="checkbox"]').count()==min(len(matched),100)
 assert page.locator('#battle-filter-note').inner_text().startswith(str(len(matched))+' matching')
 j=matched.index(target)
 page.locator('#battle-proposals input[type="checkbox"]').nth(j).check()
 assert '1 selected' in page.locator('#battle-filter-note').inner_text()
 page.locator('#filter').fill('0208')
 assert '1 selected' in page.locator('#battle-filter-note').inner_text(),'Filter must not clear a hidden checked proposal'
 page.locator('#filter').fill('0305')
 assert page.locator('#battle-proposals input[type="checkbox"]').nth(j).is_checked()
 page.locator('#filter').fill('')
 assert page.locator('#battle-proposals input[type="checkbox"]').count()==min(n,100)
 page.locator('#commit-battles').click()
 snap=page.evaluate('HistoricalBrowserPreview.snapshot()')
 assert snap['combat']['status']=='committed' and snap['actionCount']==2
 battles=snap['combat'].get('battles')
 assert not errors,errors
 assert not page.locator('#message').inner_text()
 print('PASS Arduous human battle proposal filtering: source proposals',n,'selection retained, legal battle committed',flush=True)
 browser.close()
