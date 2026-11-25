#!/usr/bin/env python3
"""Actual shipped native page, with source-file transport fixture only."""
import json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'scripts'))
from native_browser_asset_fixture import install_fetch
folder=ROOT/'games/battle-for-moscow/native-preview'; html=(folder/'index.html').read_text()
paths=re.findall(r'<script src="([^"]+)"></script>',html);html=re.sub(r'<script src="[^"]+"></script>','',html)
files={p:json.loads((folder/p).read_text()) for p in ['../game.json','../map.json','../units.json','../deployments.json','../rules.json','../objectives.json','config.json','ui-config.json','ai-config.json','ai-config-objective.json','ai-config-capture.json','../../../maps/battle-for-moscow.json','../../../maps/registry.json']}
checks=0
def ok(test,label):
 global checks
 assert test,label
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1440,'height':950},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded');install_fetch(page,files,ROOT)
 for p in paths:page.add_script_tag(content=(folder/p).read_text())
 page.evaluate('window.__nativePreviewReady');page.wait_for_function('!!__nativePreview.getSession()')
 raw=lambda:page.evaluate('WargameSession.serialize(__nativePreview.getSession())')
 before=raw();ok(page.locator('[data-city-control]').count()==11,'11 committed city markers')
 ok(page.locator('[data-city-control][data-city-owner=german]').count()==2,'German starting cities');ok(page.locator('[data-city-control][data-city-owner=soviet]').count()==9,'Soviet starting cities');ok(raw()==before,'read only')
 ok(not errors,str(errors));print('PASS native city ownership markers',flush=True);browser.close()
