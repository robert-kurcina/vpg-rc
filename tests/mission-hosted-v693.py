#!/usr/bin/env python3
"""Real HTTP origin acceptance for all five routes and mission storage.
Run against the local server or a GitHub Pages repository-relative URL.
Uses a new isolated browser context; never modifies an ordinary user's saves.
No intercepted network, localStorage mock, or IndexedDB fixture.
Optional --terminal-save supplies a completed native Moscow JSON from the runner.
"""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://localhost:8765/index.html');parser.add_argument('--chromium',default=None);parser.add_argument('--terminal-save',type=Path);parser.add_argument('--evidence-dir',type=Path,help='Capture actual engine screenshots at desktop and tablet widths');args=parser.parse_args()
if args.evidence_dir: args.evidence_dir.mkdir(parents=True,exist_ok=True)
missions=['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=args.chromium,args=['--no-sandbox','--disable-dev-shm-usage']);context=browser.new_context(viewport={'width':1180,'height':820});page=context.new_page();page.set_default_timeout(60000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded')
 def selector():
  expect(page.locator('[data-mission]')).to_have_count(5)
 def card(id):return page.locator(f'[data-mission="{id}"]')
 def ready(id):
  if id=='battle-for-moscow':
   page.wait_for_function('!!window.__nativePreviewReady');page.evaluate('window.__nativePreviewReady')
  else:
   page.wait_for_function("!!window.HistoricalBrowserPreview || document.getElementById('status')?.textContent.includes('Source/engine initialization failed')")
   if not page.evaluate('!!window.HistoricalBrowserPreview'):
    raise AssertionError(f'{id} initialization failed: {page.locator("#message").inner_text()}')
  expect(page.locator('#mission-menu-toggle')).to_be_visible()
 def snapshot(id):return page.evaluate('WargameSession.serialize(__nativePreview.getSession())' if id=='battle-for-moscow' else 'HistoricalBrowserPreview.save()')
 def menu():
  if not page.locator('#mission-menu').is_visible():page.locator('#mission-menu-toggle').click()
 def verify_shell(id):
  # Exercise the approved shared controls without changing mission state.
  expect(page.locator('#mission-phase-label')).not_to_have_text('')
  expect(page.locator('#mission-menu-toggle .mission-hamburger-glyph > span')).to_have_count(3)
  menu();expect(page.locator('#mission-menu .mission-menu-row')).to_have_count(8)
  page.locator('#mission-menu-toggle').click()
  toggle=page.locator('#mission-sidebar-toggle');gear=page.locator('#mission-settings')
  expect(toggle).to_be_visible();expect(gear).to_be_visible()
  page.evaluate("WargameResponsiveShell.setPreference('mobile')")
  expect(page.locator('body')).to_have_attribute('data-layout-mode','mobile')
  expect(toggle).to_have_attribute('aria-expanded','false')
  gear.click();expect(page.locator('#settings-section')).to_be_visible();expect(gear).to_have_attribute('aria-pressed','true')
  page.keyboard.press('Escape');expect(gear).to_have_attribute('aria-pressed','false');expect(toggle).to_have_attribute('aria-expanded','false')
  toggle.click();expect(toggle).to_have_attribute('aria-expanded','true')
  gear.click();expect(page.locator('#settings-section')).to_be_visible()
  gear.click();expect(toggle).to_have_attribute('aria-expanded','true')
  toggle.click();expect(toggle).to_have_attribute('aria-expanded','false')
  page.evaluate("WargameResponsiveShell.setPreference('auto')")
  print('PASS shared mission menu and mobile panel/settings lifecycle:',id,flush=True)
 def leave(label):
  menu();page.get_by_role('button',name='Exit Game',exact=True).click();page.get_by_role('dialog',name='Leave mission').get_by_role('button',name=label,exact=True).click();selector()
 selector()
 for id in missions:
  expect(card(id).locator('[data-status]')).to_have_text('No local save')
  card(id).get_by_role('link',name='New Mission',exact=True).click();ready(id);before=snapshot(id)
  if args.evidence_dir:
   page.screenshot(path=str(args.evidence_dir/f'{id}-desktop.png'),full_page=True)
   page.set_viewport_size({'width':820,'height':1180})
   expect(page.locator('#mission-menu-toggle')).to_be_visible()
   page.screenshot(path=str(args.evidence_dir/f'{id}-tablet.png'),full_page=True)
   page.set_viewport_size({'width':1180,'height':820})
  verify_shell(id);assert snapshot(id)==before
  leave('Save and return');expect(card(id).locator('[data-resume]')).to_be_visible()
  # An actual successful new save should not be stored in the legacy quota-limited key.
  assert page.evaluate('(id)=>localStorage.getItem(WargameMissionStorage.key(id))===null',id)
  card(id).locator('[data-resume]').click();ready(id);assert snapshot(id)==before
  leave('Discard unsaved progress');expect(card(id).locator('[data-resume]')).to_be_visible()
  print('PASS real-origin save, selector, resume and preservation:',id,flush=True)
 if args.terminal_save:
  path=args.terminal_save.resolve();expected=json.loads(path.read_text());assert expected['state']['over'] and path.stat().st_size>5*1024*1024
  card('battle-for-moscow').locator('[data-resume]').click();ready('battle-for-moscow')
  page.locator('#load-game').set_input_files(str(path));expect(page.locator('#load-game')).to_have_value('');expect(page.locator('#phase-status')).to_contain_text('Game finished')
  assert snapshot('battle-for-moscow')==expected
  leave('Save and return');expect(card('battle-for-moscow').locator('[data-resume]')).to_be_visible()
  card('battle-for-moscow').locator('[data-resume]').click();ready('battle-for-moscow');assert snapshot('battle-for-moscow')==expected
  leave('Discard unsaved progress');print('PASS actual real-origin large terminal mission and exact restoration',flush=True)
 card('battle-for-moscow').locator('[data-resume]').click();ready('battle-for-moscow');menu();page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Abandon Mission',exact=True).click();selector()
 expect(card('battle-for-moscow').locator('[data-status]')).to_have_text('No local save')
 for id in missions[1:]:expect(card(id).locator('[data-resume]')).to_be_visible()
 assert not errors,errors
 print('PASS confirmed abandonment is mission-scoped; four other real-origin saves preserved')
 browser.close()
