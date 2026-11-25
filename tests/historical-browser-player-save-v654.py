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
PAGES={k:v for k,v in PAGES.items() if k in (args.scenario or ['leningrad'])}
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
  expert=4 if scenario=='arduous' else 7
  page=browser.new_page(viewport={'width':1440,'height':950});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(document(path),wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=30000)
  api='HistoricalBrowserPreview';snap=lambda:page.evaluate(api+'.snapshot()');save=lambda:page.evaluate(api+'.save()');restore=lambda s:page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',s)
  raw=save();actor=snap()['actor'];ok('playerSession' not in raw,'legacy default format')
  page.locator('#ai-assignment').select_option('both');page.locator('#ai-policy').select_option('operational');page.locator('#ai-policy-soviet').select_option('reserve-relief')
  portable=save();ok(portable['playerSession']['players']=={'assignment':'both','german':'operational','soviet':'reserve-relief'},'separate policies');ok({k:v for k,v in portable.items() if k!='playerSession'}==raw,'unchanged engine payload')
  page.locator('#ai-assignment').select_option('manual');page.locator('#ai-policy').select_option('diagnostic');page.locator('#ai-policy-soviet').select_option('diagnostic')
  ok(restore(portable),'restore');ok(save()==portable,'exact configured save');ok(page.locator('#ai-assignment').input_value()=='both','ownership restored');ok(page.locator('#ai-policy').input_value()=='operational','axis restored');ok(page.locator('#ai-policy-soviet').input_value()=='reserve-relief','soviet restored');ok(page.locator('#ai-resume').inner_text()=='Resume automatic play','paused');page.wait_for_timeout(150);ok(save()==portable,'no automatic actions after load')
  bad=json.loads(json.dumps(portable));bad['playerSession']['players']['assignment']='manual';ok(not restore(bad),'tamper rejected');ok(save()==portable,'invalid load preserves configuration and board')
  ok(restore(raw),'old save accepted');ok(save()==raw,'legacy defaults reset');ok(page.locator('#ai-assignment').input_value()=='manual','legacy manual')
  page.locator('#ai-difficulty').select_option('1');page.locator('#ai-difficulty-soviet').select_option(str(expert));graded=save()
  ok(graded['playerSession']['version']==2,'graded metadata version');ok(graded['playerSession']['players']['germanDifficulty']==1 and graded['playerSession']['players']['sovietDifficulty']==expert,'independent grades');ok({k:v for k,v in graded.items() if k!='playerSession'}==raw,'grade does not alter engine state')
  ok(restore(raw),'legacy restore');ok(page.locator('#ai-difficulty').input_value()=='0' and page.locator('#ai-difficulty-soviet').input_value()=='0','legacy grades reset');ok(restore(graded),'graded restore');ok(save()==graded,'exact graded save');ok(page.locator('#ai-difficulty').input_value()=='1' and page.locator('#ai-difficulty-soviet').input_value()==str(expert),'both grades restored')
  legacy=page.evaluate('(raw)=>WargamePlayerSaveConfig.pack(raw,{assignment:"manual",german:"diagnostic",soviet:"diagnostic",germanDifficulty:2,sovietDifficulty:10},["diagnostic","operational","reserve-relief"])',raw);ok(restore(legacy),'legacy numerical restore');ok(save()==legacy,'legacy numerical roundtrip');ok(page.locator('#ai-difficulty option:checked').inner_text()=='Legacy grade 2','legacy label');ok(restore(graded),'restore named grade');ok(page.locator('#ai-difficulty option[value="2"]').count()==0,'legacy option removed')
  old_count=snap()['actionCount'];page.locator('#ai-step').click();ok(snap()['actionCount']==old_count+1,'graded controller executes legal action');ok(not errors,str(errors));print('PASS',scenario,flush=True);page.close()
 browser.close()
print(json.dumps({'checks':checks,'scenarios':list(PAGES)},indent=2))
