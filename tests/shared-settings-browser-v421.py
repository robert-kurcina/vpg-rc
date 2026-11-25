#!/usr/bin/env python3
"""Actual Chromium acceptance using unmodified project JS and exported SVGs."""
import importlib.util, json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('oldrender',ROOT/'tests/universal-counter-render-v420.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
OUT=ROOT/'rules/audit/visual';OUT.mkdir(parents=True,exist_ok=True)

def html(game):
    if game=='battle-for-moscow':return module.b4m_html()
    content=module.historical_html(game)
    # The existing in-memory test shim resolves JSON only. This adapter also
    # resolves the same approved SVG that a real local server would serve.
    shim='''<script>
    const __jsonOnlyFetch=window.fetch;
    window.fetch=async function(name){
      if(typeof name==='string'&&name.startsWith('data:image/svg+xml;base64,')){
        const raw=atob(name.split(',')[1]);
        const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
        return new Response(bytes,{status:200,headers:{'content-type':'image/svg+xml'}});
      }
      return __jsonOnlyFetch(name);
    };
    </script>'''
    return content.replace('</head>',shim+'</head>')

def size(page,game):
    selector='#map .official-counter' if game=='battle-for-moscow' else '#counter-overlay .official-counter'
    return page.locator(selector).first.evaluate('''el=>Number(el.getAttribute('transform').match(/scale\\(([^,)]+)/)[1])*50''')

def settings_test(page,game):
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html(game),wait_until='domcontentloaded',timeout=120000)
    if game=='battle-for-moscow':
        page.wait_for_function('!!window.__nativePreview && document.querySelectorAll("#map .official-counter").length===36',timeout=90000)
    else:page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=90000)
    before=size(page,game)
    state_expression='JSON.stringify(__nativePreview.getSession().state)' if game=='battle-for-moscow' else 'JSON.stringify(HistoricalBrowserPreview.save())'
    original_state=page.evaluate(state_expression)
    assert page.locator('#game-sidebar').get_attribute('data-active-tab')=='play'
    assert page.locator('#settings-section').is_hidden()
    page.locator('[data-game-tab="settings"]').click()
    assert page.locator('#settings-section').is_visible()
    assert page.locator('#new-game').is_hidden()
    assert page.locator('#display-largerCounters').is_checked()==False
    assert page.locator('#display-showCoast').is_checked()==True
    assert page.locator('#display-coastWavelets').is_checked()==True
    page.locator('#display-largerCounters').check()
    assert abs(size(page,game)/before-1.25)<.003,(game,before,size(page,game))
    if game in ['battle-for-moscow','arduous']:
        assert page.locator('#display-showCoast').is_disabled()
        assert page.locator('#display-coastWavelets').is_disabled()
    else:
        assert page.locator('#display-showCoast').is_enabled()
        page.locator('#display-showCoast').uncheck()
        assert page.locator('#display-coastWavelets').is_disabled()
        page.wait_for_function('!!document.querySelector("#map-art-inline svg")',timeout=120000)
        assert page.locator('#map-art').is_hidden()
        assert page.locator('#map-art-inline').is_visible()
        wave=page.locator('#map-art-inline .source-coast-connected-wavelet-fringe')
        assert wave.count()==1
        assert wave.evaluate('e=>e.style.display')=='none'
        page.locator('#display-showCoast').check()
        assert page.locator('#display-coastWavelets').is_enabled()
        page.locator('#display-coastWavelets').uncheck()
        assert page.locator('#map-art-inline .settings-flat-coast').count()==1
        assert wave.evaluate('e=>e.style.display')=='none'
        page.screenshot(path=str(OUT/'leningrad-coast-flat-settings-v421.png'),full_page=True)
        page.locator('#display-coastWavelets').check()
        assert page.locator('#map-art').is_visible()
        assert page.locator('#map-art-inline').is_hidden()
    if game=='battle-for-moscow':
        assert page.locator('#seed').evaluate('e=>e.closest("#settings-section")!==null')
        assert page.locator('#manual-setup').evaluate('e=>e.closest("#settings-section")!==null')
        assert page.locator('#ai-strategy').evaluate('e=>e.closest("#settings-section")!==null')
        assert page.locator('#candidate-redeployment').evaluate('e=>e.closest("#settings-section")!==null')
    else:
        assert page.locator('#configure-setup').evaluate('e=>e.closest("#settings-section")!==null')
    page.screenshot(path=str(OUT/(game+'-settings-v421.png')),full_page=True)
    assert page.evaluate(state_expression)==original_state,'Presentation toggles modified committed game state'
    page.locator('#display-largerCounters').uncheck()
    assert abs(size(page,game)/before-1)<.003
    if game=='arduous':
        page.locator('#configure-setup').click()
        assert page.locator('#game-sidebar').get_attribute('data-active-tab')=='play'
        assert page.locator('#setup-panel').is_visible()
    elif game=='battle-for-moscow':
        page.locator('[data-game-tab="play"]').click()
        assert page.locator('#new-game').is_visible()
        assert page.locator('#settings-section').is_hidden()
        page.locator('#finish-phase').click()
        assert page.locator('#phase-status').inner_text()
    assert not errors,(game,errors)
    return {'game':game,'defaultCounterSize':round(before,3),'largeCounterSize':round(before*1.25,3),
            'coastSupported':game=='leningrad','settingsTab':True,'pageErrors':errors}

if __name__=='__main__':
    results=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        try:
            for game in ('battle-for-moscow','arduous','leningrad'):
                page=browser.new_page(viewport={'width':1600,'height':1100})
                try:results.append(settings_test(page,game))
                finally:page.close()
        finally:browser.close()
    report={'checkpoint':187,'version':'v421','browser':'actual Chromium and exact project source/scripts/engine SVG exports','results':results}
    (ROOT/'rules/audit/shared-settings-browser-v421.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS Chromium shared settings',json.dumps(results))
