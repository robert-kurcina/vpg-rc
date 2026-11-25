#!/usr/bin/env python3
"""Checkpoint 136: real Chromium DOM actions with unchanged engine source scripts.
Only fetch is supplied from the project's actual JSON files due Chromium's
admin restriction on local HTTP/file navigation. This is NOT hosted acceptance.
"""
from pathlib import Path
from native_browser_asset_fixture import install_fetch
from playwright.sync_api import sync_playwright
import json

root=Path(__file__).resolve().parent.parent
preview=root/'games/battle-for-moscow/native-preview'
html=(preview/'index.html').read_text()
html=html[:html.index('<script src=')]+html[html.index('</body>',html.index('<script src=')):]
paths={
 '../game.json':'games/battle-for-moscow/game.json',
 '../map.json':'games/battle-for-moscow/map.json',
 '../units.json':'games/battle-for-moscow/units.json',
 '../deployments.json':'games/battle-for-moscow/deployments.json',
 '../rules.json':'games/battle-for-moscow/rules.json',
 '../objectives.json':'games/battle-for-moscow/objectives.json',
 'config.json':'games/battle-for-moscow/native-preview/config.json',
 'ui-config.json':'games/battle-for-moscow/native-preview/ui-config.json',
 '../../../maps/battle-for-moscow.json':'maps/battle-for-moscow.json',
 '../../../maps/registry.json':'maps/registry.json',
}
data={key:json.loads((root/path).read_text()) for key,path in paths.items()}
scripts=['modules.js','roster.js','engine.js','native_preview_config.js','native_session_actions.js',
 'sync_sha256.js','native_session_save.js','session.js','native_session_ai.js','factions.js',
 'presentation.js','terrain_tiles.js','official_counter_templates.js','counter_visuals.js',
 'native_combat_ui.js','native_tournament_scoring.js','native_city_status.js','native_browser_view.js']

def load(page,files):
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=(root/'core/native_browser_view.css').read_text())
    install_fetch(page,files,root)
    for script in scripts:page.add_script_tag(content=(root/'core'/script).read_text())
    page.evaluate('window.__nativePreviewReady')

def candidate(page):
    return page.evaluate('''() => {
      const s=__nativePreview.getSession(),u=s.state.units;
      for(const d of u.filter(x=>x.position && x.army!==s.state.side)){
       const c=WargameNativeCombatUI.suggestions(s,d.id,8);
       if(c.options.length)return c.options[0];
      }return null;
    }''')

def sig(page):
    return page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1500,'height':1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    load(page,data)
    assert page.evaluate('__nativePreview.uxConfig().combatSelectionMode')=='defender-first'
    assert 'Select defender first' in page.locator('#phase-guidance').inner_text()
    assert page.locator('#reference-section').is_visible()
    assert 'German' in page.locator('#reference-content').inner_text().title()
    first=candidate(page)
    assert first, 'No legal starting attack'
    before=sig(page)
    page.locator(f'[data-native-unit="{first["defender"]}"] .counter-hit-area').click()
    assert sig(page)==before, 'Defender inspection changed the state or RNG'
    assert page.locator('[data-combat-suggestion]').count()>0
    assert page.locator('.native-defender-halo').count()==1
    # Verify selecting an ineligible nonadjacent counter is rejected without state mutation.
    bad=page.evaluate('''defender=>{
     const s=__nativePreview.getSession(),valid=WargameNativeCombatUI.adjacent(s,defender);
     return s.state.units.find(u=>u.position && u.army===s.state.side && !valid.includes(u.id))?.id;
    }''',first['defender'])
    if bad:
        page.locator(f'[data-native-unit="{bad}"] .counter-hit-area').click()
        assert sig(page)==before
        assert 'cannot attack' in page.locator('#message').inner_text()
    # Best legal group chosen via the actual DOM, not an action shortcut.
    page.locator('[data-combat-suggestion="0"]').click()
    assert page.evaluate('__nativePreview.getSession().state.declarations.length')==1
    after=sig(page);assert after!=before
    assert page.evaluate('__nativePreview.getSession().state.pendingRoll') is None
    page.locator('#finish-phase').click()
    assert page.evaluate('__nativePreview.getSession().state.pendingRoll') is not None
    assert page.locator('#resolve-battle').is_enabled()
    assert page.locator('[data-combat-suggestion]').count()==0
    # Ctrl-like normal Undo of die commitment, then of declaration.
    page.locator('#undo').click();assert sig(page)==after
    page.locator('#undo').click();assert sig(page)==before
    # Custom multiple attackers: choose defender then click all selected attackers.
    if len(first['attackers'])>1:
        page.locator(f'[data-native-unit="{first["defender"]}"] .counter-hit-area').click()
        for aid in first['attackers']:
            page.locator(f'[data-native-unit="{aid}"] .counter-hit-area').click()
        assert page.locator('#declare-selected-battle').is_enabled()
        assert sig(page)==before
        page.locator('#declare-selected-battle').click()
        assert page.evaluate('__nativePreview.getSession().state.declarations.length')==1
    # Reference panels must be generated from real active configuration data.
    for tab in ['howto','terrain','crt','sequence']:
        page.locator(f'[data-reference="{tab}"]').click()
        assert page.locator(f'[data-reference="{tab}"]').get_attribute('aria-selected')=='true'
        assert page.locator('#reference-content').inner_text().strip()
    page.locator('[data-reference="crt"]').click()
    actual=page.locator('.native-reference-crt tr').all_inner_texts()
    assert len(actual)==7,actual
    firstrow=page.evaluate('''() => Array.from(document.querySelectorAll('.native-reference-crt tr'))[1].innerText''')
    assert 'DR' in firstrow
    assert page.locator('#map>svg').count()==1
    page.screenshot(path=str(root/'rules/audit/visual/b4m-native-defender-first-current-smoke.png'),full_page=True)

    # Alternative ordering is a UI setting, not a different gameplay engine.
    alt=dict(data)
    alt['ui-config.json']={**data['ui-config.json'],'combatSelectionMode':'attacker-first'}
    page2=browser.new_page(viewport={'width':1500,'height':1000})
    page2.on('pageerror',lambda e:errors.append(str(e)))
    load(page2,alt)
    assert page2.evaluate('__nativePreview.uxConfig().combatSelectionMode')=='attacker-first'
    choice=candidate(page2);assert choice
    page2.locator(f'[data-native-unit="{choice["attacker"] if "attacker" in choice else choice["attackers"][0]}"] .counter-hit-area').click()
    assert page2.locator('[data-combat-suggestion]').count()==0
    page2.locator(f'[data-native-unit="{choice["defender"]}"] .counter-hit-area').click()
    assert page2.evaluate('__nativePreview.getSession().state.declarations.length')==1
    # Invalid browser UX profile must not create a session.
    badConfig=dict(data)
    badConfig['ui-config.json']={**data['ui-config.json'],'combatSelectionMode':'arbitrary-engine'}
    page3=browser.new_page()
    page3.on('pageerror',lambda e:errors.append(str(e)))
    load(page3,badConfig)
    assert 'Invalid universal browser UX configuration' in page3.locator('#game-status').inner_text()
    assert page3.evaluate('__nativePreview.getSession()') is None
    assert not errors,errors
    report={'status':'PASS','checkpoint':136,'scenario':'battle-for-moscow',
        'mode':'defender-first','alternativeMode':'attacker-first','referenceTabs':['sequence','howto','terrain','crt'],
        'verified':['defender-first click sequence','no RNG on defender inspection','legal attacker suggestions via native session',
        'nonadjacent attacker fail closed','locked dice','two-step Undo','four active-config reference tabs',
        'alternate ordering from config','malformed profile fail closed'],
        'productionEngine':'legacy-b4m-v1',
        'limitations':['isolated real Chromium DOM; JSON fetch backed by local files','no hosted HTTP asset loading','no independent upstream UX acceptance']}
    path=root/'rules/audit/b4m-native-browser-ux-v370.json';path.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    browser.close()
