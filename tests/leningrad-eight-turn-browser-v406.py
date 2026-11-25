#!/usr/bin/env python3
"""Full 8-turn candidate Leningrad acceptance in actual Chromium using shipped UI.

Engine/map/counters use identical shipped bytes; only file fetch for the isolated
browser context is supplied from local JSON. Human decision uses real action UI.
The deterministic engineering baseline plays the other decisions/side-turns.
"""
import base64, json, re, time, argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CONFIG=json.loads((ROOT/'games/leningrad/native-preview/config.json').read_text())
assets={'config.json': CONFIG}
for key in ['map','counterConfig','setup','profile','phaseConfig','combatPolicy','buildupPolicy','housekeepingPolicy']:
    assets[CONFIG[key]]=json.loads((ROOT/CONFIG[key].removeprefix('../../../')).read_text())
html=(ROOT/'games/leningrad/native-preview/index.html').read_text()
html=html.replace('<link rel="stylesheet" href="style.css">',
    '<style>'+(ROOT/'games/leningrad/native-preview/style.css').read_text()+'</style>')
uri='data:image/svg+xml;base64,'+base64.b64encode((ROOT/'exports/leningrad.svg').read_bytes()).decode()
CONFIG['mapExport']=uri
html=html.replace('src="../../../exports/leningrad.svg"','src="'+uri+'"')
html=html.replace('<script src="../../../core/sync_sha256.js"></script>',
    '<script>window.__fixtures='+json.dumps(assets,separators=(',',':'))+
    ';window.fetch=async p=>({ok:Object.hasOwn(__fixtures,p),json:async()=>__fixtures[p]});</script>'+
    '<script>'+(ROOT/'core/sync_sha256.js').read_text().replace('</script','<\\/script')+'</script>')
for js in re.findall(r'<script src="\.\./\.\./\.\./core/([^\"]+)"\s*></script>',html):
    source=(ROOT/'core'/js).read_text().replace('</script','<\\/script')
    html=html.replace('<script src="../../../core/'+js+'"></script>','<script>'+source+'</script>')

parser=argparse.ArgumentParser()
parser.add_argument('--resume',type=Path,default=None,help='Prior stage state; omit for new campaign')
parser.add_argument('--output',type=Path,default=ROOT/'rules/audit/.leningrad-browser-progress-v406.json')
parser.add_argument('--max-sides',type=int,default=3,help='Maximum side-turns in this stage; 0 to run all')
args=parser.parse_args()
prior=json.loads(args.resume.read_text()) if args.resume else None
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1560,'height':1050},accept_downloads=True)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='domcontentloaded',timeout=45000)
    page.wait_for_function('Boolean(window.HistoricalBrowserPreview)',timeout=30000)
    get=lambda:page.evaluate('HistoricalBrowserPreview.snapshot()')
    api='HistoricalBrowserPreview'
    if prior:
        assert page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',prior['save']),page.locator('#message').inner_text()
        snap=get()
        assert snap==prior['snapshot'],'Cross-Chromium-session campaign restore differs'
        assert page.evaluate(api+'.save()')==prior['save'],'Cross-context byte-equivalent game save violated'
        trace=prior['trace']
        human_actions=prior['humanActions']
        undone_commands=prior['undoReapplies']
        print('RESTORED',snap['cursor']['turn'],snap['actor'],snap['actionCount'],flush=True)
    else:
        page.locator('[data-game-tab="settings"]').click()
        page.locator('#configure-setup').click()
        page.locator('#setup-mix').click()
        assert page.evaluate(api+'.setupView().concealedMixed')
        assert page.locator('#setup-ready').is_enabled()
        page.locator('#setup-ready').click()
        assert get()['cursor']['turn']==1
        options=page.evaluate(api+'.view()')
        assert options['kind']=='action-choice',options.get('kind')
        assert len(options['commands'])>0,'Browser offered no human commands'
        # Human operator commits an actual legal first command through browser UI.
        page.locator('#actions button').first.click()
        snap=get();assert snap['actionCount']==1,snap
        assert not errors,errors
        print('Human UI action committed: '+str(snap['phaseId'])+' action='+str(snap['actionCount']),flush=True)
        trace=[]
        human_actions=1
        undone_commands=0
    at=time.monotonic()
    steps=0
    while not snap['cursor']['complete'] and (args.max_sides==0 or steps<args.max_sides):
        if len(trace)>30:raise AssertionError('Too many side-turn steps; likely actor not advancing')
        before=snap['actionCount'];oldactor=snap['actor'];oldturn=snap['cursor']['turn']
        if oldactor=='german' and oldturn>1:
            view=page.evaluate(api+'.view()')
            assert view['kind']=='action-choice' and len(view['commands'])>0, view
            assert page.locator('#actions button').count()>0,'No visible human action in campaign'
            pre_human=snap
            page.locator('#actions button').first.click()
            snap=get()
            assert snap['actionCount']==before+1,'Later German human choice was not applied'
            human_actions+=1
            # Exercise Undo and reapply during a genuinely mid-campaign decision.
            if oldturn in (4,8):
                post_human=snap
                page.locator('#undo').click()
                assert get()==pre_human,'Human decision Undo failed'
                page.locator('#actions button').first.click()
                assert get()==post_human,'Human decision reapplication is non-deterministic'
                snap=get();undone_commands+=1
            print('Human-selected Turn',oldturn,'legal command; action count',snap['actionCount'],flush=True)
        page.locator('#ai-side').click()
        page.wait_for_function('!document.getElementById("ai-side").disabled',timeout=180000)
        snap=get()
        status=page.locator('#message').inner_text()
        print('side',len(trace)+1,'from',oldturn,oldactor,'to',snap['cursor']['turn'],snap['actor'],
              'action',before,'->',snap['actionCount'],'elapsed',round(time.monotonic()-at,1),
              'message',status[:130],flush=True)
        assert not errors,errors
        assert not status.startswith('Baseline stopped:'),status
        assert snap['actionCount']>before,'No actual game action made'
        assert snap['cursor']['complete'] or (snap['cursor']['turn'],snap['actor'])!=(oldturn,oldactor),status
        trace.append({'startTurn':oldturn,'startActor':oldactor,'endTurn':snap['cursor']['turn'],
                      'endActor':snap['actor'],'actions':snap['actionCount']-before,'message':status})
        steps+=1
    assert not errors,errors
    current=page.evaluate(api+'.save()')
    assert current['format']=='historical-custom-campaign'
    # Every handoff must survive reset and checksum-validated restore in situ.
    page.locator('#new-game').click()
    assert get()['actionCount']==0
    assert page.evaluate('(saved)=>HistoricalBrowserPreview.restore(saved)',current)
    assert get()==snap
    assert page.evaluate(api+'.save()')==current
    stage={'version':'v406','save':current,'snapshot':snap,'trace':trace,'humanActions':human_actions,'undoReapplies':undone_commands}
    args.output.write_text(json.dumps(stage,separators=(',',':'))+'\n')
    print('STAGE PASS',len(trace),'of 24 half turns, campaign turn',snap['cursor']['turn'],
          'actor',snap['actor'],'actions',snap['actionCount'],'elapsed',round(time.monotonic()-at,1),flush=True)
    if snap['cursor']['complete']:
        assert snap['cursor']['turn']==8
        terminal=snap.get('terminal')
        assert terminal is not None
        evidence={
         'checkpoint':172,'version':'v406','status':'PASS',
         'scope':'Isolated real Chromium with shipped shared engine bundle, approved map SVG and official counter templates',
         'candidateSourceSetup':True,'concealedMixed':True,'humanInterfaceAction':True,
         'humanActionCount':human_actions,'midCampaignHumanUndoReapplies':undone_commands,'baselineSideCalls':len(trace),'sideTurns':trace,
         'totalCampaignActions':snap['actionCount'],'turns':snap['cursor']['turn'],
         'terminal':terminal,'saveRestoreAcrossBrowserSessions':True,'terminalSaveRestored':True,
         'pageErrors':errors,
         'limitations':['Candidate deployment source coordinates not historically certified',
           'The deterministic baseline is not a strategic AI',
           'One or more actual German human UI commands per turn; remainder of each side is baseline-engine controlled',
           'Isolated browser local transport fixture, not hosted browser HTTP acceptance']
        }
        out=ROOT/'rules/audit/leningrad-full-browser-v406.json'
        out.write_text(json.dumps(evidence,indent=2)+'\n')
        print('FULL CAMPAIGN PASS',json.dumps({k:v for k,v in evidence.items() if k!='sideTurns'},indent=2),flush=True)
    browser.close()
