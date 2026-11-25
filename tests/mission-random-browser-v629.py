#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright
import copy
ROOT=Path(__file__).resolve().parents[1]
ns={'__file__':str(ROOT/'tests/odessa-mixed-seam-city-seven-turn-browser-v549.py')}
exec(Path(ns['__file__']).read_text().split('with sync_playwright() as pw:')[0],ns)
count=0
def ok(x,m):
 global count
 assert x,m
 count+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':900})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(ns['html'],wait_until='load',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=40000)
 api='HistoricalBrowserPreview';save=lambda:page.evaluate(api+'.save()');restore=lambda s:page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',s)
 seed=save()['missionSeed'];ok(len(seed)==32,'Initial mission seed')
 page.evaluate(api+'.reset()');seed2=save()['missionSeed'];ok(seed!=seed2,'New mission changes seed')
 page.evaluate(api+'.enterSetup()');setup=save();ok(setup['missionRandom']['seed']==seed2,'Deployment and campaign share master seed')
 page.locator('#setup-mix').click();mixed=save();ok(mixed['missionRandom']['draws']==9,'Ten-counter shuffle consumes nine draws')
 page.locator('#setup-mix').click();remixed=save();ok(remixed['missionRandom']['draws']==18,'Next mix advances deployment stream')
 ok(restore(mixed),'Restore seed-bearing setup');ok(save()==mixed,'Exact setup save after restore')
 page.locator('#setup-mix').click();ok(save()==remixed,'Remix reproducible after restore')
 forged=copy.deepcopy(remixed);forged['missionRandom']['draws']=1;ok(not restore(forged),'Tampered setup RNG rejected');ok(save()==remixed,'Rejected load preserves active setup')
 page.locator('#setup-ready').click();ok(save()['human']['missionSeed']==seed2,'Begin game preserves master seed')
 for action in [ {'type':'combat','action':{'type':'finish-air-sea'}}, {'type':'combat','action':{'type':'commit-battles','battles':[{'defenderHex':'0502','attackers':['kiev-front-r02c03']}]}}, {'type':'combat','action':{'type':'select-battle','defenderHex':'0502'}}, {'type':'combat','action':{'type':'commit-ground-air','faceId':None}}]:
  ok(page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',action),'Kovel action '+str(action)+' '+page.locator('#message').inner_text())
 before=save();page.locator('#random-die').click();pending=save();die=page.evaluate(api+'.view().die');ok(die in range(1,7),'Actual random d6 committed')
 ok(restore(pending),'Pending die restored');ok(save()==pending,'Exact pending seed and die preserved')
 ok(page.evaluate(api+'.undo()'),'Undo pending die');ok(save()==before,'Pre-roll state restored');page.locator('#random-die').click();ok(save()==pending,'Identical die reproduced after Undo')
 ok(not errors,'No Chromium errors '+str(errors));browser.close()
print('PASS mission RNG historical Chromium',count,'assertions')
