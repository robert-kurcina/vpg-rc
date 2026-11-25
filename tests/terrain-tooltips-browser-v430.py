#!/usr/bin/env python3
"""Actual project JS and SVG in Chromium: desktop hex hover, Settings, touch exclusion."""
import importlib.util,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('existing',ROOT/'tests/shared-settings-browser-v421.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
OUT=ROOT/'rules/audit/visual';OUT.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    try:
        for game in ['arduous','leningrad']:
            page=browser.new_page(viewport={'width':1560,'height':1050},is_mobile=False,has_touch=False)
            errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
            page.set_content(mod.html(game),wait_until='domcontentloaded',timeout=120000)
            page.wait_for_function('!!window.__nativePreview' if game=='battle-for-moscow' else '!!window.HistoricalBrowserPreview',timeout=120000)
            page.locator('#display-terrainTooltips').wait_for(timeout=120000)
            settings=page.locator('#display-terrainTooltips')
            assert settings.count()==1 and settings.is_checked()
            hexes='#map [data-board-cell]' if game=='battle-for-moscow' else '#counter-overlay [data-hex]'
            target=page.locator(hexes).first
            hid=target.get_attribute('data-board-cell' if game=='battle-for-moscow' else 'data-hex')
            # Source-driven SVG overlay event, identical pointer propagation to mouse hover.
            target.dispatch_event('pointermove',{'pointerType':'mouse','clientX':320,'clientY':270,'bubbles':True})
            tip=page.locator('.wargame-terrain-tooltip');page.wait_for_timeout(430);assert tip.is_visible(),(game,tip.get_attribute('hidden'))
            assert hid in tip.inner_text() and 'Movement:' in tip.inner_text() and 'Combat:' in tip.inner_text(),tip.inner_text()
            first=tip.inner_text()
            page.screenshot(path=str(OUT/(game+'-desktop-terrain-tooltip-v430.png')),full_page=True)
            # Tooltip is an overlay, never intercepts the actual board.
            assert tip.evaluate('el=>getComputedStyle(el).pointerEvents')=='none'
            page.locator('[data-game-tab="settings"]').click();settings.uncheck()
            assert tip.is_hidden(),game
            target.dispatch_event('pointermove',{'pointerType':'mouse','clientX':320,'clientY':270,'bubbles':True})
            assert tip.is_hidden(),game
            settings.check();target.dispatch_event('pointermove',{'pointerType':'mouse','clientX':320,'clientY':270,'bubbles':True});page.wait_for_timeout(430);assert tip.is_visible(),game
            # Pointer/touch mode must suppress the tooltip even if the setting remains enabled.
            target.dispatch_event('pointermove',{'pointerType':'touch','clientX':320,'clientY':270,'bubbles':True});assert tip.is_hidden(),game
            assert not errors,(game,errors)
            results.append({'game':game,'hex':hid,'tooltip':first,'togglePassed':True,'touchSuppressed':True,'pageErrors':errors})
            page.close()
        # Simulated iPad with touch and a mouse-like pointer must still suppress tooltip.
        page=browser.new_page(viewport={'width':820,'height':1180},is_mobile=True,has_touch=True)
        page.set_content(mod.html('arduous'),wait_until='domcontentloaded',timeout=120000)
        page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=120000)
        page.locator('#display-terrainTooltips').wait_for(timeout=120000)
        page.locator('#counter-overlay [data-hex]').first.dispatch_event('pointermove',{'pointerType':'mouse','clientX':210,'clientY':220,'bubbles':True})
        assert page.locator('.wargame-terrain-tooltip').is_hidden()
        results.append({'game':'iPad touch simulation','tooltipSuppressed':True})
        page.close()
    finally:browser.close()
audit={'checkpoint':196,'version':'v430','scope':'Desktop terrain/effect tooltip & Settings in Arduous and Leningrad Chromium; separate B4M wiring tested at component level; touch excluded','results':results}
(ROOT/'rules/audit/terrain-tooltips-browser-v430.json').write_text(json.dumps(audit,indent=2)+'\n')
print('PASS browser terrain tooltips',[(r['game'],r.get('hex')) for r in results])
