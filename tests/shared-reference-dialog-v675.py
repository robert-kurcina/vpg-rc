#!/usr/bin/env python3
"""Actual shipped browser routes, read-only modal navigation and active CRT."""
from pathlib import Path
import sys,re,json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from native_browser_asset_fixture import install_fetch
source=ROOT/'tests/historical-browser-player-save-v654.py'
namespace={'__file__':str(source)}
exec(source.read_text().split('with sync_playwright() as pw:')[0],namespace)
checks=0
def ok(value,label):
 global checks
 assert value,label
 checks+=1
def check(page,save):
 before=save()
 page.locator('#game-reference-open').click()
 dialog=page.locator('#game-reference-dialog')
 ok(dialog.is_visible(),'modal visible')
 ok(dialog.locator('[role=tab]').count()==4,'four tabs')
 ok(dialog.locator('ol li').count()>0,'sequence supplied')
 page.keyboard.press('ArrowRight');ok(dialog.locator('[aria-selected=true]').inner_text()=='How To','keyboard tabs')
 page.keyboard.press('ArrowRight');ok('movement' in dialog.locator('[role=tabpanel]').inner_text(),'terrain reference')
 page.keyboard.press('ArrowRight');ok(dialog.locator('.crt-reference-table[data-crt-variant=standard] tr').count()==7,'active Standard CRT')
 ok(dialog.locator('.crt-reference-table thead th').count()==7,'standard columns')
 page.keyboard.press('Escape');ok(not dialog.is_visible(),'Escape closes');page.wait_for_function('document.activeElement.id==="game-reference-open"');ok(True,'focus restored')
 ok(save()==before,'read-only reference')
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for scenario,path in namespace['PAGES'].items():
  page=browser.new_page(viewport={'width':1440,'height':950});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(namespace['document'](path),wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=30000)
  check(page,lambda:page.evaluate('HistoricalBrowserPreview.save()'))
  page.locator('[data-game-tab=settings]').click();page.locator('#advanced-crt').check();page.locator('[data-game-tab=play]').click()
  page.locator('#game-reference-open').click();ok(page.locator('#game-reference-dialog .crt-reference-table[data-crt-variant=standard]').count()==1,'next-game preference not active')
  page.keyboard.press('Escape');page.locator('#new-game').click();page.locator('#game-reference-open').click();ok(page.locator('#game-reference-dialog .crt-reference-table[data-crt-variant=advanced] thead th').count()==9,'active Advanced CRT');page.keyboard.press('Escape')
  if scenario=='leningrad' and os.environ.get('REFERENCE_MOBILE')=='1':
   page.set_viewport_size({'width':390,'height':844});page.locator('.mobile-controls-launcher').click();page.locator('#game-reference-open').click()
   bounds=page.locator('#game-reference-dialog').bounding_box();ok(bounds['x']>=0 and bounds['x']+bounds['width']<=390 and bounds['y']>=0 and bounds['y']+bounds['height']<=844,'mobile modal contained')
   page.keyboard.press('Escape');ok(not page.locator('#game-reference-dialog').is_visible(),'mobile Escape closes modal');ok(page.evaluate('WargameResponsiveShell.isOpen()'),'underlying drawer remains open')
   page.wait_for_function('document.activeElement.id==="game-reference-open"');ok(True,'mobile focus restored')
  ok(not errors,str(errors));print('PASS',scenario,flush=True);page.close()
 folder=ROOT/'games/battle-for-moscow/native-preview';html=(folder/'index.html').read_text()
 paths=re.findall(r'<script src="([^"]+)"></script>',html);html=re.sub(r'<script src="[^"]+"></script>','',html)
 html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(folder/m.group(1)).read_text()+'</style>',html)
 files={p:json.loads((folder/p).read_text()) for p in ['../game.json','../map.json','../units.json','../deployments.json','../rules.json','../objectives.json','config.json','ui-config.json','ai-config.json','ai-config-objective.json','ai-config-capture.json','../../../maps/battle-for-moscow.json','../../../maps/registry.json']}
 page=browser.new_page(viewport={'width':1440,'height':950});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded');install_fetch(page,files,ROOT)
 for p in paths:page.add_script_tag(content=(folder/p).read_text())
 page.evaluate('window.__nativePreviewReady');page.wait_for_function('!!__nativePreview.getSession()')
 check(page,lambda:page.evaluate('WargameSession.serialize(__nativePreview.getSession())'))
 ok(not errors,str(errors));print('PASS Moscow',flush=True);browser.close()
print(json.dumps({'checks':checks}))
