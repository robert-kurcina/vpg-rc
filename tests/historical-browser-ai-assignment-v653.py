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
  page=browser.new_page(viewport={'width':1440,'height':950});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(document(path),wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=30000)
  api='HistoricalBrowserPreview';snap=lambda:page.evaluate(api+'.snapshot()');save=lambda:page.evaluate(api+'.save()')
  before=save(); engine=lambda s:{k:v for k,v in s.items() if k!='playerSession'}; actor=snap()['actor'];ok(actor in ('german','soviet'),'actor');opponent='soviet' if actor=='german' else 'german'
  selector=page.locator('#ai-assignment');resume=page.locator('#ai-resume')
  ok(selector.input_value()=='manual','manual default');selector.select_option(opponent);resume.click();page.wait_for_timeout(100);ok(engine(save())==before,'human side untouched')
  page.locator('#ai-side').click();ok(engine(save())==before,'manual AI cannot take human side while armed')
  selector.select_option(actor);ok(engine(save())==before,'assignment is paused');resume.click()
  page.wait_for_function('HistoricalBrowserPreview.snapshot().actionCount>0',timeout=60000)
  page.evaluate('document.getElementById("ai-stop").click()')
  page.wait_for_function('document.getElementById("ai-stop").hidden',timeout=60000)
  after=save();page.wait_for_timeout(100);ok(save()==after,'no action after stop or boundary')
  ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',before),'restore');ok(save()==before,'exact restoration');page.wait_for_timeout(100);ok(save()==before,'restore pauses automation')
  selector.select_option('both');resume.click();page.wait_for_function('HistoricalBrowserPreview.snapshot().actionCount>0',timeout=60000)
  page.evaluate('document.getElementById("ai-stop").click()')
  page.wait_for_function('document.getElementById("ai-stop").hidden',timeout=60000)
  ok(page.evaluate(api+'.undo()'),'undo');after=save();page.wait_for_timeout(100);ok(save()==after,'undo pauses automation');ok(not errors,str(errors));
  if scenario=='leningrad':
   ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',before),'restore for natural handoff')
   selector.select_option(actor);resume.click()
   page.wait_for_function('HistoricalBrowserPreview.snapshot().actor!=='+json.dumps(actor)+' && document.getElementById("ai-stop").hidden',timeout=90000)
   end=save();page.wait_for_timeout(100);ok(save()==end,'natural boundary stays human controlled')
   v=page.evaluate(api+'.view()');n=snap()['actionCount'];ok(page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',v['commands'][0]),'human action after automatic handoff');ok(snap()['actionCount']==n+1,'human advanced')
  ok(not errors,str(errors));print('PASS',scenario,flush=True);page.close()
 browser.close()
print(json.dumps({'checks':checks,'scenarios':list(PAGES)},indent=2))
