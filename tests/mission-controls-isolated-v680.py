"""Actual shipped controls with a storage transport fixture (hosted navigation blocked)."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'tests/historical-browser-player-save-v654.py'
ns={'__file__':str(source)}
exec(source.read_text().split('with sync_playwright() as pw:')[0],ns)
storage='''<script>const fixtureStorage=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>fixtureStorage.has(k)?fixtureStorage.get(k):null,setItem:(k,v)=>fixtureStorage.set(k,String(v)),removeItem:k=>fixtureStorage.delete(k)}});</script>'''
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':950});page.set_default_timeout(15000)
 html=(ROOT/'index.html').read_text().replace('</head>',storage+'</head>')
 html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+ (ROOT/m.group(1)).read_text()+'</script>',html)
 page.set_content(html)
 assert page.locator('[data-mission]').count()==5
 assert page.locator('[data-resume]:visible').count()==0
 page.evaluate('WargameMissionStorage.write(localStorage,"arduous",{state:{turn:2}});dispatchEvent(new Event("pageshow"));')
 assert page.locator('[data-resume]:visible').count()==1
 assert page.locator('[data-mission="arduous"] [data-resume]').is_visible()
 print('PASS selector five routes and isolated resume link',flush=True)
 page.close();page=browser.new_page(viewport={'width':1440,'height':950});page.set_default_timeout(20000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(ns['document']('games/arduous/native-preview/index.html').replace('</head>',storage+'</head>'),wait_until='domcontentloaded',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=30000)
 save=lambda:page.evaluate('HistoricalBrowserPreview.save()')
 before=save();page.locator('#mission-menu-toggle').click();page.get_by_role('button',name='Save Mission',exact=True).click()
 assert page.evaluate('WargameMissionStorage.read(localStorage,"arduous")')==before
 assert page.get_by_role('button',name='Resume Mission',exact=True).is_enabled()
 page.locator('#ai-step').click();assert save()!=before
 page.locator('#mission-menu-toggle').click();page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Resume Mission',exact=True).click();assert save()==before
 page.get_by_role('link',name='Choose Mission',exact=True).click();assert page.get_by_role('dialog',name='Leave mission').is_visible()
 page.get_by_role('button',name='Cancel',exact=True).click();assert not page.get_by_role('dialog',name='Leave mission').is_visible();assert save()==before
 page.locator('#mission-menu-toggle').click();page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Delete local save',exact=True).click();assert page.get_by_role('button',name='Resume Mission',exact=True).is_disabled();assert save()==before
 assert not errors,errors
 print('PASS Arduous actual save, changed state, exact resume, cancel leave and scoped deletion',flush=True)
 browser.close()
