#!/usr/bin/env python3
"""Real Chromium source-position editor feeding existing Kiev–Odessa campaign.

The original approved map raster, source counter art, native browser events and
shared engine are used. No generated images or parallel gameplay controller.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, base64
ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'games/kiev-odessa/experimental-preview/index.html'
CONF=json.loads((PAGE.parent/'config.json').read_text())
assets={'config.json':dict(CONF)}
for k,v in CONF.items():
 if k in {'map','counterConfig','profile','phaseConfig','combatPolicy','rosterOverlay','opening','setupPolicy','firstTurnEmptyBuildupPolicy','buildupPolicy','buildupAllocation','housekeepingPolicy'}:
  assets[v]=json.loads((PAGE.parent/v).resolve().read_text())
assets['config.json']['mapExport']='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev-odessa.png').read_bytes()).decode()
html=PAGE.read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',lambda m:'<style>'+(PAGE.parent/m.group(1)).resolve().read_text()+'</style>',html)
html=re.sub(r'<script\s+src="([^"]+)"></script>',lambda m:'<script>\n'+(PAGE.parent/m.group(1)).resolve().read_text().replace('</script','<\\/script')+'\n</script>',html)
bootstrap='<script>window.__offlineAssets='+json.dumps(assets,ensure_ascii=True).replace('</script','<\\/script')+';'+'''window.fetch=async function(path){if(!Object.prototype.hasOwnProperty.call(window.__offlineAssets,path))return {ok:false,status:404};return {ok:true,status:200,json:async()=>window.__offlineAssets[path],text:async()=>window.__offlineAssets[path]};};</script>'''
html=html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+bootstrap)
checks=0
def yes(v,msg):
 global checks
 assert v,msg
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':900},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=60000)
 api='window.HistoricalBrowserPreview'
 page.wait_for_function('window.HistoricalBrowserPreview && window.HistoricalBrowserPreview.snapshot().phaseId === "german-combat"',timeout=30000)
 yes(page.locator('#configure-setup').get_attribute('hidden') is None,'Candidate setup button enabled in Settings')
 yes(page.evaluate(api+'.enterSetup()') is None,'Can enter source-constrained setup')
 yes(page.locator('#setup-panel').is_visible(),'Real source setup panel shown')
 yes(page.locator('#game-sidebar').get_attribute('data-active-tab')=='play','Entering setup switches from Settings to playable setup controls')
 yes(page.locator('.support-window').is_hidden(),'Non-actionable Air/Fleet Support window hidden during placement')
 yes(page.locator('#decision-section').is_hidden(),'Battle decisions hidden during setup')
 initial=page.evaluate(api+'.setupView()')
 yes(initial['sourceCounterCount']==36 and initial['sourceFleetCount']==1,'36 original ground counters + separate Fleet')
 yes(initial['unselectedFrontlineHexes']==['1113'],'One of twelve Soviet frontline stars initially empty')
 yes(page.locator('#counter-overlay [data-unit-id]').count()==36,'Actual shared-engine source artwork in setup')
 yes(page.locator('#counter-overlay [data-unit-id="kiev-front-r05c04"]').get_attribute('tabindex')=='0','Setup counters keyboard-focusable')
 page.locator('#counter-overlay [data-unit-id="kiev-front-r05c04"]').focus()
 page.keyboard.press('Enter')
 yes(page.evaluate(api+'.setupSelection()')['id']=='kiev-front-r05c04','Keyboard Enter selects source counter')
 page.keyboard.press('Escape')
 yes(page.evaluate(api+'.setupSelection()') is None,'Keyboard Escape cancels source setup selection')
 yes(page.locator('#setup-ready').is_enabled(),'Validated baseline source setup eligible for Turn 1')
 yes(page.locator('#setup-mix').is_visible(),'Kiev–Odessa concealed source mixing now available')
 invalid=page.evaluate(api+".setupMove('kiev-front-r05c04','0706')")
 yes(invalid is False,'Original source-rejected 0706 placement fails closed')
 yes(page.evaluate(api+'.setupView()')['placements']==initial['placements'],'Rejected source move did not modify placements')
 yes('unapproved-source-destination' in page.locator('#message').inner_text(),'Visible rule-specific rejection')
 # A genuine DOM click on a counter then the shared SVG hit layer at 1113.
 page.locator('#counter-overlay [data-unit-id="kiev-front-r05c04"]').dispatch_event('click',{'bubbles':True})
 yes(page.evaluate(api+'.setupSelection()')['id']=='kiev-front-r05c04','Actual counter click selected original Soviet Mechanized source')
 yes(page.locator('#counter-overlay [data-hex="1113"]').get_attribute('data-setup-eligible')=='true','Legal star highlighted by authoritative editor')
 page.locator('#counter-overlay [data-hex="1113"]').dispatch_event('click',{'bubbles':True})
 moved=page.evaluate(api+'.setupView()')
 yes(moved['placements']['kiev-front-r05c04']=='1113','SVG board click moved original counter to spare star')
 yes(moved['unselectedFrontlineHexes']==['0808'],'Exactly one star unused after source-legal move')
 yes(page.locator('#counter-overlay [data-unit-id="kiev-front-r05c04"]').count()==1,'Moved source art still physically rendered')
 # Position exchanges use the original counter identities and must be atomic.
 yes(page.evaluate(api+".setupSwapPosition('kiev-front-r01c01','kiev-front-r01c02')"),'Valid original Panzer source cross exchange')
 swapped=page.evaluate(api+'.setupView()')
 yes(swapped['placements']['kiev-front-r01c01']=='0203' and swapped['placements']['kiev-front-r01c02']=='0105','Two Panzer placements atomically swapped')
 yes(page.evaluate(api+".setupSwapPosition('kiev-front-r01c01','kiev-front-r03c04')") is False,'Cross-faction swap rejected')
 yes(page.evaluate(api+'.setupView()')['placements']==swapped['placements'],'Invalid swap atomic rollback')
 setup_save=page.evaluate(api+'.save()')
 yes(setup_save['format']=='historical-source-setup-candidate-v1','Editor uses distinct source-pinned save envelope')
 yes(page.evaluate('(s)=>'+api+'.restore(s)',setup_save),'Actual browser editor restore')
 yes(page.evaluate(api+'.setupView()')['placements']==swapped['placements'],'User positions survive source-validated editor reload')
 forged=json.loads(json.dumps(setup_save));forged['placements']['kiev-front-r05c04']='0105'
 yes(page.evaluate('(s)=>'+api+'.restore(s)',forged) is False,'Tampered setup rejected on browser load')
 yes(page.evaluate(api+'.setupView()')['placements']==swapped['placements'],'Rejected restore leaves current setup unchanged')
 # Begin the real shared game from this custom placement, not a source mockup.
 page.locator('#setup-ready').click()
 yes(page.locator('#setup-panel').is_hidden(),'Actual Begin Turn 1 DOM control starts game')
 state=page.evaluate(api+'.snapshot()')
 yes(state['phaseId']=='german-combat' and state['cursor']['turn']==1,'Turn 1 German Combat resumed from edited setup')
 yes(page.locator('.support-window').is_visible(),'Air/Fleet Support window restored when combat begins')
 yes(state['state']['units']['kiev-front-r05c04']['hex']=='1113' and state['state']['units']['kiev-front-r05c04']['openingHex']=='1113','Custom placement and immutable opening lineage match')
 yes(state['state']['units']['kiev-front-r01c01']['hex']=='0203','Custom Panzer swap retained in real campaign')
 yes(len(state['state']['units'])==36 and state['state']['supportMarkers']['blackSeaFleet']['hex']=='1513','Source ground/Fleet separation maintained')
 yes('finish-air-sea' in [a.get('action',{}).get('type') for a in page.evaluate(api+'.view()').get('commands',[])],'Real source combat choices available')
 custom_save=page.evaluate(api+'.save()')
 yes(custom_save['format']=='historical-custom-campaign','Custom setup + live game saved as a single checked envelope')
 yes(custom_save['deployment']['format']=='historical-source-setup-candidate-v1','Custom save embeds verified original setup')
 yes(page.evaluate(api+".choose({type:'combat',action:{type:'finish-air-sea'}})"),'Gameplay action executed in the ordinary journal')
 yes(page.evaluate(api+'.snapshot()')['actionCount']==1,'Committed real combat phase action')
 yes(page.evaluate(api+'.undo()'),'Undo from source setup campaign uses original engine journal')
 yes(page.evaluate(api+'.snapshot()')['actionCount']==0,'Undo resets original game phase action')
 yes(page.evaluate(api+".choose({type:'combat',action:{type:'finish-air-sea'}})"),'Replay combat choice after Undo')
 one_action=page.evaluate(api+'.save()')
 yes(page.evaluate('(s)=>'+api+'.restore(s)',one_action),'Restore real journal plus custom source setup')
 yes(page.evaluate(api+'.snapshot()')['actionCount']==1,'Committed phase survives custom journal restore')
 yes(page.evaluate(api+'.snapshot()')['state']['units']['kiev-front-r05c04']['hex']=='1113','Source positions survive committed journal restore')
 page.evaluate(api+".selectTab('settings')")
 page.locator('#configure-setup').click()
 yes('already in progress' in page.locator('#message').inner_text(),'Actual Settings button visibly rejects redeployment of in-progress game')
 yes(page.locator('#setup-panel').is_hidden(),'Rejected redeployment does not alter live phase')
 # A saved unmodified sample remains backwards compatible.
 page.evaluate(api+'.reset()')
 yes(page.evaluate(api+'.snapshot()')['state']['units']['kiev-front-r05c04']['hex']=='0808','Reset restores original approved experimental sample')
 standard=page.evaluate(api+'.save()')
 yes(standard['format']=='historical-human-decision-session','Original non-custom save remains supported')
 yes(page.evaluate('(s)=>'+api+'.restore(s)',standard),'Original experimental journal restore still supported')
 yes(not errors,'No Chromium page errors: '+str(errors))
 page.evaluate(api+'.enterSetup()')
 screenshot=ROOT/'rules/audit/visual/odessa-source-constrained-deployment-browser-v534.png'
 screenshot.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(screenshot),full_page=False)
 browser.close()
print('PASS v534 actual source setup browser',checks,'assertions')
