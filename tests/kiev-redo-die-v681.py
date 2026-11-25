#!/usr/bin/env python3
"""Chromium: real shared-engine Kiev map/counters, human controls and save/undo.

Local HTTP navigation is blocked in this test environment. This harness inlines
identical packaged engine scripts, CSS, JSON and exported PNG map art; it does
NOT substitute an alternate renderer or gameplay implementation. The normal
shipped page continues to load exports/kiev.svg by relative URL.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, base64

ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'games/kiev/setup-preview/index.html'
SCREENSHOT=ROOT/'rules/audit/visual/kiev-experimental-game-browser-v485.png'
CONF=json.loads((PAGE.parent/'config.json').read_text())
assets={'config.json':dict(CONF)}
for k,v in CONF.items():
 if k in {'map','counterConfig','setup','profile','phaseConfig','combatPolicy','buildupPolicy','housekeepingPolicy','inventoryPolicy','fixedPolicy'}:
  assets[v]=json.loads((PAGE.parent/v).resolve().read_text())
assets[CONF['mapExport']]=(PAGE.parent/CONF['mapExport']).resolve().read_text()
# Browser screenshot uses exact existing shared-engine PNG export because SVG with
# nested data URIs cannot be loaded reliably as an about:blank data URI.
assets['config.json']['mapExport']='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev.png').read_bytes()).decode()
html=PAGE.read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',
 lambda m:'<style>'+(PAGE.parent/m.group(1)).resolve().read_text()+'</style>',html)
html=re.sub(r'<script\s+src="([^"]+)"></script>',
 lambda m:'<script>\n'+(PAGE.parent/m.group(1)).resolve().read_text().replace('</script','<\\/script')+'\n</script>',html)
bootstrap='<script>window.__offlineAssets='+json.dumps(assets,ensure_ascii=True).replace('</script','<\\/script')+';'+\
'''window.fetch=async function(path){if(!Object.prototype.hasOwnProperty.call(window.__offlineAssets,path))return {ok:false,status:404};return {ok:true,status:200,json:async()=>window.__offlineAssets[path],text:async()=>window.__offlineAssets[path]};};</script>'''
html=html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+bootstrap)
# Reopen the recorded legal Kiev Exchange position using the browser save interface.
import hashlib
from time import perf_counter
checks=0
def ok(value,label):
 global checks
 assert value,label
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':920});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=60000)
 snap=lambda:page.evaluate('HistoricalBrowserPreview.snapshot()'); view=lambda:page.evaluate('HistoricalBrowserPreview.view()'); save=lambda:page.evaluate('HistoricalBrowserPreview.save()'); restore=lambda s:page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',s)
 audit=json.loads((ROOT/'rules/audit/kiev-seeded-blocker-v603.json').read_text())
 # Construct the existing versioned human envelope using the production hash function.
 envelope=page.evaluate("(campaign)=>{const payload={format:'historical-human-decision-session',version:1,campaign,pendingRoll:null};return {...payload,integrity:{algorithm:'SHA-256',digest:WargameSyncSha256.sha256(JSON.stringify(payload))}}}",audit['save'])
 ok(restore(envelope),page.locator('#message').inner_text());ok(snap()==audit['snapshot'],'exact restored recorded source position');ok(save()==envelope,'exact source save'); print('restored',flush=True)
 page.locator('#die').select_option('3');page.locator('#submit-die').click(timeout=60000)
 v=view();ok(v['kind']=='post-roll-choice' and v['crtOutcome']=='EX' and v['die']==3,'Exchange visible after committed die')
 target=next(i for i,x in enumerate(v['options']) if x['action']['choices'].get('attackerLossIds')==['kiev-front-r05c01'] and not x['action']['choices'].get('advanceUnitId'))
 pending=save();ok(pending['pendingRoll']['die']==3,'die persisted');page.locator('#undo').click();ok(save()==envelope,'undo committed die');page.locator('#redo').click();ok(save()==pending,'redo restores exact die');button=page.locator(f'#actions button[data-action-index="{target}"]');ok(button.is_visible(),'exhaustion choice displayed');ok('Eliminated' in button.inner_text(),'visible casualty consequence'); print('choices',len(v['options']),button.inner_text(),flush=True)
 button.click(timeout=60000);after=snap();ok('kiev-front-r05c01' not in after['state']['units'],'selected attacker eliminated');ok(after['state']['units']['kiev-front-r02c02']['printedCombatStrength']==3,'other formation reduced');ok(after['state']['units']['kiev-front-r02c02']['hex']!='0303','no prohibited advance');resolved=save()
 ok(page.evaluate('HistoricalBrowserPreview.undo()'),'undo combat');page.locator('#redo').click();ok(save()==resolved,'redo exact chosen consequence');ok(page.evaluate('HistoricalBrowserPreview.undo()'),'undo combat again');ok(restore(pending),'restore committed die');ok(save()==pending,'exact pending restore');ok(page.locator('#redo').is_disabled(),'load clears redo');page.locator(f'#actions button[data-action-index="{target}"]').click(timeout=60000);ok(save()==resolved,'exact reapplication');ok(not errors,str(errors));print('PASS Kiev casualty browser',checks,'assertions',flush=True);browser.close()
