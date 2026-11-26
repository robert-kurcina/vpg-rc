#!/usr/bin/env python3
"""Check reproducibility and execute actual bundled naval module in Chromium.
The private loader is exposed only in the test copy, never the shipped bundle.
"""
from pathlib import Path
import json, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
builder=root/'scripts/build-historical-browser-bundle.py'
scripts=json.loads((root/'core/historical_engine_scripts.json').read_text())
bundle=root/'core'/scripts[-1]
subprocess.run(['python',str(builder),'--check'],check=True)
with tempfile.TemporaryDirectory() as d:
    tmp=Path(d)
    for child in root.iterdir():
        if child.name not in ('core','scripts'):
            (tmp/child.name).symlink_to(child)
    (tmp/'core').mkdir(); (tmp/'scripts').mkdir()
    for child in (root/'core').iterdir():
        if child.name!=bundle.name: (tmp/'core'/child.name).symlink_to(child)
    shutil.copy(builder,tmp/'scripts'/builder.name)
    stale=tmp/'core'/bundle.name
    stale.write_text('stale')
    result=subprocess.run(['python',str(tmp/'scripts'/builder.name),'--check'],capture_output=True)
    assert result.returncode==1 and b'Stale split engine' in result.stderr
    assert stale.read_text()=='stale'
    stale.unlink()
    assert subprocess.run(['python',str(tmp/'scripts'/builder.name),'--check'],capture_output=True).returncode==1
# Fixture from the same source-qualified test, with no simulated historical phase.
fixture_js="""const composer=require('./maps/composer'); const map=composer.compose(require('./maps/kiev.json'),require('./maps/odessa-extension.json')); const combatPolicy=require('./maps/combat-configs/kiev-odessa-air-sea-candidate-v518.json'); const sourcePolicy=require('./maps/buildup-configs/kiev-odessa-naval-logistics-candidate-v519.json'); const k=require('./maps/counter-configs/kiev.json'),o=require('./maps/counter-configs/odessa-extension.json'); const counterConfig={mapId:'kiev-odessa',faces:{front:[...k.faces.front,...o.faces.front],back:[...k.faces.back,...o.faces.back]}}; const id='kiev-front-r03c04', f=k.faces.front.find(x=>x.faceId===id), b=k.faces.back.find(x=>x.faceId===f.pairedFaceId); const unit={id,owner:'soviet',hex:'1513',sourceFaceId:id,reverseFaceId:b.faceId,nationality:'soviet',class:'infantry',size:'army',mp:4,marker:false,strengthStatus:'printed-reduced',printedCombatStrength:Number(b.visualTranscription.printedValues.split('-')[0]),activeFaceId:b.faceId}; const state=require('./core/historical_port_support').create({map,policy:combatPolicy,counterConfig}).initialize({state:{scenarioId:'kiev-odessa',units:{[id]:unit},cityControl:{Odessa:'soviet',Nikolaev:'soviet'}}}).state; console.log(JSON.stringify({map,combatPolicy,sourcePolicy,counterConfig,state,id}));"""
fixture=json.loads(subprocess.check_output(['node','-e',fixture_js],cwd=root))
source=bundle.read_text(); needle='root.HistoricalCampaignBrowserEngine=Object.freeze({'
assert source.count(needle)==1
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page()
    page.add_script_tag(content=(root/'core/sync_sha256.js').read_text())
    for name in scripts[:-1]:page.add_script_tag(path=str(root/'core'/name))
    page.add_script_tag(content=source.replace(needle,'root.__testNaval=load("core/historical_naval_logistics.js");\n'+needle))
    n=page.evaluate('''f=>{const naval=__testNaval.create(f);let n=0;const ok=(v)=>{if(!v)throw Error('assertion '+n);n++};const bad=(fn,pattern)=>{let e;try{fn()}catch(x){e=x}ok(e&&pattern.test(e.message))};for(let die=1;die<=6;die++){const a={state:f.state,actor:'soviet',unitId:f.id,destination:{kind:'port',hex:'1811'},turn:3,die};const before=JSON.stringify(f.state);bad(()=>naval.transport(a),/stacking qualification/);bad(()=>naval.transport({...a,canOccupyPort:()=>false}),/stacking qualification/);const hostile=structuredClone(f.state);hostile.units.enemy={id:'enemy',owner:'german',hex:'1811'};bad(()=>naval.transport({...a,state:hostile,canOccupyPort:()=>true}),/Enemy occupies destination/);const r=naval.transport({...a,canOccupyPort:({state,unit})=>{ok(unit.strengthStatus==='printed-reduced');state.units[f.id].hex='bad';unit.hex='bad';return true}});ok(JSON.stringify(f.state)===before);ok(r.state.units[f.id]?.hex===(die===1?undefined:'1811'));}return n}''',fixture)
    browser.close()
print(f'PASS bundle parity, stale/missing guard, {n} Chromium naval assertions')
