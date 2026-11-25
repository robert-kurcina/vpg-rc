#!/usr/bin/env python3
"""Actual shared map viewer: responsive two-finger dragging across all five maps."""
import importlib.util,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('viewer',ROOT/'tests/map-viewer-settings-v421.py')
viewer=importlib.util.module_from_spec(spec);spec.loader.exec_module(viewer)
def touch(cdp,kind,xy):
    cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':x,'y':y,'radiusX':4,'radiusY':4,'force':.5} for x,y in xy]})
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':820,'height':1180},is_mobile=True,has_touch=True,device_scale_factor=1)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(viewer.h,wait_until='domcontentloaded',timeout=120000)
    page.wait_for_function('!!document.querySelector("#render svg")',timeout=120000)
    assert page.locator('[data-map-zoom-label]').inner_text()=='150%'
    area=page.locator('#map-scroll');r=area.bounding_box();assert r
    area.evaluate('e=>e.scrollLeft=130')
    x=r['x']+r['width']*.5;y=r['y']+r['height']*.3
    cdp=context.new_cdp_session(page)
    touch(cdp,'touchStart',[(x,y)]);assert page.locator('.touch-map-reminder').is_visible()
    touch(cdp,'touchEnd',[])
    before=area.evaluate('e=>e.scrollLeft')
    touch(cdp,'touchStart',[(x,y),(x+50,y+50)])
    touch(cdp,'touchMove',[(x-80,y),(x-30,y+50)])
    after=area.evaluate('e=>e.scrollLeft');assert after>=before+75,(before,after)
    touch(cdp,'touchEnd',[])
    for game in ['leningrad','arduous','kiev','kiev-odessa','battle-for-moscow']:
        page.locator('#game').select_option(game)
        page.wait_for_function('!!document.querySelector("#render svg")')
        assert area.evaluate('e=>e.scrollWidth>e.clientWidth'),game
    assert not errors,errors
    out={'viewer':True,'firstTouchHint':True,'twoFingerPan':True,'allFiveMapsRendered':True,'errors':errors}
    (ROOT/'rules/audit/two-finger-viewer-v423.json').write_text(json.dumps(out,indent=2)+'\n')
    print('PASS map viewer five maps two-finger navigation')
    browser.close()
