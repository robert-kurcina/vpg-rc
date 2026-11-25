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
# Bounded combat transaction using original human gateway and source-facing counters.
from time import perf_counter
checks=0
def ok(v,msg):
 global checks
 assert v,msg
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':920})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 started=perf_counter()
 page.set_content(html,wait_until='load',timeout=60000)
 page.wait_for_function('window.HistoricalBrowserPreview&&window.HistoricalBrowserPreview.snapshot().phaseId==="german-combat"',timeout=60000)
 api='window.HistoricalBrowserPreview'
 initial=page.evaluate(api+'.snapshot()')
 view=page.evaluate(api+'.view()')
 proposals=view.get('proposals',[])
 print('proposals',len(proposals),'first',str(proposals[:2])[:300],flush=True)
 battle=next((x for x in proposals if x.get('defenderHex')=='0205' and x.get('attackers')==['kiev-front-r01c01','kiev-front-r01c03']),None)
 ok(battle,'source-legal Polish opening combat')
 action={'type':'combat','action':{'type':'commit-battles','battles':[battle]}}
 ok(page.evaluate('(x)=>window.HistoricalBrowserPreview.choose(x)',action),'commit source-legal battle')
 print('declaration committed',round(perf_counter()-started,1),flush=True)
 view=page.evaluate(api+'.view()')
 cmds=view.get('commands',[])
 print('commands',[(x.get('type'),(x.get('action') or {}).get('type')) for x in cmds[:8]],flush=True)
 select=next((x for x in cmds if (x.get('action') or {}).get('type')=='select-battle'),None)
 ok(select,'select-battle catalog')
 ok(page.evaluate('(x)=>window.HistoricalBrowserPreview.choose(x)',select),'select one original source battle')
 print('battle selected',round(perf_counter()-started,1),flush=True)
 view=page.evaluate(api+'.view()')
 print('next command types',[(x.get('type'),(x.get('action') or {}).get('type')) for x in view.get('commands',[])][:15],'prompts',view.get('prompts'),flush=True)
 if any((x.get('action') or {}).get('type')=='commit-ground-air' for x in view.get('commands',[])):
  air=next(x for x in view['commands'] if (x.get('action') or {}).get('type')=='commit-ground-air' and (x.get('action') or {}).get('faceId')=='kiev-front-r03c01')
  ok(page.evaluate('(x)=>window.HistoricalBrowserPreview.choose(x)',air),'commit original FK German air marker')
  print('air committed',round(perf_counter()-started,1),flush=True)
 view=page.evaluate(api+'.view()')
 print('pre-roll',view.get('prompts'),flush=True)
 die=None if any(x.get('automaticNoDie') for x in view.get('prompts',[])) else 3
 ok(page.evaluate('(x)=>window.HistoricalBrowserPreview.roll(x)',die),'commit rule-required CRT die or automatic no-die result')
 view=page.evaluate(api+'.view()')
 print('outcome',view.get('crtOutcome'),'options',len(view.get('options',[])),'elapsed',round(perf_counter()-started,1),flush=True)
 choices=view.get('options',[])
 ok(len(choices)>0,'valid consequences displayed after die')
 candidate=choices[0]
 ok(page.evaluate('(x)=>window.HistoricalBrowserPreview.choose(x)',candidate),'resolve actual combat consequence')
 final=page.evaluate(api+'.snapshot()')
 ok(final['actionCount']==4,'journal records exactly four committed combat decisions')
 ok(final['state']['airUse']['1'].get('kiev-front-r03c01')=='ground','authentic FK ground air face spent once on Turn 1')
 ok(final['state']['units']['kiev-front-r01c01']['strengthStatus']=='printed-reduced','original German attacking counter reduced in exchange')
 ok(final['state']['units']['kiev-front-r03c04']['hex']=='0405','Soviet defender retreated along source-valid Kiev hexsides')
 payload=page.evaluate(api+'.save()')
 ok(page.evaluate('(p)=>window.HistoricalBrowserPreview.restore(p)',payload),'combat restores with journal')
 ok(page.evaluate(api+'.snapshot()')==final,'combat state exact after restore')
 ok(not errors,'no browser errors')
 audit={'checkpoint':252,'version':'v486','checks':checks,'battle':battle,'die':die,'crtOutcome':view.get('crtOutcome'),
 'firstChoice':candidate,'actionCount':final['actionCount'],'phaseId':final['phaseId'],'errors':errors}
 (ROOT/'rules/audit/kiev-human-contested-v486.json').write_text(json.dumps(audit,indent=2)+'\n')
 browser.close()
 print('PASS Kiev browser contested battle',checks,'checks, elapsed',round(perf_counter()-started,1),flush=True)
