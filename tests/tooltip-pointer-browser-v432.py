#!/usr/bin/env python3
"""Regression on the actual browser/game fixtures; all screenshots use the game renderer."""
from pathlib import Path
import importlib.util, json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('fixture',ROOT/'tests/shared-settings-browser-v421.py')
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
results=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        for game in ['arduous','leningrad','battle-for-moscow']:
            page=browser.new_page(viewport={'width':1600,'height':1000},is_mobile=False,has_touch=False)
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.set_content(fixture.html(game),wait_until='domcontentloaded',timeout=35000)
            preview='!!window.__nativePreview' if game=='battle-for-moscow' else '!!window.HistoricalBrowserPreview'
            page.wait_for_function(preview+' && !!document.querySelector("#display-terrainTooltips")',timeout=35000)
            target=page.locator('#map [data-board-cell]' if game=='battle-for-moscow' else '#counter-overlay [data-hex]').first
            tip=page.locator('.wargame-terrain-tooltip');arrow=page.locator('.wargame-tooltip-pointer')
            def hover(x,y):
                target.dispatch_event('pointermove',{'pointerType':'mouse','clientX':x,'clientY':y,'buttons':0,'bubbles':True})
                page.wait_for_timeout(450)
                assert tip.is_visible() and arrow.is_visible(),(game,x,y,errors)
            def check(x,y,side):
                hover(x,y)
                assert arrow.get_attribute('data-side')==side,(game,arrow.get_attribute('data-side'),side)
                assert arrow.evaluate('el=>getComputedStyle(el).pointerEvents')=='none'
                assert arrow.evaluate('el=>el.getAttribute("aria-hidden")')=='true'
                t=tip.bounding_box();a=arrow.bounding_box()
                assert t['x']>=0 and t['x']+t['width']<=1600 and t['y']>=0 and t['y']+t['height']<=1000,(t,a)
                if side=='right': assert abs((a['x']+8)-t['x'])<=1
                if side=='left': assert abs(a['x']-(t['x']+t['width']))<=1
                if side=='bottom': assert abs((a['y']+8)-t['y'])<=1
                if side=='top': assert abs(a['y']-(t['y']+t['height']))<=1
                # The pointer and panel must not steal the counter/hex hit target.
                assert tip.evaluate('el=>getComputedStyle(el).pointerEvents')=='none'
                return a
            a=check(700,300,'right')
            pos=arrow.evaluate('el=>[el.style.left,el.style.top,el.dataset.side]')
            target.dispatch_event('pointermove',{'pointerType':'mouse','clientX':740,'clientY':390,'bubbles':True})
            assert arrow.evaluate('el=>[el.style.left,el.style.top,el.dataset.side]')==pos
            page.keyboard.press('Escape');assert tip.is_hidden() and arrow.is_hidden()
            page.locator('#map-scroll').dispatch_event('pointerleave',{'bubbles':True})
            check(1490,300,'left')
            page.locator('#map-scroll').dispatch_event('wheel',{'bubbles':True});assert tip.is_hidden() and arrow.is_hidden()
            # Genuine browser pointer event on the engine's map, as opposed to synthetic edge tests.
            if game=='arduous':
                page.locator('#counter-overlay [data-hex="0305"]').hover(force=True,timeout=15000)
                page.wait_for_timeout(450)
                assert tip.is_visible() and arrow.is_visible()
                out=ROOT/'rules/audit/visual/arduous-terrain-notch-hover-v432.png';out.parent.mkdir(parents=True,exist_ok=True)
                page.screenshot(path=str(out),full_page=False)
            assert not errors,(game,errors)
            results.append({'game':game,'rightAndLeftSides':True,'cursorJitterStable':True,'dismissesWithPanel':True,'nonInteractive':True,'errors':errors})
            page.close()
        # Synthetic edge positions through the real game instance in a narrow desktop viewport.
        page=browser.new_page(viewport={'width':380,'height':800},is_mobile=False,has_touch=False)
        page.set_content(fixture.html('arduous'),wait_until='domcontentloaded',timeout=35000)
        page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=35000)
        target=page.locator('#counter-overlay [data-hex]').first
        def test_edge(x,y,expected):
            target.dispatch_event('pointermove',{'pointerType':'mouse','clientX':x,'clientY':y,'buttons':0,'bubbles':True})
            page.wait_for_timeout(450)
            arrow=page.locator('.wargame-tooltip-pointer');tip=page.locator('.wargame-terrain-tooltip')
            assert tip.is_visible() and arrow.is_visible(),(x,y)
            assert arrow.get_attribute('data-side')==expected,(x,y,arrow.get_attribute('data-side'))
            bb=tip.bounding_box();assert bb['x']>=0 and bb['x']+bb['width']<=380 and bb['y']>=0 and bb['y']+bb['height']<=800,bb
            page.locator('#map-scroll').dispatch_event('pointerleave',{'bubbles':True})
        test_edge(165,70,'bottom')
        test_edge(165,750,'top')
        page.locator('.mobile-controls-launcher').click()
        page.locator('[data-game-tab="settings"]').click()
        page.locator('#display-terrainTooltips').uncheck()
        assert page.locator('.wargame-tooltip-pointer').is_hidden()
        results.append({'game':'narrow desktop viewport','bottomAndTopSides':True,'viewportSafety':True,'settingsDismissal':True})
        page.close()
        page=browser.new_page(viewport={'width':820,'height':1180},is_mobile=True,has_touch=True)
        page.set_content(fixture.html('arduous'),wait_until='domcontentloaded',timeout=35000)
        page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=35000)
        page.locator('#counter-overlay [data-hex]').first.dispatch_event('pointermove',{'pointerType':'mouse','clientX':400,'clientY':300,'bubbles':True})
        page.wait_for_timeout(450)
        assert page.locator('.wargame-terrain-tooltip').is_hidden() and page.locator('.wargame-tooltip-pointer').is_hidden()
        results.append({'game':'touch iPad simulation','tooltipAndPointerSuppressed':True})
        page.close()
    finally: browser.close()
report={'checkpoint':198,'version':'v432','cases':results}
(ROOT/'rules/audit/tooltip-pointer-browser-v432.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS pointer placement',len(results),'browser cases')
