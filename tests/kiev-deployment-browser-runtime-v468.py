#!/usr/bin/env python3
"""Real Chromium qualification of Kiev candidate pregame deployment.
Source JSON is supplied as normal browser input, not embedded in the common
engine bundle or substituted with mock rules. No live Kiev authorization."""
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
checks=0
def equal(a,b,label):
    global checks
    assert a==b, f'{label}: {a!r} != {b!r}'
    checks+=1
def checked(c,label):
    global checks
    assert c,label
    checks+=1

source_files={
    'map':'maps/kiev.json',
    'setupSpec':'maps/setup/kiev.json',
    'counterConfig':'maps/counter-configs/kiev.json',
    'inventoryPolicy':'maps/setup/kiev-inventory.json',
    'phaseConfig':'maps/phase-configs/kiev.json',
    'movementProfile':'maps/movement-configs/kiev.json'}
source={key:json.loads((root/path).read_text()) for key,path in source_files.items()}
fixture_json=subprocess.check_output(['node','-e',
    "const f=require('./tests/fixtures/kiev-source-opening-v437');console.log(JSON.stringify({allocation:f.allocation,placements:f.placements}))"],cwd=root,text=True)
source.update(json.loads(fixture_json))
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('<!doctype html><html><body><main>Kiev source deployment qualification</main></body></html>')
    page.add_script_tag(content=(root/'core/sync_sha256.js').read_text())
    page.add_script_tag(content=(root/'core/historical_engine_browser_bundle.js').read_text())
    equal(page.evaluate('HistoricalCampaignBrowserEngine.moduleCount'),48,
          'Kiev-only test fixture not bundled into other games')
    equal(source['map']['sourceGame'],'Objective: Kiev','authoritative authored map')
    equal(source['setupSpec']['scenarioId'],'kiev','source setup rule')
    equal(len(source['placements']),30,'30 source-selected initial counters')
    checked(len(source['allocation'])>=8,'source allocation groups loaded')
    result=page.evaluate('''f => {
      const E=HistoricalCampaignBrowserEngine;
      window.kievSource={map:f.map,setupSpec:f.setupSpec,counterConfig:f.counterConfig,
       inventory:E.SourceFaceInventory.create(f.inventoryPolicy),
       phaseConfig:f.phaseConfig,movementProfile:f.movementProfile,
       phaseFactories:{combat:()=>({})}};
      window.kievSetup=E.Deployment.create({...window.kievSource,
       allocation:f.allocation,placements:f.placements});
      const d=window.kievSetup,g=f.allocation;
      const fields={};
      for(const group of ['germanInitialPanzer','germanPolandInfantry',
       'germanRomaniaInfantry','romanianInitialArmy','sovietFixedArmies'])
       fields[group]=d.choices(g[group][0]);
      let rejectedCountry=false,rejectedStack=false,rejectedUnmixed=false,gated=false;
      try{d.move(g.germanInitialPanzer[0],'0709')}catch(e){rejectedCountry=e.message.includes('source-approved')}
      try{d.move(g.germanRomaniaInfantry[0],'1010')}catch(e){rejectedStack=e.message.includes('Illegal historical deployment')}
      try{d.commit({requireMixed:true})}catch(e){rejectedUnmixed=e.message.includes('must be mixed')}
      const concealed=f.setupSpec.concealedSetup.groups.flatMap(x=>g[x]);
      window.kievMixed=d.permute(f.setupSpec.concealedSetup.groups,[...concealed].reverse());
      const committed=window.kievMixed.commit({requireMixed:true});
      try{E.MovementReference.build(f.map,f.movementProfile)}catch(e){gated=e.message.includes('not-gameplay-certified')}
      return {fields,rejectedCountry,rejectedStack,rejectedUnmixed,gated,
       mixed:window.kievMixed.snapshot().concealedMixed,opening:committed.opening.cursor,
       actor:committed.opening.actor,units:Object.keys(committed.opening.state.units).length,
       save:window.kievMixed.save()};
    }''',source)
    polish=['0105','0203','0204','0301','0302','0303','0402']
    romania=['0709','0809','0910','1010']
    equal(result['fields']['germanInitialPanzer'],polish,'Polish panzer choices')
    equal(result['fields']['germanPolandInfantry'],polish,'Polish infantry choices')
    equal(result['fields']['germanRomaniaInfantry'],romania,'Romanian-border German choices')
    equal(result['fields']['romanianInitialArmy'],romania,'Romanian Army choices')
    equal(result['fields']['sovietFixedArmies'],['0406','1007'],'fixed Soviet Army positions')
    checked(result['rejectedCountry'],'foreign-region placement rejected')
    checked(result['rejectedStack'],'occupied Romanian slot still rejected')
    checked(result['rejectedUnmixed'],'unmixed concealed counters cannot commit')
    checked(result['mixed'],'ten concealed Soviet Mechanized mixed')
    checked(result['gated'],'real Kiev gameplay graph remains gated')
    equal(result['opening'],{'scenarioId':'kiev','turn':1,'index':2,'complete':False},'first phase')
    equal(result['actor'],'german','first player')
    equal(result['units'],30,'ground counters retained')
    equal(page.evaluate('HistoricalCampaignBrowserEngine.Deployment.restore(kievMixed.save(),kievSource).save()'),result['save'],
          'browser source save/restore identity')
    checked(not errors,'no Chromium errors: '+repr(errors))
    browser.close()
report={'checkpoint':234,'version':'v468','assertions':checks,'status':'PASS',
 'scope':'real Chromium shared-engine candidate deployment API; not a Kiev game UI or campaign',
 'method':'isolated Chromium executing the normal compact browser engine, supplied original Kiev JSON and test-only selected counters',
 'productionAuthorized':False,'note':'Complete Romanian target territory mask and live campaign remain gated'}
(root/'rules/audit/kiev-deployment-browser-runtime-v468.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS Kiev v468 Chromium candidate deployment:',checks,'checks; live gate retained')
