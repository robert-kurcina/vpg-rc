#!/usr/bin/env python3
"""Chromium DOM tests with original project HTML, sprites, SVGs and engine.
Not a mock screenshot: same in-memory file shim as shared-settings-browser-v421.
"""
from pathlib import Path
import importlib.util,json,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('fixture',ROOT/'tests/shared-settings-browser-v421.py')
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
results=[]
def run(page,game):
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(fixture.html(game),wait_until='domcontentloaded',timeout=35000)
    preview='!!window.__nativePreview' if game=='battle-for-moscow' else '!!window.HistoricalBrowserPreview'
    page.wait_for_function(preview+' && !!document.querySelector("#display-terrainTooltips")',timeout=35000)
    target=page.locator('#map [data-board-cell]' if game=='battle-for-moscow' else '#counter-overlay [data-hex]').first
    hid=target.get_attribute('data-board-cell' if game=='battle-for-moscow' else 'data-hex')
    tip=page.locator('.wargame-terrain-tooltip')
    state='JSON.stringify(__nativePreview.getSession().state)' if game=='battle-for-moscow' else 'JSON.stringify(HistoricalBrowserPreview.save())'
    before=page.evaluate(state)
    assert tip.is_hidden(),(game,'starts hidden')
    def hover(hex=target,pointer='mouse'):
        hex.dispatch_event('pointermove',{'pointerType':pointer,'clientX':420,'clientY':340,'buttons':0,'bubbles':True})
    hover()
    assert tip.is_hidden(),(game,'no immediate tip')
    page.wait_for_timeout(430)
    assert tip.is_visible(),(game,'tip after dwell',errors)
    assert hid in tip.inner_text() and 'Movement:' in tip.inner_text() and 'Combat:' in tip.inner_text()
    assert tip.evaluate('el=>getComputedStyle(el).pointerEvents')=='none'
    assert tip.evaluate('el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}')
    assert tip.locator('.wargame-tooltip-heading').count()==1
    first=tip.inner_text()
    # Cursor jitter must not move an already visible tooltip.
    origin=tip.evaluate('el=>[el.style.left,el.style.top]')
    target.dispatch_event('pointermove',{'pointerType':'mouse','clientX':520,'clientY':470,'buttons':0,'bubbles':True})
    assert tip.evaluate('el=>[el.style.left,el.style.top]')==origin
    # Escape dismisses until leaving a hex, without blocking game shortcuts.
    page.keyboard.press('Escape')
    assert tip.is_hidden()
    hover();page.wait_for_timeout(430);assert tip.is_hidden()
    target.dispatch_event('pointerleave',{'bubbles':True})
    page.locator('#map-scroll').dispatch_event('pointerleave',{'bubbles':True})
    hover();page.wait_for_timeout(430);assert tip.is_visible()
    # Movement wheel and pointerdown cancel overlays immediately.
    target.dispatch_event('pointerdown',{'pointerType':'mouse','bubbles':True});assert tip.is_hidden()
    hover();page.wait_for_timeout(430);assert tip.is_visible()
    page.locator('#map-scroll').dispatch_event('wheel',{'bubbles':True});assert tip.is_hidden()
    # User Settings can disable without changing the session.
    page.locator('[data-game-tab="settings"]').click()
    setting=page.locator('#display-terrainTooltips');assert setting.is_checked()
    setting.uncheck();assert tip.is_hidden()
    hover();page.wait_for_timeout(450);assert tip.is_hidden()
    setting.check();hover();page.wait_for_timeout(430);assert tip.is_visible()
    # A touch pointer can never produce a tooltip.
    target.dispatch_event('pointermove',{'pointerType':'touch','clientX':400,'clientY':340,'bubbles':True});assert tip.is_hidden()
    assert page.evaluate(state)==before,game+' hover/settings mutated game state'
    if game=='arduous':
        # Genuine Chromium pointer movement over the actual engine-rendered board.
        page.locator('#counter-overlay [data-hex="0305"]').hover(force=True,timeout=15000)
        page.wait_for_timeout(430)
        assert tip.is_visible() and 'Rail sides: NE, NW' in tip.inner_text() and 'River sides: NE, SE' in tip.inner_text(),tip.inner_text()
        out=ROOT/'rules/audit/visual/arduous-terrain-hexside-hover-v431.png';out.parent.mkdir(parents=True,exist_ok=True)
        page.screenshot(path=str(out),full_page=False)
    assert not errors,(game,errors)
    results.append({'game':game,'sourceHex':hid,'display':first,'delayed':True,'stablePosition':True,'escDismiss':True,'actionCancel':True,'settings':True,'touchNoHover':True,'pageErrors':[]})
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        for game in ['arduous','leningrad','battle-for-moscow']:
            page=browser.new_page(viewport={'width':1600,'height':1000},is_mobile=False,has_touch=False)
            try:
                t=time.monotonic();run(page,game);print('PASS',game,'elapsed',round(time.monotonic()-t,1),'s',flush=True)
            finally:page.close()
        # Fine-pointer synthetic events on a touch device never trigger a card.
        page=browser.new_page(viewport={'width':820,'height':1180},is_mobile=True,has_touch=True)
        page.set_content(fixture.html('arduous'),wait_until='domcontentloaded',timeout=35000)
        page.wait_for_function('!!window.HistoricalBrowserPreview && !!document.querySelector("#display-terrainTooltips")',timeout=35000)
        page.locator('#counter-overlay [data-hex]').first.dispatch_event('pointermove',{'pointerType':'mouse','clientX':320,'clientY':250,'bubbles':True})
        page.wait_for_timeout(500)
        assert page.locator('.wargame-terrain-tooltip').is_hidden()
        results.append({'game':'touch iPad simulation','touchNoHover':True})
        page.close()
    finally:browser.close()
report={'checkpoint':197,'version':'v431','tested':'actual project modules and HTML in Chromium, in-memory source/asset shim','results':results}
(ROOT/'rules/audit/tooltip-ux-browser-v431.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS all',len(results),'browser cases')
