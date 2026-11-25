#!/usr/bin/env python3
"""Chromium acceptance: source-backed terrain chart, real map icons, mobile, rail z-order."""
from pathlib import Path
import base64
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / 'rules/audit/visual/kiev-terrain-effects-chart-browser-v483.png'
SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)

# Exact chart HTML, actual exported map artwork and JSON; inline local files because
# localhost navigation is blocked by the browser execution environment.
chart_json = json.loads((ROOT / 'maps/presentation/kiev-terrain-effects.json').read_text())
art = {row['id']: 'data:image/png;base64,' + base64.b64encode(
    (ROOT / 'assets/terrain-chart/kiev' / (row['id'] + '.png')).read_bytes()).decode('ascii')
    for row in chart_json['rows']}
html = (ROOT / 'tools/terrain-effects-chart/index.html').read_text()
html = html.replace("img.src='../../assets/terrain-chart/kiev/'+row.id+'.png';", "img.src=window.__art[row.id];")
bootstrap = '<script>window.__config=' + json.dumps(chart_json).replace('</script',r'<\/script') +     ';window.__art=' + json.dumps(art) +     ';window.fetch=async()=>({json:async()=>window.__config});</script>'
html = html.replace('<script>\n(async()=>', bootstrap + '<script>\n(async()=>')
assert 'window.__config' in html and 'window.__art' in html
checks = 0

def check(condition, message):
    global checks
    assert condition, message
    checks += 1

if True:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
        page = browser.new_page(viewport={'width':1380,'height':980}, device_scale_factor=1)
        errors=[]
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content(html,wait_until='load',timeout=30000)
        page.wait_for_function('document.querySelectorAll("#chart-body tr").length===10')
        check(page.locator('main').is_visible(),'chart available')
        check(page.title() == 'Objective: Kiev — Terrain Effects Chart','chart title')
        check(page.locator('#chart-body tr').count()==10,'ten rows from original chart plus Romanian')
        check(page.locator('tr[data-kind="romanian"]').count()==1,'Romanian rule row')
        check(page.locator('tr[data-kind="romanian"]').inner_text().find('0709')!=-1,'Romanian origin restriction visible')
        check(page.locator('tr[data-kind="romanian"]').inner_text().find('1110')!=-1,'Soviet exception visible')
        check(page.locator('tr[data-kind="romanian"]').inner_text().find('Turn 1')!=-1,'temporal scope visible')
        check(page.locator('img.sample').count()==10,'all sample elements')
        check(page.evaluate('Array.from(document.images).every(img=>img.complete && img.naturalWidth===88 && img.naturalHeight===82)'),'all cropped engine art visible')
        check(page.locator('tr[data-kind="city"] .sample-id').inner_text().strip()=='Hex 1602','city row uses targeted standalone city hex')
        check(page.locator('tr[data-kind="major-river"] .sample-id').inner_text().strip()=='Hex 1505','major-river row uses isolated hexside sample')
        check(page.locator('tr[data-kind="romanian"] .sample-id').inner_text().strip()=='Hex 0910','Romanian row uses uncluttered setup hex')
        check(not errors,'no chart JS errors: '+str(errors))
        page.screenshot(path=str(SCREENSHOT),full_page=True)
        # Small-screen layout must not overflow or require a horizontal viewport.
        page.set_viewport_size({'width':390,'height':844})
        page.wait_for_timeout(100)
        check(page.locator('#chart-body tr').count()==10,'mobile rows retained')
        check(page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2'),'mobile no horizontal overflow')
        check(page.locator('tr[data-kind="romanian"]').is_visible(),'mobile Romanian row visible')
        check(page.evaluate('getComputedStyle(document.querySelector("#chart-body tr")).display')=='block','mobile cards')
        # The actual shared-engine SVG must put railway art after orange outlines.
        original=(ROOT / 'exports/kiev.svg').read_text()
        page.set_content('<!doctype html><html><body>'+original+'</body></html>',wait_until='domcontentloaded')
        check(page.locator('[data-layer="setup-region-outlines"]').count()==1,'four-hex outline SVG layer')
        check(page.locator('[data-region="romanian-turn1-setup"]').count()==4,'four per-hex SVG markers')
        check(page.evaluate('''() => {
            const a=document.querySelector('[data-layer="setup-region-outlines"]');
            const b=document.querySelector('[data-layer="railways"]');
            return Boolean(a&&b&&(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING));
        }'''),'railway paints over Romanian outline')
        # Kiev setup and map viewer both link to the integrated reference.
        check('terrain-effects-chart/index.html' in (ROOT / 'games/kiev/setup-preview/index.html').read_text(),
              'Kiev gameplay interface link')
        viewer=(ROOT / 'maps/index.html').read_text()
        check('id="kiev-terrain-chart"' in viewer and 'includes(id)' in viewer,
              'map viewer chart link is scenario-gated')
        browser.close()
print('PASS Kiev Terrain Effects Chart Chromium v483',checks,'checks',SCREENSHOT)
