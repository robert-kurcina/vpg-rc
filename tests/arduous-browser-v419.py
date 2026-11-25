#!/usr/bin/env python3
"""Execute real source JS and unchanged SVG exports in headless Chromium.

This container blocks even local HTTP navigation, so the page scripts and
JSON are provided in-memory at test time. No engine or SVG is reimplemented.
"""
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

def html_for(game):
    folder=ROOT/'games'/game/'native-preview'
    html=(folder/'index.html').read_text()
    cfg=json.loads((folder/'config.json').read_text())
    originals={'config.json':cfg}
    for value in cfg.values():
        if not isinstance(value,str) or not value.endswith('.json'):
            continue
        file=(folder/value).resolve()
        if file.is_file(): originals[value]=json.loads(file.read_text())
    map_file=(folder/cfg['mapExport']).resolve()
    data='data:image/svg+xml;base64,'+base64.b64encode(map_file.read_bytes()).decode()
    html=html.replace('src="'+cfg['mapExport']+'"','src="'+data+'"')
    cfg['mapExport']=data
    shim=('<script>window.fetch=async name=>{const files='+json.dumps(originals,separators=(',',':'))+
         ';if(!(name in files))throw Error("Missing project JSON "+name);return {ok:true,json:async()=>structuredClone(files[name])}};</script>')
    html=html.replace('</head>',shim+'</head>')
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:
       '<style>'+(folder/m[1]).resolve().read_text()+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',lambda m:
       '<script>'+(folder/m[1]).resolve().read_text().replace('</script>','<\\/script>')+'</script>',html)
    return html

def test(page,game):
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html_for(game),wait_until='load',timeout=60000)
    page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=30000)
    snap=page.evaluate('HistoricalBrowserPreview.snapshot()')
    expected=30 if game=='arduous' else 19
    assert len(snap['state']['units'])==expected,(game,len(snap['state']['units']))
    assert snap['actor']=='german' and snap['phaseKind']=='combat'
    assert not errors,errors
    assert page.locator('#map-art').evaluate('(img)=>img.complete && img.naturalWidth>0'),game+' SVG export missing'
    if game=='arduous':
        screenshot=ROOT/'rules/audit/visual/arduous-shared-browser-v419.png'
        page.screenshot(path=str(screenshot),full_page=True)
    page.locator('[data-game-tab="settings"]').click()
    page.locator('#configure-setup').click()
    assert len(page.evaluate('HistoricalBrowserPreview.setupView().units'))==expected
    if game=='arduous':
        assert page.locator('#setup-mix').inner_text().startswith('Mix 10')
        page.locator('#setup-mix').click()
        assert page.evaluate('HistoricalBrowserPreview.setupView().concealedMixed')
        page.locator('#setup-ready').click()
        assert page.locator('#message').inner_text()==''
        before=page.evaluate('HistoricalBrowserPreview.snapshot().actionCount')
        assert before==0
        page.locator('#actions button').first.click()
        assert page.evaluate('HistoricalBrowserPreview.snapshot().actionCount')==1
        page.locator('#undo').click()
        assert page.evaluate('HistoricalBrowserPreview.snapshot().actionCount')==0
        saved=page.evaluate('HistoricalBrowserPreview.save()')
        assert page.evaluate('(x)=>HistoricalBrowserPreview.restore(x)',saved)
        assert page.evaluate('HistoricalBrowserPreview.snapshot().actionCount')==0
    return {'game':game,'startingUnits':expected,'phase':'german-combat',
            'setupMode':True,'concealedShuffle':game=='arduous',
            'humanActionUndoAndSaveRestore':game=='arduous',
            'realExportedMapLoaded':True,'pageErrors':errors}

if __name__=='__main__':
    reports=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        try:
            for game in ('arduous','leningrad'):
                page=browser.new_page(viewport={'width':1500,'height':930})
                try: reports.append(test(page,game))
                finally:page.close()
        finally:browser.close()
    report={'checkpoint':185,'version':'v419','mode':'Chromium in-memory original scripts, project JSON and exported SVG; HTTP navigation is blocked in this runtime','results':reports}
    (ROOT/'rules/audit/arduous-browser-v419.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS Chromium Arduous and Leningrad shared browser',json.dumps(reports))
