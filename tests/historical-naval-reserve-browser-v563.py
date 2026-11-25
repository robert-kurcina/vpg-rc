#!/usr/bin/env python3
"""Browser component/journal regression, synthetic permission harness only."""
from pathlib import Path
import subprocess,json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
# Reuse the existing synthetic source fixture up to the return context.
s=(root/'tests/historical-naval-journal-v520.test.js').read_text().split('let returned=Campaign.create(returnCtx);')[0]
s+='\nconsole.log(JSON.stringify({returnCtx,unitId}));'
f=json.loads(subprocess.check_output(['node','-e',s],cwd=root/'tests'))
source=(root/'core/historical_engine_browser_bundle.js').read_text()
needle='root.HistoricalCampaignBrowserEngine=Object.freeze({'
assert source.count(needle)==1
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page()
    page.add_script_tag(content=(root/'core/sync_sha256.js').read_text())
    page.add_script_tag(content=source.replace(needle,'root.__catalog=load("core/historical_campaign_action_catalog.js");\n'+needle))
    n=page.evaluate('''({returnCtx:context,unitId})=>{
      const Campaign=HistoricalCampaignBrowserEngine.Campaign;
      const c=Campaign.create(context), before=JSON.stringify(c.snapshot());let n=0;
      const ok=(v)=>{if(!v)throw Error('assertion '+n);n++};
      const commands=__catalog.discover({session:c,context,enumerateCombinedPlans:false}).commands;
      const entry=commands.find(x=>x.type==='place-evacuated-reinforcement'&&x.unitId===unitId);
      ok(entry);ok(!commands.some(x=>x.type==='apply-replacement'&&x.unitId===unitId));
      const rebuild={type:'apply-replacement',unitId,hex:entry.hex};
      ok(!c.canExecute(rebuild));let error;try{c.execute(rebuild)}catch(e){error=e}ok(/must return as a regular reinforcement/.test(error?.message));
      ok(JSON.stringify(c.snapshot())===before);
      const r=c.execute(entry).session;ok(r.snapshot().state.units[unitId].hex===entry.hex);
      ok(r.snapshot().state.units[unitId].strengthStatus==='printed-reduced');
      ok(!r.snapshot().state.evacuatedNavalUnits[unitId]);
      ok(JSON.stringify(Campaign.restore(r.save(),context).snapshot())===JSON.stringify(r.snapshot()));
      ok(JSON.stringify(r.undo().session.snapshot())===before);return n;
    }''',f)
    browser.close()
print(f'PASS {n} Chromium naval reserve lifecycle assertions (synthetic phase permission)')
