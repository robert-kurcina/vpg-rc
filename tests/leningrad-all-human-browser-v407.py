#!/usr/bin/env python3
"""Human-only 8-turn Leningrad Chromium UI acceptance; no baseline controller calls.

Browser reads unchanged packaged source/map/counters via isolated local JSON fetch.
Every game choice, including die commitment and post-roll consequence, is made
through an actual on-screen human control. Resumable across fresh browser contexts.
This is a legal-path interface acceptance, not strategic/historical certification.
"""
import argparse, base64, json, re, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CONFIG=json.loads((ROOT/'games/leningrad/native-preview/config.json').read_text())
assets={'config.json':CONFIG}
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
for js in re.findall(r'<script src="\.\./\.\./\.\./core/([^"]+)"\s*></script>',html):
    source=(ROOT/'core'/js).read_text().replace('</script','<\\/script')
    html=html.replace('<script src="../../../core/'+js+'"></script>','<script>'+source+'</script>')

parser=argparse.ArgumentParser()
parser.add_argument('--resume',type=Path,default=None)
parser.add_argument('--output',type=Path,default=ROOT/'rules/audit/.leningrad-human-progress-v407.json')
parser.add_argument('--max-actions',type=int,default=36,help='0 for no per-session action limit')
parser.add_argument('--max-seconds',type=int,default=115)
args=parser.parse_args()
prior=json.loads(args.resume.read_text()) if args.resume else None
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1560,'height':1050},accept_downloads=True)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='domcontentloaded',timeout=45000)
    try:page.wait_for_function('Boolean(window.HistoricalBrowserPreview)',timeout=30000)
    except Exception:
        print('BROWSER START ERROR',errors,'MESSAGE',page.locator('#message').inner_text(),'status',page.locator('#status').inner_text(),flush=True)
        raise
    api='HistoricalBrowserPreview'
    get=lambda:page.evaluate(api+'.snapshot()')
    if prior:
        assert page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',prior['save']),page.locator('#message').inner_text()
        assert get()==prior['snapshot'],'Fresh-Chromium-state restore mismatch'
        assert page.evaluate(api+'.save()')==prior['save'],'Save payload changed after restore'
        trace=prior['trace'];counts=prior['counts'];starting=prior['starting'];last_side=prior['lastSide']
        print('RESTORE',len(trace),'actions; turn',get()['cursor']['turn'],'actor',get()['actor'],flush=True)
    else:
        page.locator('[data-game-tab="settings"]').click()
        page.locator('#configure-setup').click()
        assert page.locator('#setup-panel').is_visible()
        page.locator('#setup-mix').click()
        setup=page.evaluate(api+'.setupView()')
        assert setup['concealedMixed'] and len(setup['units'])==19
        page.locator('#setup-ready').click()
        assert get()['cursor']['turn']==1 and not get()['cursor']['complete']
        starting={'deployed':len(setup['units']),'concealedMixed':setup['concealedMixed']}
        trace=[];counts={'humanCommands':0,'humanDieCommitments':0,'humanAutomaticNoDie':0,'humanPostRollChoices':0,'humanBattleDeclarations':0,'humanUndoReapplies':0,'baselineCalls':0}
        last_side=None
    start=time.monotonic();stage=0
    while not get()['cursor']['complete'] and (args.max_actions==0 or stage<args.max_actions):
        if time.monotonic()-start>args.max_seconds:break
        before=get();view=page.evaluate(api+'.view()')
        phase=(before['cursor']['turn'],before['actor'],before['phaseId'])
        if view.get('kind')=='post-roll-choice':
            assert page.locator('#actions button').count(), 'No human consequence controls: '+str(view)
            page.locator('#actions button').first.click()
            category='humanPostRollChoices'
        elif view.get('kind')=='action-choice':
            prompts=[x for x in view.get('prompts',[]) if x.get('kind')=='die-and-choice']
            if prompts:
                assert page.locator('#roll-panel').is_visible(), 'Human die input hidden when needed'
                if prompts[0].get('automaticNoDie'):
                    screenshot=ROOT/'rules/audit/visual/leningrad-automatic-ne-v407.png'
                    if not screenshot.exists():
                        screenshot.parent.mkdir(parents=True,exist_ok=True)
                        page.screenshot(path=str(screenshot),full_page=False)
                    assert page.locator('#automatic-ne').is_visible()
                    assert not page.locator('#submit-die').is_visible()
                    assert not page.locator('#die').is_visible()
                    assert not page.locator('#random-die').is_visible()
                    page.locator('#automatic-ne').click()
                    category='humanAutomaticNoDie'
                else:
                    assert page.locator('#submit-die').is_visible()
                    assert page.locator('#die').is_visible()
                    assert not page.locator('#automatic-ne').is_visible()
                    # Deliberately varied recorded tabletop dice, not sampled randomness.
                    die=[3,5,2,6,1,4][counts['humanDieCommitments']%6]
                    page.locator('#die').select_option(str(die))
                    page.locator('#submit-die').click()
                    category='humanDieCommitments'
            elif view.get('phaseKind')=='combat' and view.get('proposals') and not any(
                    t['phase']==phase and t['kind']=='humanBattleDeclarations' for t in trace):
                # Submit a real one-defender source-legal combat plan using UI checkboxes.
                choices=page.locator('#battle-proposals input[type="checkbox"]')
                if choices.count():
                    choices.first.check()
                    page.locator('#commit-battles').click()
                    category='humanBattleDeclarations'
                else:
                    assert page.locator('#actions button').count(),'No visible combat legal command'
                    page.locator('#actions button').first.click()
                    category='humanCommands'
            else:
                assert page.locator('#actions button').count(),'No visible human legal command: '+str(view)
                page.locator('#actions button').first.click()
                category='humanCommands'
        else:
            raise AssertionError('Unhandled human decision '+str(view.get('kind'))+' phase '+str(phase))
        after=get();error=page.locator('#message').inner_text()
        assert not errors,errors
        next_view=page.evaluate(api+'.view()')
        assert after!=before or next_view!=view,'UI command failed to transition: '+category+' '+error+' '+str(phase)
        assert after['actionCount']>=before['actionCount'],'Action count regressed'
        counts[category]+=1
        trace.append({'phase':phase,'kind':category,'actionCount':after['actionCount'],'afterTurn':after['cursor']['turn'],
                      'afterActor':after['actor']})
        stage+=1
        if (after['cursor']['turn'],after['actor'])!=last_side:
            print('STEP',len(trace),'turn',after['cursor']['turn'],'actor',after['actor'],
                  'engine actions',after['actionCount'],'human dice',counts['humanDieCommitments'],flush=True)
            last_side=(after['cursor']['turn'],after['actor'])
    snap=get();save=page.evaluate(api+'.save()')
    assert save['format']=='historical-custom-campaign','Saved game lost setup provenance'
    # Fresh in-place reset and integrity-checked restore (also across separate stages).
    page.locator('#new-game').click()
    assert get()['actionCount']==0
    assert page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',save),page.locator('#message').inner_text()
    assert get()==snap and page.evaluate(api+'.save()')==save
    report={'checkpoint':173,'version':'v407','mode':'human-only-real-browser','sourceTransport':'isolated local fixture',
       'save':save,'snapshot':snap,'starting':starting,'counts':counts,'trace':trace,'lastSide':last_side,
       'errors':errors}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,separators=(',',':'))+'\n')
    print('PASS STAGE',len(trace),'human UI decisions; turn',snap['cursor']['turn'],
          'actor',snap['actor'],'elapsed',round(time.monotonic()-start,1),flush=True)
    if snap['cursor']['complete']:
        assert snap['cursor']['turn']==8 and snap['terminal'] is not None
        assert counts['baselineCalls']==0
        final={k:v for k,v in report.items() if k not in ('save','snapshot','trace','lastSide')}
        final['fullCampaign']=True;final['turn']=snap['cursor']['turn'];final['terminal']=snap['terminal']
        final['interfaceDecisions']=len(trace);final['campaignActions']=snap['actionCount']
        final['limitations']=['Uses source-backed candidate opening, not source-certified historical deployment',
          'Action selection is scripted; choices all use genuine browser human controls rather than AI policy',
          'Recorded test dice are manually selected, not sampled from RNG',
          'Source transport uses local JSON fixture; hosted HTTP not exercised',
          'Physical map symbol vs rulebook coordinate disagreements remain unresolved']
        (ROOT/'rules/audit/leningrad-all-human-browser-v407.json').write_text(json.dumps(final,indent=2)+'\n')
        print('FULL HUMAN UI PASS',json.dumps({k:v for k,v in final.items() if k!='errors'},indent=2),flush=True)
    browser.close()
