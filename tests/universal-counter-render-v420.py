#!/usr/bin/env python3
"""Browser acceptance: same counter/hex ratio in actual shared renderer UI paths.
No simulated counters or map art. Local fetch is an in-memory transport adapter
for source files, because localhost network access is unavailable here.
"""
from pathlib import Path
import base64, json, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'rules/audit/visual'
OUT.mkdir(parents=True,exist_ok=True)

def inline(folder,html):
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(folder/m[1]).resolve().read_text()+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+(folder/m[1]).resolve().read_text().replace('</script>','<\\/script>')+'</script>',html)
    return html

def historical_html(game):
    folder=ROOT/'games'/game/'native-preview';html=(folder/'index.html').read_text()
    config=json.loads((folder/'config.json').read_text()); files={'config.json':config}
    for value in config.values():
        if not isinstance(value,str) or not value.endswith('.json'):continue
        file=(folder/value).resolve()
        if file.is_file(): files[value]=json.loads(file.read_text())
    file=(folder/config['mapExport']).resolve()
    data='data:image/svg+xml;base64,'+base64.b64encode(file.read_bytes()).decode()
    html=html.replace('src="'+config['mapExport']+'"','src="'+data+'"')
    config['mapExport']=data
    shim='<script>window.fetch=async name=>{const files='+json.dumps(files,separators=(',',':'))+';if(!(name in files))throw Error("Missing project JSON "+name);return {ok:true,json:async()=>structuredClone(files[name])}};</script>'
    html=html.replace('</head>',shim+'</head>')
    return inline(folder,html)

def b4m_html():
    folder=ROOT/'games/battle-for-moscow/native-preview'; html=(folder/'index.html').read_text()
    keys=['game','map','units','deployments','rules','objectives'];jsons={}
    for key in keys:jsons['../'+key+'.json']=json.loads((folder/'../'/f'{key}.json').read_text())
    for key in ['config','ai-config','ai-config-objective','ai-config-capture','ui-config']:
        p=folder/(key+'.json');jsons[key+'.json']=json.loads(p.read_text())
    jsons['../../../maps/battle-for-moscow.json']=json.loads((ROOT/'maps/battle-for-moscow.json').read_text())
    jsons['../../../maps/registry.json']=json.loads((ROOT/'maps/registry.json').read_text())
    images={}
    for p in sorted((ROOT/'supplied_assets/flat').glob('*')):
        if p.suffix.lower() not in ('.png','.svg'):continue
        mime='image/svg+xml' if p.suffix=='.svg' else 'image/png'
        images['../../../supplied_assets/flat/'+p.name]='data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
    shim='''<script>
    const _fetch=window.fetch.bind(window);
    const __files='''+json.dumps(jsons,separators=(',',':'))+''';
    const __images='''+json.dumps(images,separators=(',',':'))+''';
    window.fetch=async function(name){
      if(Object.hasOwn(__files,name)) return new Response(JSON.stringify(__files[name]),{status:200,headers:{'content-type':'application/json'}});
      if(Object.hasOwn(__images,name)) return _fetch(__images[name]);
      throw Error('Missing project resource: '+name);
    };
    </script>'''
    html=html.replace('</head>',shim+'</head>')
    return inline(folder,html)

def geometry(page,selector,hex_height):
    actual=page.locator(selector).first.evaluate('''el=>{
      const m=el.getAttribute('transform').match(/scale\\(([^,)]+)/);
      if(!m)throw Error('Counter vector has no scale');return Number(m[1])*50;
    }''')
    ratio=actual/hex_height
    assert abs(ratio-46/101.9)<0.00015,(selector,actual,hex_height,ratio)
    return dict(counter=round(actual,3),hexHeight=hex_height,ratio=round(ratio,5))

if __name__=='__main__':
    metrics={};errors=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        try:
            for game,height in [('battle-for-moscow',101.9),('arduous',50.16),('leningrad',66.358)]:
                page=browser.new_page(viewport={'width':1600,'height':1050})
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.set_content(b4m_html() if game=='battle-for-moscow' else historical_html(game),wait_until='domcontentloaded',timeout=120000)
                if game=='battle-for-moscow':
                    page.wait_for_function('!!window.__nativePreview && document.querySelectorAll("#map .official-counter").length > 0',timeout=120000)
                    metrics[game]=geometry(page,'#map .official-counter',height)
                    assert page.locator('#map .official-counter').count()==36
                else:
                    page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=90000)
                    metrics[game]=geometry(page,'#counter-overlay .official-counter',height)
                    assert page.locator('#counter-overlay .official-counter').count()==(30 if game=='arduous' else 19)
                page.screenshot(path=str(OUT/('universal-counter-'+game+'-v420.png')),full_page=True)
                page.close()
            assert not errors,errors
        finally:browser.close()
    (ROOT/'rules/audit/universal-counter-geometry-v420.json').write_text(json.dumps({'checkpoint':186,'version':'v420','browser':'real Chromium with project JS and engine-rendered maps','games':metrics,'pageErrors':errors},indent=2)+'\n')
    print('PASS Chromium universal counter geometry',json.dumps(metrics))
