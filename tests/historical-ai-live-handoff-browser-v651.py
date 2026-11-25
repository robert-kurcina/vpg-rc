#!/usr/bin/env python3
"""Actual Chromium: load source bytes through an isolated local fixture, exercise
AI controls, exact save/restore, return to human control and fixed-die guard.
No alternate rules implementation and no rendered mock-up."""
from pathlib import Path
import argparse, base64, json, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
PAGES={'leningrad':'games/leningrad/native-preview/index.html',
       'arduous':'games/arduous/native-preview/index.html',
       'kiev':'games/kiev/setup-preview/index.html',
       'kiev-odessa':'games/kiev-odessa/experimental-preview/index.html'}
parser=argparse.ArgumentParser()
parser.add_argument('--scenario',choices=PAGES,action='append',help='Run only the selected scenario(s)')
args=parser.parse_args()
if args.scenario:PAGES={k:v for k,v in PAGES.items() if k in args.scenario}
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
 for scenario,path in PAGES.items():
  page=browser.new_page(viewport={'width':1440,'height':950})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(document(path),wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=30000)
  api='HistoricalBrowserPreview';snap=lambda:page.evaluate(api+'.snapshot()');save=lambda:page.evaluate(api+'.save()')
  before=save();initial=snap();ok(initial['actionCount']==0,scenario+' initial state')
  page.locator('#ai-step').click();after=save();ok(snap()['actionCount']==1,scenario+' AI step')
  ok(page.evaluate(api+'.undo()'),scenario+' undo')
  ok(save()==before,scenario+' exact undo')
  page.locator('#ai-step').click();ok(save()==after,scenario+' exact reapplication')
  ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',after),scenario+' load')
  ok(save()==after,scenario+' exact save restoration')
  if scenario=='leningrad':
   # Commit a human battle and die through the real gateway, then make sure
   # neither AI control consumes or replaces the already committed result.
   def choose(a):
    ok(page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',a),str(a)+' '+page.locator('#message').inner_text())
   ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',before),'initial state for human battle')
   v=page.evaluate(api+'.view()')
   if not v['proposals']:
    finish=next((a for a in v['commands'] if a.get('action',{}).get('type')=='finish-air-sea'),None)
    if finish:choose(finish);v=page.evaluate(api+'.view()')
   battle=v['proposals'][0]
   choose({'type':'combat','action':{'type':'commit-battles','battles':[battle]}})
   choose({'type':'combat','action':{'type':'select-battle','defenderHex':battle['defenderHex']}})
   v=page.evaluate(api+'.view()')
   air=next((a for a in v['commands'] if a.get('action',{}).get('type')=='commit-ground-air' and a['action']['faceId'] is None),None)
   if air:choose(air)
   ok(page.evaluate('HistoricalBrowserPreview.roll(2)') or page.evaluate('HistoricalBrowserPreview.roll(null)'), 'human committed die')
   pending=save()
   page.locator('#ai-step').click();ok(save()==pending,'AI step refused pending die')
   page.locator('#ai-side').click();ok(save()==pending,'AI side refused pending die')
   ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',after),'return to original AI-step state')
   page.locator('#ai-side').click()
   page.wait_for_function('!document.querySelector("#ai-side").disabled',timeout=90000)
   end=snap();ok(end['actor']!=initial['actor'],'AI side stopped at faction boundary')
   ok(end['actionCount']>1,'AI side advanced multiple actions')
   ok(page.locator('#ai-stop').is_hidden(),'AI relinquished control')
   ok(not page.locator('#message').inner_text().startswith(('Baseline stopped:','AI stopped:')),'AI completed without blocker')
   # New actor makes a legal human action after the AI relinquishes control.
   v=page.evaluate(api+'.view()');command=v['commands'][0];choose(command)
   ok(snap()['actionCount']==end['actionCount']+1,'human regained control')
   results[scenario]={'aiSideActions':end['actionCount']-1,'pendingDieGuard':True,'humanRegainedControl':True}
  else:results[scenario]={'singleStepUndoReplayRestore':True}
  ok(not errors,scenario+' page errors: '+str(errors))
  print('PASS Chromium',scenario,flush=True)
  page.close()
 browser.close()
print(json.dumps({'checks':checks,'scenarios':results,'transport':'isolated Chromium inline shipped assets and local JSON fetch'},indent=2))
