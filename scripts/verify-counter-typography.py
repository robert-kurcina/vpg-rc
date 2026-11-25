#!/usr/bin/env python3
"""Run the actual official counter templates in Chromium; check font and geometry."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
html=(root/'assets/official-counters/preview.html').read_text()
for name in ('official_counter_templates.js','counter_visuals.js'):
    html=html.replace(f'<script src="../../core/{name}"></script>',f'<script>\n{(root/"core"/name).read_text()}\n</script>')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1380,'height':1250},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content(html,wait_until='load')
    page.screenshot(path=str(root/'evidence/official-counters-portable-fonts-full.png'),full_page=True)
    result=page.evaluate('''() => {
     const counters=[...document.querySelectorAll('g.official-counter')];
     const elements=[...document.querySelectorAll('text[data-counter-typography]')];
     const reads=elements.map(e=>({kind:e.getAttribute('data-counter-typography'),
        family:getComputedStyle(e).fontFamily,weight:getComputedStyle(e).fontWeight,
        transform:e.getAttribute('transform'),
        text:e.textContent.trim(),
        tspanFill:e.querySelector('tspan')?getComputedStyle(e.querySelector('tspan')).fill:null}));
     return {counters:counters.length,text:reads,
        fontFaceAvailable:document.fonts.check('900 16px Arial'),
        browser:navigator.userAgent};
    }''')
    page.get_by_role('button',name='Toggle all full ↔ damaged').click()
    page.screenshot(path=str(root/'evidence/official-counters-portable-fonts-damaged.png'),full_page=True)
    browser.close()
if errors:raise AssertionError(errors)
assert result['counters']==14,result['counters']
assert any(t['kind']=='narrow' for t in result['text'])
assert any(t['kind']=='heavy' for t in result['text'])
assert all('sans-serif' in t['family'].lower() for t in result['text'])
assert all('serif' not in t['family'].lower().replace('sans-serif','') for t in result['text'])
assert all(t['weight']=='900' for t in result['text'] if t['kind']=='heavy')
assert all(t['weight']=='400' for t in result['text'] if t['kind']!='heavy')
assert all('scale(0.7800000,1)' in t['transform'] for t in result['text'] if t['kind']=='narrow')
(root/'evidence/counter-typography-browser-audit.json').write_text(json.dumps({'errors':errors,'counter_count':result['counters'],'font_samples':result['text'][:20], 'font_profile':'counter-portable-sans-v1'},indent=2))
print('PASS Chromium: browser font stack, weights, narrowed transforms, all 14 counters; no page errors')
