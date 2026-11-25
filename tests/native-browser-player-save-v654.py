#!/usr/bin/env python3
"""Actual shipped native page, with source-file transport fixture only."""
import json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'scripts'))
from native_browser_asset_fixture import install_fetch
folder=ROOT/'games/battle-for-moscow/native-preview'; html=(folder/'index.html').read_text()
paths=re.findall(r'<script src="([^"]+)"></script>',html);html=re.sub(r'<script src="[^"]+"></script>','',html)
files={p:json.loads((folder/p).read_text()) for p in ['../game.json','../map.json','../units.json','../deployments.json','../rules.json','../objectives.json','config.json','ui-config.json','ai-config.json','ai-config-objective.json','ai-config-capture.json','../../../maps/battle-for-moscow.json','../../../maps/registry.json']}
checks=0
def ok(test,label):
 global checks
 assert test,label
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1440,'height':950},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded');install_fetch(page,files,ROOT)
 for p in paths:page.add_script_tag(content=(folder/p).read_text())
 page.evaluate('window.__nativePreviewReady');page.wait_for_function('!!__nativePreview.getSession()')
 raw=lambda:page.evaluate('WargameSession.serialize(__nativePreview.getSession())')
 def select(id,value):page.evaluate('([id,value])=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event("change"));}',[id,value])
 def export():
  with page.expect_download() as d:page.locator('#save-game').click()
  return json.loads(Path(d.value.path()).read_text())
 def load(payload):
  page.locator('#load-game').set_input_files({'name':'test.json','mimeType':'application/json','buffer':json.dumps(payload).encode()})
  page.wait_for_function('document.getElementById("load-game").value===""')
 before=raw();ok(export()==before,'legacy default file');ok(before['state']['side']=='german','starting actor')
 select('native-ai-assignment','german');select('ai-strategy','objective');select('ai-strategy-soviet','capture');portable=export()
 ok(portable['playerSession']['players']=={'assignment':'german','german':'objective','soviet':'capture'},'per-side config');ok({k:v for k,v in portable.items() if k!='playerSession'}==before,'engine payload unchanged')
 select('native-ai-assignment','manual');select('ai-strategy','baseline');select('ai-strategy-soviet','baseline');load(portable)
 ok(export()==portable,'exact download after restore');ok(page.locator('#native-ai-resume').inner_text()=='Resume automatic play','restore paused');page.wait_for_timeout(150);ok(raw()==before,'no actions after load')
 page.locator('#native-ai-resume').click();page.wait_for_function('__nativePreview.getSession().state.side==="soviet"',timeout=30000);after=raw();ok(after!=before,'AI progressed');ok('Objective-guard AI german' in page.locator('#message').inner_text(),'axis strategy used');page.wait_for_timeout(150);ok(raw()==after,'human side protected')
 page.locator('#native-ai-resume').click();page.locator('#ai-play-side').click();page.wait_for_function('__nativePreview.getSession().state.side==="german"',timeout=30000);ok('Objective-advance AI soviet' in page.locator('#message').inner_text(),'soviet strategy used');ok(raw()!=after,'manual soviet AI progressed')
 load(portable);ok(raw()==before,'restore original engine');bad=json.loads(json.dumps(portable));bad['playerSession']['players']['assignment']='both';load(bad);ok('checksum mismatch' in page.locator('#message').inner_text(),'tamper rejected');ok(export()==portable,'bad load preserves save');load(before);ok(export()==before,'old save accepted');ok(page.locator('#native-ai-assignment').input_value()=='manual','legacy default')
 # Explicit per-side grade selection through the actual Settings panel.
 page.locator('[data-game-tab=settings]').click();page.locator('#ai-strategy').select_option('objective');page.locator('#ai-difficulty').select_option('1');page.locator('#ai-difficulty-soviet').select_option('8');page.locator('[data-game-tab=play]').click()
 graded=export();ok(graded['playerSession']['version']==2,'graded metadata version');ok(graded['playerSession']['players']['germanDifficulty']==1 and graded['playerSession']['players']['sovietDifficulty']==8,'independent grades');ok({k:v for k,v in graded.items() if k!='playerSession'}==before,'graded config does not alter rules state')
 load(before);ok(page.locator('#ai-difficulty').input_value()=='0' and page.locator('#ai-difficulty-soviet').input_value()=='0','old saves clear grades');load(graded);ok(export()==graded,'exact graded restore');ok(page.locator('#ai-difficulty').input_value()=='1' and page.locator('#ai-difficulty-soviet').input_value()=='8','both browser grades restored')
 legacy=page.evaluate('(raw)=>WargamePlayerSaveConfig.pack(raw,{assignment:"manual",german:"baseline",soviet:"baseline",germanDifficulty:2,sovietDifficulty:10},["baseline","objective","capture"])',before);load(legacy);ok(export()==legacy,'legacy numerical grades roundtrip');ok(page.locator('#ai-difficulty option:checked').inner_text()=='Legacy grade 2','legacy label');load(graded);ok(page.locator('#ai-difficulty option[value="2"]').count()==0,'legacy option removed after restore')
 expected=page.evaluate('profile=>WargameSession.serialize(WargameNativeSessionAI.playSide(__nativePreview.getSession(),{...profile,difficulty:1}).session)',files['ai-config-objective.json']);page.locator('#ai-play-side').click();page.wait_for_function('__nativePreview.getSession().state.side==="soviet"',timeout=30000);ok(raw()==expected,'actual native side uses selected grade');ok(not errors,str(errors));browser.close()
print(json.dumps({'checks':checks,'scenario':'battle-for-moscow'}))
