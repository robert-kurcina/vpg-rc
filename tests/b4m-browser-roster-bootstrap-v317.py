#!/usr/bin/env python3
"""Compare original browser bootstrap and roster-verified bootstrap in real Chromium.

Only browser initialization differs; both use same Oberlabs gameplay scripts.
This is an internal regression, NOT an upstream Oberlabs comparison.
"""
import json, os, pathlib, re, hashlib
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
HTML=(ROOT/'legacy/index.html').read_text()
PATHS=re.findall(r'<script src="([^"]+)"[^>]*></script>',HTML)
BASE_HTML=re.sub(r'<script src="[^"]+"[^>]*></script>','',HTML)
ROSTER_PATHS={'../core/roster.js','../maps/rosters/browser-data.js','../maps/rosters/loader.js','roster-bootstrap.js'}

# Test-only state export, injected immediately before ui.js IIFE closes.
BRIDGE='''window.__rosterParity={snapshot:()=>JSON.parse(JSON.stringify(s)),
 phase:()=>({side:s.side,turn:s.turn,phase:s.phase,history:history.length}),
 rosterScenario:()=>({raw:c.raw.units.map(u=>({...u}))})};'''

def build(page,shared=True,corrupt=None):
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content(BASE_HTML,wait_until='load')
    for rel in PATHS:
        if not shared and rel in ROSTER_PATHS:continue
        if shared and corrupt=='missing-data' and rel=='../maps/rosters/browser-data.js':continue
        file=(ROOT/'legacy'/rel).resolve()
        assert file.is_relative_to(ROOT)
        content=file.read_text()
        if corrupt=='strength' and rel=='../maps/rosters/browser-data.js':
            # The offline scenario separately declares unit combat strength.
            content=content.replace('\"combatFull\":10','\"combatFull\":11',1)
            assert '\"combatFull\":11' in content
        if rel=='ui.js':
            if not shared:content=content.replace('E.buildScenario(window.B4M_VERIFIED_SCENARIO,','E.buildScenario(conf,',1)
            assert content.rstrip().endswith('})();')
            content=content.rstrip()[:-5]+BRIDGE+'})();\n'
        try:page.add_script_tag(content=content)
        except Exception:
            if not corrupt:raise
    return errors

def run():
    data=json.loads((ROOT/'maps/rosters/browser-data.js').read_text().split('window.WargameRosterBrowserData=',1)[1].rstrip().rstrip(';'))
    for source,sha in data['sha256'].items():
        assert hashlib.sha256((ROOT/source).read_bytes()).hexdigest()==sha,source+' has stale generated data'
        assert json.loads((ROOT/source).read_text())==data['files'][source],source+' does not match browser copy'
    with sync_playwright() as p:
        executable=os.getenv('B4M_CHROMIUM') or ('/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else p.chromium.executable_path)
        browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
        old=browser.new_page();new=browser.new_page()
        assert not build(old,False)
        assert not build(new,True)
        assert new.evaluate('window.B4M_ROSTER_BOOTSTRAP.validated')
        assert new.evaluate('window.B4M_ROSTER_BOOTSTRAP.units')==39
        assert old.evaluate('window.__rosterParity.rosterScenario()')==new.evaluate('window.__rosterParity.rosterScenario()')
        assert old.evaluate('window.__rosterParity.snapshot()')==new.evaluate('window.__rosterParity.snapshot()')
        count=1
        for mode in ['hotseat','both','german','soviet']:
            for page in (old,new):page.select_option('#mode',mode)
            assert old.evaluate('window.__rosterParity.snapshot()')==new.evaluate('window.__rosterParity.snapshot()'),mode
            count+=1
        for page in (old,new):page.select_option('#mode','hotseat')
        assert old.evaluate('window.__rosterParity.snapshot()')==new.evaluate('window.__rosterParity.snapshot()')
        count+=1
        # Normal HTML controls, including the phase-guard and Undo.
        for page in (old,new):page.locator('#phase').click()
        assert old.evaluate('window.__rosterParity.snapshot()')==new.evaluate('window.__rosterParity.snapshot()')
        count+=1
        # Strict invalid data validation must fail BEFORE the game UI initializes.
        bad=browser.new_page();errors=build(bad,True,'strength')
        assert any('browser roster discrepancy' in e for e in errors),errors
        assert bad.evaluate('window.B4M_ROSTER_BOOTSTRAP?.validated') is None
        bad2=browser.new_page();errors=build(bad2,True,'missing-data')
        assert errors,'Missing canonical roster source should cause a hard initialization error'
        assert bad2.evaluate('window.B4M_ROSTER_BOOTSTRAP?.validated') is None
        browser.close()
    print(f'PASS browser roster/bootstrap parity: {count} old/new state checkpoints; tampered strength and missing-data fail closed; source hashes match')

if __name__=='__main__':run()
