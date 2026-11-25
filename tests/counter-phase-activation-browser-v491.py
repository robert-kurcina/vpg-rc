#!/usr/bin/env python3
"""Actual Kiev engine/browser: Oberlabs-style per-phase activation check overlay.

Runs the unmodified shipped page and shared renderer from inlined local files;
only browser network transport is stubbed because loopback HTTP is restricted.
"""
import base64,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'games/kiev/setup-preview/index.html'
SHOT=ROOT/'rules/audit/visual/kiev-phase-activation-browser-v491.png'
conf=json.loads((PAGE.parent/'config.json').read_text())
assets={'config.json':dict(conf)}
for k,v in conf.items():
 if k in {'map','counterConfig','setup','profile','phaseConfig','combatPolicy','buildupPolicy','housekeepingPolicy','inventoryPolicy','fixedPolicy'}:
  assets[v]=json.loads((PAGE.parent/v).resolve().read_text())
assets[conf['mapExport']]=(PAGE.parent/conf['mapExport']).resolve().read_text()
assets['config.json']['mapExport']='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev.png').read_bytes()).decode()
html=PAGE.read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',lambda m:'<style>'+(PAGE.parent/m.group(1)).resolve().read_text()+'</style>',html)
html=re.sub(r'<script\s+src="([^"]+)"></script>',lambda m:'<script>\n'+(PAGE.parent/m.group(1)).resolve().read_text().replace('</script','<\\/script')+'\n</script>',html)
bootstrap='<script>window.__offlineAssets='+json.dumps(assets,ensure_ascii=True).replace('</script','<\\/script')+';'+'''window.fetch=async function(path){if(!Object.prototype.hasOwnProperty.call(window.__offlineAssets,path))return {ok:false,status:404};return {ok:true,status:200,json:async()=>window.__offlineAssets[path],text:async()=>window.__offlineAssets[path]};};</script>'''
html=html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+bootstrap)
N=0
def ok(v,msg):
 global N
 assert v,msg
 N+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1365,'height':960})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=60000)
 page.wait_for_function('window.HistoricalBrowserPreview&&window.HistoricalBrowserPreview.snapshot().phaseId==="german-combat"',timeout=60000)
 api='window.HistoricalBrowserPreview'
 get=lambda:page.evaluate(api+'.snapshot()')
 count=lambda:page.locator('#counter-overlay [data-phase-activated="true"]').count()
 marked=lambda:page.locator('#counter-overlay .official-counter:has([data-phase-activated="true"])').evaluate_all('(nodes)=>nodes.map(n=>n.getAttribute("data-unit-id")).sort()')
 ok(count()==0,'initial combat has no activated units')
 ok(page.locator('#counter-overlay .official-counter').count()==30,'original source counter rendering')
 for a in [('combat','commit-battles',{'battles':[{'defenderHex':'0205','attackers':['kiev-front-r01c01','kiev-front-r01c03']}]}),
           ('combat','select-battle',{'defenderHex':'0205'}),
           ('combat','commit-ground-air',{'faceId':'kiev-front-r03c01'})]:
  cmd={'type':a[0],'action':{'type':a[1],**a[2]}}
  ok(page.evaluate('(x)=>HistoricalBrowserPreview.choose(x)',cmd),'legal '+a[1])
  ok(count()==0,'declaration or support commitment does not mark attackers')
 ok(page.evaluate('HistoricalBrowserPreview.roll(3)'),'post-commit die accepted')
 ok(count()==0,'die inspection does not mark attackers')
 opts=page.evaluate(api+'.view().options')
 selected=next((x for x in opts if 'kiev-front-r01c01' in (x.get('action') or {}).get('choices',{}).get('attackerLossIds',[])),None)
 ok(selected is not None,'source-legal EX consequence available')
 ok(page.evaluate('(x)=>HistoricalBrowserPreview.choose(x)',selected),'EX resolved')
 ok(marked()==['kiev-front-r01c01','kiev-front-r01c03'],'only attacking counters marked following completed combat')
 ok(page.locator('#counter-overlay [data-phase-activated="true"]').evaluate_all('(nodes)=>nodes.every(n=>n.getAttribute("pointer-events")==="none")'),'all badges pointer inert')
 SHOT.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(SHOT),animations='disabled',full_page=False)
 saved=page.evaluate(api+'.save()')
 ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',saved),'save/restore succeeds')
 ok(marked()==['kiev-front-r01c01','kiev-front-r01c03'],'restored save recomputes badges')
 ok(page.evaluate('HistoricalBrowserPreview.undo()'),'Undo previous resolved combat action')
 ok(count()==0,'Undo clears completed activation')
 ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',saved),'restore resolved state again')
 finish=next(x for x in page.evaluate(api+'.view().commands') if x.get('action',{}).get('type')=='finish-combat')
 ok(page.evaluate('(x)=>HistoricalBrowserPreview.choose(x)',finish),'finish combat phase')
 ok(count()==0,'phase transition clears combat markers')
 ok(get()['phaseKind']!='combat','new phase not combat')
 # A movement order is only marked after its consequence is resolved.
 view=page.evaluate(api+'.view()')
 moves=[x for x in view.get('commands',[]) if x.get('type')=='declare-ground-move']
 ok(len(moves)>0,'source-authorized move offered in subsequent phase')
 candidate=moves[0]
 moving=candidate['request']['unitId']
 ok(page.evaluate('(x)=>HistoricalBrowserPreview.choose(x)',candidate),'ground movement declared')
 ok(moving not in marked(),'pending movement does not mark counter')
 resolutions=[x for x in page.evaluate(api+'.view().commands') if x.get('type')=='resolve-ground-move']
 ok(len(resolutions)>0,'source-authorized movement completion offered')
 ok(page.evaluate('(x)=>HistoricalBrowserPreview.choose(x)',resolutions[0]),'ground movement resolved')
 ok(moving in marked(),'resolved movement immediately marks same counter')
 ok(page.evaluate('HistoricalBrowserPreview.undo()'),'Undo restores pending movement')
 ok(moving not in marked(),'Undo removes movement marker')
 ok(not errors,'no browser javascript errors '+str(errors))
 browser.close()
print('PASS v491 actual Kiev Chromium activation',N,'checks',SHOT)
