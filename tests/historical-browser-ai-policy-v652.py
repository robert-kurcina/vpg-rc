#!/usr/bin/env python3
"""Actual Chromium: load source bytes through an isolated local fixture, exercise
selectable operational policies and exact save/restore.
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
  before=save(); selector=page.locator('#ai-policy' if snap()['actor']=='german' else '#ai-policy-soviet');ok(selector.input_value()=='diagnostic','diagnostic default')
  for mode in ('diagnostic','operational','reserve-relief'):
   selector.select_option(mode);ok(selector.input_value()==mode,'selected '+mode);configured=save()
   page.locator('#ai-step').click();after=save();ok(snap()['actionCount']==1,scenario+' '+mode+' first step')
   ok(page.evaluate(api+'.undo()'),'undo');ok(save()==configured,'exact undo')
   page.locator('#ai-step').click();ok(save()==after,'exact repeat')
   ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',before),'restore opening')
   ok(save()==before,'exact restoration');ok(selector.input_value()=='diagnostic','saved default restored')
  ok(not errors,scenario+' page errors: '+str(errors));print('PASS Chromium',scenario,flush=True);page.close()
 browser.close()
print(json.dumps({'checks':checks,'scenarios':list(PAGES),'transport':'isolated Chromium shipped assets'},indent=2))
