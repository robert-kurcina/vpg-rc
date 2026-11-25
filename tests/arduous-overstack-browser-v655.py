#!/usr/bin/env python3
"""Actual shipped Arduous browser: temporary stacking, explicit phase-end loss and undo/restore."""
from pathlib import Path
import argparse, base64, json, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=0
results={}
def ok(value,label):
 global checks
 assert value,label
 checks+=1
def document(path):
 page=ROOT/path; folder=page.parent
 config=json.loads((folder/'config.json').read_text())
 assets={'config.json':config}
 for value in config.values():
  if isinstance(value,str) and value.endswith('.json') and (folder/value).is_file():
   assets[value]=json.loads((folder/value).read_text())
 export=config['mapExport'];svg=(folder/export).read_bytes()
 config['mapExport']='data:image/svg+xml;base64,'+base64.b64encode(svg).decode()
 html=page.read_text().replace('src="'+export+'"','src="'+config['mapExport']+'"')
 html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',lambda m:'<style>'+(folder/m.group(1)).read_text()+'</style>',html)
 html=re.sub(r'<script\s+src="([^"]+)"></script>',lambda m:'<script>\n'+(folder/m.group(1)).read_text().replace('</script','<\\/script')+'\n</script>',html)
 boot='<script>window.__fixtures='+json.dumps(assets,ensure_ascii=True).replace('</script','<\\/script')+';const originalFetch=window.fetch.bind(window);window.fetch=async p=>Object.hasOwn(__fixtures,p)?{ok:true,status:200,json:async()=>__fixtures[p]}:String(p).startsWith("data:")?originalFetch(p):{ok:false,status:404};</script>'
 return html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+boot)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':950});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(document('games/arduous/native-preview/index.html'),wait_until='domcontentloaded',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=30000)
 snap=lambda:page.evaluate('HistoricalBrowserPreview.snapshot()');view=lambda:page.evaluate('HistoricalBrowserPreview.view()');save=lambda:page.evaluate('HistoricalBrowserPreview.save()')
 choose=lambda a:page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',a)
 restore=lambda s:page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',s)
 # Normal source opening; skip elective battles to reach German Surprise Movement.
 for _ in range(4):
  if snap()['phaseKind']=='special-movement':break
  options=view()['commands'];action=next(x for x in options if x.get('action',{}).get('type') in ('finish-air-sea','commit-battles','finish-combat') and not x.get('action',{}).get('battles'))
  ok(choose(action),'source phase progression')
 ok(snap()['phaseId']=='german-special-movement','surprise movement')
 target=None
 for _ in range(5):
  units=snap()['state']['units'];counts={}
  for u in units.values():
   if u['owner']=='german' and not u.get('marker'):counts[u['hex']]=counts.get(u['hex'],0)+1
  moves=[a for a in view()['commands'] if a['type']=='declare-ground-move']
  candidate=next((a for a in moves if counts.get(a['request']['path'][-1],0)>=2),None)
  if candidate is None:candidate=next((a for a in moves if counts.get(a['request']['path'][-1],0)==1),None)
  ok(candidate is not None,'legal stacking route')
  ok(choose(candidate),'declare movement');ok(choose({'type':'resolve-ground-move'}),'resolve movement')
  if view().get('stackPenalty'):
   target=candidate['request']['path'][-1];break
 ok(target is not None,'overstacked hex reached from actual opening')
 ok('Temporary overstacking' in page.locator('#decision').inner_text(),'visible warning')
 before=save();before_count=len(snap()['state']['units'])
 page.get_by_role('button',name='End movement — remove 1 excess unit(s)',exact=True).click()
 ok(snap().get('stackingCleanup') is True,'phase locked');ok('Movement closed' in page.locator('#decision').inner_text(),'cleanup instruction')
 buttons=page.locator('#actions button');ok(buttons.count()==3,'three valid owner choices')
 locked=save();removed=view()['commands'][0]['unitId'];buttons.first.click()
 ok(removed not in snap()['state']['units'],'selected formation eliminated');ok(len(snap()['state']['units'])==before_count-1,'exactly one formation removed')
 after=save();ok(page.evaluate('HistoricalBrowserPreview.undo()'),'undo selection');ok(save()==locked,'exact undo');ok(restore(after),'restore mid-cleanup');ok(save()==after,'exact restore')
 page.get_by_role('button',name='Complete phase after overstack removal',exact=True).click()
 ok(snap()['phaseId']=='soviet-buildup','phase advanced after removal');ok(not snap().get('stackingCleanup'),'cleanup cleared')
 ok(restore(before),'restore before end movement');ok(snap()['phaseId']=='german-special-movement','old phase restored');ok(view().get('stackPenalty')==1,'temporary stack restored')
 ok(not errors,str(errors));print('PASS Chromium Arduous overstack',checks,'assertions, hex',target,flush=True);browser.close()
