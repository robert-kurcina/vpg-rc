"""Import verified played campaign saves via the shipped UI, with storage fixture.
Usage: python tests/historical-terminal-browser-v694.py DIRECTORY
Directory contains scenario.json files from replay-terminal-journal-v694.js.
"""
import sys,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
saves=Path(sys.argv.pop(1)) if len(sys.argv)>1 and not sys.argv[1].startswith("--") else ROOT/"tests/fixtures/terminal-v694";source=ROOT/'tests/historical-browser-player-save-v654.py';ns={'__file__':str(source)}
exec(source.read_text().split('with sync_playwright() as pw:')[0],ns)
paths={'arduous':'games/arduous/native-preview/index.html','leningrad':'games/leningrad/native-preview/index.html','kiev':'games/kiev/setup-preview/index.html','kiev-odessa':'games/kiev-odessa/experimental-preview/index.html'}
fixture=(ROOT/'tests/fixtures/mission-indexeddb-fixture-v693.js').read_text()
boot='<script>'+fixture+'''\nwindow.dbFixture=MissionStorageFixture.fixture();Object.defineProperty(window,'indexedDB',{value:dbFixture.indexedDB});Object.defineProperty(window,'localStorage',{value:MissionStorageFixture.quotaStorage()});</script>'''
labels={'german-victory':'German victory','soviet-victory':'Soviet victory','draw':'Draw','unresolved-source-rule':'Result unresolved by printed rules'}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for scenario,path in paths.items():
  if ns['args'].scenario and scenario not in ns['args'].scenario:continue
  page=browser.new_page(viewport={'width':1180,'height':820});page.set_default_timeout(60000)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(ns['document'](path).replace('</head>',boot+'</head>'),wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=30000)
  save=lambda:page.evaluate('HistoricalBrowserPreview.save()');snap=lambda:page.evaluate('HistoricalBrowserPreview.snapshot()')
  for path in [saves/(scenario+'.json'),saves/(scenario+'-graduated.json')]:
   if not path.exists():continue
   expected=json.loads(path.read_text());page.locator('#load').set_input_files(str(path));expect(page.locator('#load')).to_have_value('')
   assert save()==expected,(scenario,page.locator('#message').inner_text())
   terminal=snap()['terminal'];assert snap()['cursor']['complete'];assert terminal['outcome'] in labels
   expect(page.locator('#campaign-result strong')).to_have_text(labels[terminal['outcome']]);expect(page.locator('#campaign-result')).to_contain_text(f"{terminal['axisControlledCount']} / {terminal['totalCities']}")
   if 'graduated' in terminal:expect(page.locator('#graduated-score')).to_contain_text('Final experimental victory');expect(page.locator('#campaign-result')).to_contain_text(labels[terminal['historical']['outcome']])
   for control in ['#ai-step','#ai-side','#ai-resume']:expect(page.locator(control)).to_be_disabled()
   if not page.locator('#mission-menu').is_visible():page.locator('#mission-menu-toggle').click()
   page.get_by_role('button',name='Save Mission',exact=True).click();expect(page.locator('.mission-local-status')).to_have_text('Mission saved on this browser.')
   assert page.evaluate('(id)=>WargameMissionStorage.defaultStore().read(id)',scenario)==expected
   page.locator('#undo').click();assert not snap()['cursor']['complete'];expect(page.locator('#campaign-result')).to_have_count(0);expect(page.locator('#ai-step')).to_be_enabled()
   page.locator('#redo').click();assert save()==expected;expect(page.locator('#campaign-result strong')).to_have_text(labels[terminal['outcome']])
   page.locator('#undo').click();assert not snap()['cursor']['complete']
   if not page.locator('#mission-menu').is_visible():page.locator('#mission-menu-toggle').click()
   page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Resume Mission',exact=True).click();expect(page.locator('.mission-local-status')).to_have_text('Saved mission restored.')
   assert save()==expected;expect(page.locator('#campaign-result strong')).to_have_text(labels[terminal['outcome']]);expect(page.locator('#redo')).to_be_disabled()
   assert not errors,errors
   print(json.dumps({'scenario':scenario,'mode':'graduated' if 'graduated' in terminal else 'historical','actions':snap()['actionCount'],'outcome':terminal['outcome'],'terminal':terminal,'exactRestore':True,'terminalUndoRedo':True,'storageFixture':True,'bytes':path.stat().st_size}),flush=True)
  page.close()
 browser.close()
