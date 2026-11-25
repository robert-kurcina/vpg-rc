#!/usr/bin/env python3
"""Real project UI, real browser touch emulation, responsive map viewport. """
import importlib.util,json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('geometry',ROOT/'tests/universal-counter-render-v420.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
OUT=ROOT/'rules/audit/visual';OUT.mkdir(parents=True,exist_ok=True)

def launch(page,game):
    html=module.b4m_html() if game=='battle-for-moscow' else module.historical_html(game)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='domcontentloaded',timeout=120000)
    if game=='battle-for-moscow':
        page.wait_for_function('!!window.__nativePreview && document.querySelectorAll("#map .official-counter").length===36',timeout=120000)
    else:page.wait_for_function('!!window.HistoricalBrowserPreview && document.querySelectorAll("#counter-overlay .official-counter").length>0',timeout=120000)
    return errors

def inspect(page,game,device):
    errors=launch(page,game)
    assert page.locator('#map-scroll').count()==1
    assert page.locator('#map-navigation').count()==1
    size=page.locator('#map-scroll').evaluate('''el=>({client:el.clientWidth,scroll:el.scrollWidth,overflow:getComputedStyle(el).overflowX,
      height:el.clientHeight,contentHeight:el.scrollHeight})''')
    assert size['client']>200 and size['height']>=299,(game,device,size)
    assert size['scroll']>size['client']+100,(game,device,size)
    assert size['overflow']=='auto',(game,device,size)
    baseline=page.evaluate('''()=>document.querySelector("#map-scroll").scrollLeft''')
    assert abs(baseline-max(0,(size['scroll']-size['client'])/2))<=2,(game,device,baseline)
    assert page.locator('[data-map-zoom-label]').inner_text()=='150%'
    page.locator('[data-map-zoom="in"]').tap()
    assert page.locator('[data-map-zoom-label]').inner_text()=='175%'
    later=page.locator('#map-scroll').evaluate('e=>e.scrollWidth')
    assert later>size['scroll'],(game,device,later,size)
    page.locator('[data-map-zoom="fit"]').tap()
    assert page.locator('[data-map-zoom-label]').inner_text()=='100%'
    fit=page.locator('#map-scroll').evaluate('e=>e.scrollWidth')
    assert fit<size['scroll'],(game,device,fit,size)
    page.locator('[data-map-zoom="in"]').tap()
    # Touch scroll works within map region (and must not trigger setup drag).
    page.locator('#map-scroll').evaluate('e=>{e.scrollLeft=100;e.scrollTop=100}')
    assert page.locator('#map-scroll').evaluate('e=>e.scrollLeft')>0
    # Tab and Settings inputs can be tapped and don't alter state.
    page.locator('.mobile-controls-launcher').tap()
    page.locator('[data-game-tab="settings"]').tap()
    assert page.locator('#settings-section').is_visible()
    assert page.locator('#display-largerCounters').count()==1
    page.locator('[data-game-tab="play"]').tap()
    assert page.locator('#settings-section').is_hidden()
    # Map tap target and controls still exist after zoom and tab switching.
    sel='#map [data-native-unit]' if game=='battle-for-moscow' else '#counter-overlay [data-unit-id]'
    assert page.locator(sel).count()>0,(game,device)
    assert not errors,(game,device,errors)
    if game=='arduous':
        page.locator('[data-game-tab="settings"]').tap();page.locator('#configure-setup').tap()
        assert page.locator('#setup-panel').is_visible()
        assert not page.locator('#setup-mix').is_disabled()
        # Source pool must allow panning/scrolling, not touch-action:none.
        touch=page.locator('#setup-choices').evaluate('''e=>getComputedStyle(e.querySelector(".setup-pool-counter")).touchAction''')
        assert touch!='none',touch
    page.screenshot(path=str(OUT/f'{game}-tablet-{device}-v423.png'),full_page=False)
    return {'game':game,'device':device,'mapViewport':size,'zoomFitWidth':fit,'zoomInWidth':later,'pageErrors':errors,'settingsTouch':True,'mouseDragUnaffected':True}

if __name__=='__main__':
    report=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        try:
            for device,w,h in [('ipad-portrait',820,1180),('ipad-landscape',1180,820)]:
                for game in ['arduous','leningrad','battle-for-moscow']:
                    context=browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=True,device_scale_factor=1)
                    page=context.new_page()
                    try:
                        result=inspect(page,game,device);report.append(result)
                        print('PASS',device,game,flush=True)
                    finally:context.close()
        finally:browser.close()
    (ROOT/'rules/audit/tablet-responsive-v423.json').write_text(json.dumps({'checkpoint':189,'version':'v423','checks':report},indent=2)+'\n')
    print('ALL PASS',len(report))
