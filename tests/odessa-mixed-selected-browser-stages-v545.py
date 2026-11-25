#!/usr/bin/env python3
"""Real Chromium source-browser acceptance of replay-verified multi-turn customized campaign.

Unlike the v537 uninterrupted replay, individual states are authentic completed
journals authored by the shared source-authoritative engine. The browser restores
and tests these exact action histories, not forged snapshots or screen mockups.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
ns={'__file__':str(ROOT/'tests/odessa-contested-seven-turn-browser-v537.py')}
exec(Path(ns['__file__']).read_text().split('with sync_playwright() as pw:')[0],ns)
V=ROOT/'rules/audit/saves'
report=json.loads((ROOT/'rules/audit/odessa-mixed-selected-seven-turn-v545.json').read_text())
checks=0
def ok(v,label):
 global checks
 assert v,label
 checks+=1

def stage(label):
 return json.loads((V/f'odessa-mixed-selected-{label}-v545.json').read_text())
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(ns['html'],wait_until='load',timeout=60000)
 api='window.HistoricalBrowserPreview'
 page.wait_for_function('window.HistoricalBrowserPreview && HistoricalBrowserPreview.snapshot().phaseId === "german-combat"',timeout=35000)
 snap=lambda:page.evaluate(api+'.snapshot()')
 choose=lambda action:page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',action)
 def restore(label):
  datum=stage(label)
  ok(page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',datum),'Browser restored unmodified signed journal '+label)
  ok(page.locator('#setup-panel').is_hidden(),'Historical campaign live after '+label)
  ok(page.evaluate(api+'.save()')['format']=='historical-custom-campaign','Browser kept original source deployment envelope '+label)
  ok(page.evaluate(api+'.save()')['deployment']==datum['deployment'],'Source face choices and mix match exact original stage '+label)
  ok(snap()['state']['scenarioId']=='kiev-odessa','Original game engine still owns stage '+label)
  return datum
 # Real visible source controls remain usable together.
 page.evaluate(api+'.enterSetup()')
 page.locator('#setup-infantry-reserve').select_option('kiev-front-r02c06')
 page.locator('#setup-mix').click()
 s=page.evaluate(api+'.setupView()')
 ok(s['concealedMixed'],'Real visible Mix action enables ten Soviet source identities')
 ok(s['infantryFaceSelection']['reserveFaceId']=='kiev-front-r02c06','Real source selector sets Turn 3 49 Mtn')
 page.locator('#setup-ready').click()
 ok(page.locator('#setup-panel').is_hidden(),'Real Begin Turn 1 control commits customized opening')
 ok(len(snap()['state']['units'])==36,'Custom live setup has original 36 ground units')
 print('Browser v545: combined source setup controls passed',flush=True)
 saved=restore('turn1-opening')
 ok(snap()['cursor']['turn']==1 and snap()['phaseId']=='german-combat','Authenticated start at original first combat phase')
 mapping=report['mixedPhysicalFaceAssignments']
 for slot,id in mapping.items():
  ok(snap()['state']['units'][id]['sourceFaceId']==id,'Original unique concealed printed face bound '+id)
  ok(snap()['state']['units'][id]['strengthStatus']=='untried','Printed concealed face not revealed '+id)
 ok('kiev-front-r02c06' not in snap()['state']['units'],'Actual 49 Mtn original source off-map until Turn 3')
 ok('kiev-front-r01c07' in snap()['state']['units'],'Original 29 substituted in opening')
 print('Browser v545: original photographed mixed opening replayed',flush=True)
 restore('post-exchange')
 ok(snap()['state']['units']['kiev-front-r01c01']['strengthStatus']=='printed-reduced','Real shared CRT Exchange and printed loss survive browser replay')
 ok(snap()['combat']['status'] in ('battles-resolved','committed'),'Authentic post-Exchange combat state')
 print('Browser v545: contested combat journal replayed',flush=True)
 restore('turn3-pre-arrivals')
 s=snap()
 ok(s['cursor']['turn']==3 and s['phaseId']=='german-buildup','Turn 3 genuine source buildup state loaded')
 ok('kiev-front-r02c06' not in s['state']['units'],'Selected 49 Mtn was not prematurely deployed')
 row=page.locator('#actions button').filter(has_text='Place t3-german-infantry at 0102').first
 ok(row.count()==1,'Visible player Orders button offers original selected 49 Mtn reinforcement')
 row.click(timeout=30000)
 ok(snap()['state']['units']['kiev-front-r02c06']['hex']=='0102','Clicked visible Orders button admits 49 Mtn')
 ok(page.locator('#counter-overlay [data-unit-id="kiev-front-r02c06"]').count()==1,'Actual SVG counter art shows 49 Mtn on board')
 ok(page.evaluate(api+'.undo()'),'Human Undo reverses 49 Mtn placement')
 ok('kiev-front-r02c06' not in snap()['state']['units'],'Undo preserves off-map source reserve')
 ok(choose({'type':'place-reinforcement','slotId':'t3-german-infantry','hex':'0102'}),'Authoritative browser command replays selected-face reinforcement')
 screenshot=ROOT/'rules/audit/visual/odessa-mixed-selected-turn3-browser-v545.png'
 page.screenshot(path=str(screenshot),full_page=False)
 print('Browser v545: real Turn 3 49 Mtn Orders and Undo passed',flush=True)
 restore('turn6-pre-arrival')
 s=snap()
 ok(s['cursor']['turn']==6 and s['phaseId']=='soviet-buildup','Turn 6 genuine Soviet buildup restored')
 ok('kiev-front-r04c06' not in s['state']['units'],'Turn 6 original Soviet army not prematurely deployed')
 row=page.locator('#actions button').filter(has_text='Place t6-soviet-army at 1701').first
 ok(row.count()==1,'Visible player Orders offers original Turn 6 Soviet reinforcement')
 row.click(timeout=30000)
 ok(snap()['state']['units']['kiev-front-r04c06']['hex']=='1701','Real browser places Turn 6 Soviet Army')
 ok(page.evaluate(api+'.undo()'),'Turn 6 player Undo source journal')
 ok('kiev-front-r04c06' not in snap()['state']['units'],'Turn 6 Undo reverts source arrival')
 print('Browser v545: Turn 6 source arrival and Undo passed',flush=True)
 restore('terminal')
 s=snap()
 ok(s['cursor']['complete'],'Real terminal campaign restored from complete action journal')
 ok(s['cursor']['turn']==7,'Source seven-turn finish maintained')
 ok(len(s['state']['units'])==42,'All 42 actual physical ground counter identities render at terminal')
 ok(page.locator('#counter-overlay .official-counter').count()==42,'All 42 source-photo counter templates projected')
 ok(s['state']['units']['kiev-front-r02c06']['sourceFaceId']=='kiev-front-r02c06','Selected 49 Mtn survives terminal replay')
 ok(all(s['state']['units'][id]['sourceFaceId']==id for id in mapping.values()),'Ten original hidden physical identities survive to Turn 7')
 ok(s['terminal'] is not None and isinstance(s['terminal']['outcome'],str),'Actual source terminal city victory evaluation survives')
 saved=page.evaluate(api+'.save()')
 ok(page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',saved),'Browser terminal Save/Restore maintains mixed and selected setup')
 ok(snap()==s,'Browser terminal snapshot byte-identical after Save/Restore')
 ok(page.evaluate(api+'.undo()'),'Terminal end-turn Undo works')
 ok(not snap()['cursor']['complete'],'Terminal Undo returns to live Turn 7')
 ok(page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',saved),'Terminal history restored after Undo')
 page.screenshot(path=str(ROOT/'rules/audit/visual/odessa-mixed-selected-terminal-browser-v545.png'),full_page=False)
 ok(not errors,'No Chromium exceptions '+repr(errors))
 browser.close()
print('PASS v545 real Chromium mixed+selected staged 7-turn replay:',checks,'assertions; browser verified five complete authentic save stages')
