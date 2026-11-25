#!/usr/bin/env python3
"""Actual project source in Chromium; test adaptive shell and real game controls.
Desktop shell is opt-in on touch; game/render modules are not mocked.
"""
import importlib.util,json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('realhtml',ROOT/'tests/universal-counter-render-v420.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
OUT=ROOT/'rules/audit/visual';OUT.mkdir(parents=True,exist_ok=True)
def test(page,game,device,touch,w,h):
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(module.b4m_html() if game=='battle-for-moscow' else module.historical_html(game),wait_until='domcontentloaded',timeout=120000)
    if game=='battle-for-moscow':
        page.wait_for_function('!!window.__nativePreview && document.querySelectorAll("#map .official-counter").length==36',timeout=120000)
    else:
        page.wait_for_function('!!window.HistoricalBrowserPreview && document.querySelectorAll("#counter-overlay .official-counter").length>0',timeout=120000)
    auto='mobile' if touch or w<=700 else 'desktop'
    assert page.locator('body').get_attribute('data-layout-mode')==auto,(game,device,'mode')
    def dom():return page.evaluate('''()=>{const a=document.querySelector('#game-sidebar'),b=document.querySelector('.board-space'),m=document.querySelector('#map-scroll'),z=document.querySelector('#map-navigation'),h=document.querySelector('body>header');return {win:innerWidth,mode:document.body.dataset.layoutMode,open:document.body.dataset.mobileControlsOpen,
     mapHeight:Math.round(m.getBoundingClientRect().height),boardHeight:Math.round(b.getBoundingClientRect().height),headerHeight:Math.round(h.getBoundingClientRect().height),
     captionVisible:getComputedStyle(document.querySelector('.map-navigation-help')).display!=='none',
     sideInert:a.inert,toolbarWidth:Math.round(z.getBoundingClientRect().width),toolbarHeight:Math.round(z.getBoundingClientRect().height),sidePos:getComputedStyle(a).position,
     mobileButton:getComputedStyle(document.querySelector('.mobile-controls-launcher')).display}}''')
    before=dom()
    if auto=='mobile':
        assert before['mapHeight']>=h*.65,(game,device,before)
        assert before['sideInert'] and before['sidePos']=='fixed',before
        assert not before['captionVisible'] and before['toolbarWidth']<=65,before
        assert before['mobileButton']!='none',before
        assert page.locator('body>.warning').evaluate('el=>!el||getComputedStyle(el).display==="none"') if game=='arduous' else True
        page.screenshot(path=str(OUT/f'{game}-mobile-first-{device}-v424.png'))
        page.locator('.mobile-controls-launcher').tap() if touch else page.locator('.mobile-controls-launcher').click()
        assert page.locator('#game-sidebar').evaluate('e=>!e.inert')
        page.locator('[data-game-tab="settings"]').tap() if touch else page.locator('[data-game-tab="settings"]').click()
        assert page.locator('#settings-section').is_visible()
        assert page.locator('#layout-desktop-mode').count()==1
        page.locator('#layout-desktop-mode').check()
        assert page.locator('body').get_attribute('data-layout-mode')=='desktop'
        assert page.locator('.map-navigation-help').is_visible()
        assert page.locator('#layout-desktop-mode').is_checked()
        page.screenshot(path=str(OUT/f'{game}-desktop-toggle-{device}-v424.png'))
        page.locator('#layout-desktop-mode').uncheck()
        assert page.locator('body').get_attribute('data-layout-mode')=='mobile'
        # switching into mobile from desktop closes the drawer: tap open and reset to auto.
        page.locator('.mobile-controls-launcher').tap() if touch else page.locator('.mobile-controls-launcher').click()
        page.locator('[data-game-tab="settings"]').tap() if touch else page.locator('[data-game-tab="settings"]').click()
        page.locator('.layout-auto-button').tap() if touch else page.locator('.layout-auto-button').click()
        assert page.locator('body').get_attribute('data-layout-mode')=='mobile'
        page.locator('.mobile-drawer-close').tap() if touch else page.locator('.mobile-drawer-close').click()
        assert page.locator('#game-sidebar').evaluate('e=>e.inert')
    else:
        assert before['captionVisible'] and not before['sideInert']
        assert before['mobileButton']=='none'
        page.locator('[data-game-tab="settings"]').click()
        assert page.locator('#layout-desktop-mode').is_checked()
        page.locator('#layout-desktop-mode').uncheck()
        assert page.locator('body').get_attribute('data-layout-mode')=='mobile'
        page.locator('.mobile-controls-launcher').click()
        page.locator('[data-game-tab="settings"]').click()
        page.locator('.layout-auto-button').click()
        assert page.locator('body').get_attribute('data-layout-mode')=='desktop'
    assert not errors,(game,device,errors)
    return {'game':game,'device':device,'before':before,'errors':errors,'responsiveModeToggle':True}

def main():
    checks=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        try:
            for device,w,h,touch in [('ipad-portrait',820,1180,True),('ipad-landscape',1180,820,True),('desktop',1600,1000,False),('phone',390,844,True)]:
                for game in ['arduous','leningrad','battle-for-moscow']:
                    if device=='phone' and game!='arduous':continue
                    context=browser.new_context(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch,device_scale_factor=1)
                    page=context.new_page()
                    try:
                        result=test(page,game,device,touch,w,h);checks.append(result)
                        print('PASS',device,game,result['before']['mapHeight'],flush=True)
                    finally:context.close()
        finally:browser.close()
    output=ROOT/'rules/audit/mobile-first-browser-v424.json'
    output.write_text(json.dumps({'checkpoint':190,'version':'v424','checks':checks},indent=2)+'\n')
    print('ALL PASS',len(checks))
if __name__=='__main__':main()
