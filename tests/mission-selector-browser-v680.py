"""Run shipped files using Chromium with an in-process static HTTP transport."""
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.sync_api import sync_playwright
import mimetypes
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':950});page.set_default_timeout(20000)
 def serve(route):
  p=(ROOT/unquote(urlparse(route.request.url).path).lstrip('/')).resolve()
  if not p.is_relative_to(ROOT) or not p.is_file():return route.fulfill(status=404,body='Not found')
  route.fulfill(status=200,content_type=mimetypes.guess_type(p.name)[0] or 'application/octet-stream',path=str(p))
 page.route('http://mission.test/**',serve)
 page.goto('http://mission.test/index.html',wait_until='domcontentloaded')
 assert page.locator('[data-mission]').count()==5
 assert page.locator('[data-resume]:visible').count()==0
 card=page.locator('[data-mission="arduous"]');card.get_by_text('New Mission').click()
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
 before=page.evaluate('HistoricalBrowserPreview.save()')
 page.get_by_role('button',name='Save Mission',exact=True).click()
 assert page.evaluate('WargameMissionStorage.read(localStorage,"arduous")')==before
 page.goto('http://mission.test/index.html',wait_until='domcontentloaded')
 assert page.locator('[data-resume]:visible').count()==1
 page.locator('[data-mission="arduous"] [data-resume]').click()
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
 assert page.evaluate('HistoricalBrowserPreview.save()')==before
 assert 'restored' in page.locator('.mission-local-status').inner_text()
 print('PASS selector, Arduous local save and cross-navigation exact resume',flush=True)
 browser.close()
