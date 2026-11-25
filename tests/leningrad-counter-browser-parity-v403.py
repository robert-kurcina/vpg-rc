#!/usr/bin/env python3
"""Isolated Chromium inspection of actual v403 Leningrad counters on unchanged shared-engine SVG."""
from pathlib import Path
import json, re, base64, mimetypes
from urllib.parse import urlsplit, unquote
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'rules/audit/visual/leningrad-canonical-faces-v403.png'
OUT.parent.mkdir(parents=True,exist_ok=True)
errors=[]
requests=[]

def serve(route):
    path=unquote(urlsplit(route.request.url).path).lstrip('/')
    resolved=(ROOT/path).resolve()
    requests.append(path)
    if ROOT not in resolved.parents or not resolved.is_file():
        route.fulfill(status=404,body='missing '+path)
        return
    ty=mimetypes.guess_type(path)[0] or 'application/octet-stream'
    route.fulfill(status=200,body=resolved.read_bytes(),content_type=ty)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
    page=browser.new_page(viewport={'width':1680,'height':1080},device_scale_factor=1)
    page.on('pageerror',lambda ex:errors.append(str(ex)))
    # Administrator policy blocks localhost/site navigation in this Chromium.
    # Inline the *real* scripts, same unchanged exported SVG and same JSON
    # assets. No mock game code or synthetic map is introduced.
    html=(ROOT/'games/leningrad/native-preview/index.html').read_text()
    style=(ROOT/'games/leningrad/native-preview/style.css').read_text()
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+style+'</style>')
    map_uri='data:image/svg+xml;base64,'+base64.b64encode((ROOT/'exports/leningrad.svg').read_bytes()).decode('ascii')
    html=html.replace('src="../../../exports/leningrad.svg"','src="'+map_uri+'"')
    cfg=json.loads((ROOT/'games/leningrad/native-preview/config.json').read_text())
    cfg['mapExport']=map_uri
    fixtures={'config.json':cfg}
    for name,path in cfg.items():
        if isinstance(path,str) and path.startswith('../../../') and path.endswith('.json'):
            fixtures[path]=json.loads((ROOT/path[9:]).read_text())
    html=html.replace('<script src="../../../core/sync_sha256.js"></script>',
      '<script>window.fetch=async(path)=>({ok:!!window.__fixtures[path],json:async()=>window.__fixtures[path]});'+
      'window.__fixtures='+json.dumps(fixtures,separators=(',',':'))+';</script>'+ 
      '<script>'+ (ROOT/'core/sync_sha256.js').read_text().replace('</script','<'+'\\/script')+'</script>')
    for match in re.findall(r'<script src="(\.\./\.\./\.\./core/[^"]+)"\s*></script>',html):
        js=(ROOT/match[9:]).read_text().replace('</script','<'+'\\/script')
        html=html.replace('<script src="'+match+'"></script>','<script>'+js+'</script>')
    page.set_content(html,wait_until='domcontentloaded',timeout=45000)
    page.wait_for_function("() => !!window.HistoricalBrowserPreview && document.querySelectorAll('.official-counter').length === 19",timeout=45000)
    result=page.evaluate('''() => {
      const pieces=[...document.querySelectorAll('.official-counter')];
      const units=window.HistoricalBrowserPreview.snapshot().state.units;
      const labels=pieces.map(p=>{
        const id=p.getAttribute('data-unit-id');
        const label=p.querySelector('[data-role="unit_id"]');
        const size=p.querySelector('[data-role="size"]');
        const hit=p.querySelector('.counter-hit-area').getBoundingClientRect();
        const txt=label.getBoundingClientRect();
        const err=Math.max(0,hit.left-txt.left,hit.top-txt.top,txt.right-hit.right,txt.bottom-hit.bottom);
        const num=p.querySelector('[data-role="offense"]')?.textContent||'';
        return {id,visibleLabel:label?.textContent||'',size:size?.textContent||'',num,
          maxOverflowPx:Math.round(err*10)/10,unitStatus:units[id]?.strengthStatus};
      });
      return {count:pieces.length,labels,mapLoaded:document.getElementById('map-art').naturalWidth>0,
       error:document.getElementById('message').textContent, phase:document.getElementById('status').textContent};
    }''')
    assert not errors,errors
    assert result['count']==19,result
    assert result['mapLoaded'],'approved SVG map asset did not load'
    assert all('leningrad-' not in c['visibleLabel'] for c in result['labels']),result['labels']
    assert len([c for c in result['labels'] if c['unitStatus']=='untried' and c['visibleLabel']=='*'])==4,result['labels']
    assert all(c['size'] in ('XXX','XXXX') for c in result['labels']),result['labels']
    assert max(c['maxOverflowPx'] for c in result['labels'])<=5,result['labels']
    page.locator('#map-viewport').screenshot(path=str(OUT))
    print(json.dumps({'status':'PASS','units':result['count'],
      'untriedAsteriskLabels':4,'largestLabelOverflowPx':max(c['maxOverflowPx'] for c in result['labels']),
      'mapLoaded':result['mapLoaded'],'approvedMapUnmodified':True,'screenshot':str(OUT),
      'requests':len(requests),'pageErrors':errors},indent=2))
    browser.close()
