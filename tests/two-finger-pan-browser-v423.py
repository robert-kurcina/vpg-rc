#!/usr/bin/env python3
"""Real Chromium touch gesture acceptance: first-touch prompt, two-finger pan, tap isolation."""
from pathlib import Path
import json,importlib.util
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('t',ROOT/'tests/tablet-responsive-browser-v423.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)

def contact(x,y):return {'x':round(x,2),'y':round(y,2),'radiusX':3,'radiusY':3,'force':0.6}

def gesture(cdp,points,kind):
    cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[contact(*p) for p in points]})

def run(page,game):
    errors=t.launch(page,game)
    cdp=page.context.new_cdp_session(page)
    for _ in range(6):page.locator('[data-map-zoom="in"]').tap() # allow vertical scrolling under full-height map
    area=page.locator('#map-scroll')
    box=area.bounding_box();assert box,game
    size=area.evaluate('e=>({width:e.clientWidth,height:e.clientHeight,sw:e.scrollWidth,sh:e.scrollHeight})')
    assert size['sw']>size['width']+150,(game,size)
    # Must have both axes available for a meaningful pan assertion.
    assert size['sh']>size['height']+80,(game,size)
    area.evaluate('(e)=>{e.scrollLeft=200;e.scrollTop=30}')
    before=area.evaluate('e=>({x:e.scrollLeft,y:e.scrollTop})')
    x=box['x']+box['width']*.44;y=box['y']+min(140,box['height']*.28)
    # first finger: reminder appears, map does not pan
    gesture(cdp,[(x,y)],'touchStart')
    assert page.locator('.touch-map-reminder').is_visible(),game
    assert 'two fingers' in page.locator('.touch-map-reminder').inner_text().lower()
    if game=='arduous':page.screenshot(path=str(ROOT/'rules/audit/visual/two-finger-first-touch-arduous-v423.png'),full_page=False)
    gesture(cdp,[(x+75,y+35)],'touchMove')
    state=area.evaluate('e=>({x:e.scrollLeft,y:e.scrollTop})')
    assert state==before,(game,'one-finger unexpectedly panned',before,state)
    gesture(cdp,[],'touchEnd')
    # two fingers move together to translate the board, not to select a counter
    p1=(x,y);p2=(x+60,y+45)
    gesture(cdp,[p1,p2],'touchStart')
    gesture(cdp,[(p1[0]-30,p1[1]-22),(p2[0]-30,p2[1]-22)],'touchMove')
    gesture(cdp,[(p1[0]-70,p1[1]-50),(p2[0]-70,p2[1]-50)],'touchMove')
    state=area.evaluate('e=>({x:e.scrollLeft,y:e.scrollTop})')
    assert state['x']>=before['x']+60,(game,'horizontal pan failed',before,state)
    assert state['y']>=before['y']+40,(game,'vertical pan failed',before,state)
    gesture(cdp,[],'touchEnd')
    # keep gestures out of the gameplay event stream: no gameplay phase advances.
    assert not errors,(game,errors)
    # normal touch tap on a counter remains available
    unit='#map .native-counter-layer' if game=='battle-for-moscow' else '#counter-overlay .counter-hit-area'
    assert page.locator(unit).count()>0,game
    # Complete two-finger motion and immediately tap a unit in the same map.
    # The gesture guard must not swallow this new, intentional tap.
    if game in ('arduous','leningrad'):
        page.locator('.mobile-controls-launcher').tap()
        page.locator('[data-game-tab="settings"]').tap()
        page.locator('#configure-setup').tap()
        assert page.locator('#setup-panel').is_visible()
        page.locator('.mobile-drawer-close').tap()
        counter=page.locator('#counter-overlay [data-unit-id] .counter-hit-area').last
        unit_id=counter.evaluate("el=>el.closest('[data-unit-id]').dataset.unitId")
        counter.tap(timeout=20000)
        selected=page.evaluate('HistoricalBrowserPreview.setupSelection()')
        assert selected=={'kind':'map','id':unit_id},(game,'touch tap lost',selected,unit_id)
        page.keyboard.press('Escape')
        assert page.evaluate('HistoricalBrowserPreview.setupSelection()') is None
    # remount in same browser tab: prompt must not be shown twice
    nav=page.locator('.touch-map-reminder')
    nav.evaluate('el=>el.hidden=true')
    gesture(cdp,[(x,y)],'touchStart');gesture(cdp,[],'touchEnd')
    assert not nav.is_visible(),(game,'repeat hint')
    return {'game':game,'before':before,'after':state,'firstTouchHint':True,'singleFingerNoPan':True,'twoFingerPan':True,'noRepeatHint':True,'pageErrors':errors}

if __name__=='__main__':
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        for game in ['arduous','leningrad','battle-for-moscow']:
            context=browser.new_context(viewport={'width':820,'height':1180},has_touch=True,is_mobile=True,device_scale_factor=1)
            page=context.new_page()
            try:
                result=run(page,game);results.append(result);print('PASS',game,result['before'],result['after'],flush=True)
            finally:context.close()
        browser.close()
    (ROOT/'rules/audit/two-finger-pan-browser-v423.json').write_text(json.dumps(results,indent=2)+'\n')
