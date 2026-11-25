#!/usr/bin/env python3
"""Independent release-tree validation for checkpoint 183; does not edit the game."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,hashlib,sys,re
ROOT=Path(__file__).resolve().parents[1]
NAMES=['battle-for-moscow','leningrad','arduous','kiev','kiev-odessa']
errors=[]
def check(cond,message):
    if not cond: errors.append(message)
class Links(HTMLParser):
    def __init__(self):super().__init__();self.items=[]
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if k in {'href','src'} and v:self.items.append((k,v))
checks=['index.html','maps/index.html','exports/gallery.html','games/battle-for-moscow/index.html',
        'games/battle-for-moscow/native-preview/index.html','games/leningrad/native-preview/index.html']
for filename in checks:
    path=ROOT/filename
    check(path.exists(),f'missing entry {filename}')
    if not path.exists():continue
    parser=Links();parser.feed(path.read_text())
    for field,value in parser.items:
        scheme=urlsplit(value)
        if scheme.scheme or value.startswith(('#','//','javascript:','mailto:')):continue
        target=unquote(scheme.path)
        if not target:continue
        resolved=(path.parent/target).resolve()
        check(resolved.is_relative_to(ROOT),f'path escapes project {filename} {value}')
        if resolved.is_relative_to(ROOT):check(resolved.is_file(),f'missing {filename} -> {value}')
exports={p.name for p in (ROOT/'exports').iterdir() if p.is_file()}
expected={f'{x}.{ext}' for x in NAMES for ext in ('png','svg')}|{'manifest.json','gallery.html'}
check(exports==expected,f'unexpected exports {exports^expected}')
for f in ROOT.iterdir():
    if f.is_file():check(f.suffix!='.log' and not f.name.endswith('-log.txt'),f'root log: {f.name}')
for p in (ROOT/'core').glob('*.md'):check(False,f'engine markdown not relocated {p}')
for p in (ROOT/'scripts').glob('package-checkpoint*.py'):check(False,f'old packager {p}')
for rel in ['assets/official-counters/source-counters.svg',
            'rules/audit/arduous-river-candidates-v418.json',
            'rules/audit/arduous-topology-v418.json',
            'rules/audit/visual/arduous-river-candidates.png',
            'tools/render-arduous-river-candidates.py',
            'provenance/llm/README.md']:
    check((ROOT/rel).is_file(),f'missing required source {rel}')
check(not (ROOT/'maps/adjudications').exists(),'obsolete adjudication directory')
river=json.loads((ROOT/'rules/audit/arduous-river-candidates-v418.json').read_text())
check(len(river['sideObservations'])==47,'Arduous source candidate count')
check(all(item['classification']=='side-follow-review' for item in river['sideObservations']),
      'Non-river point contacts must not be retained')
topology=json.loads((ROOT/'rules/audit/arduous-topology-v418.json').read_text())
check(len(topology['riverCandidatePairs'])==45,'Arduous 45 internal river candidates lost')
checks=['maps/arduous.json','maps/kiev.json','maps/leningrad.json','maps/odessa-extension.json','maps/battle-for-moscow.json','maps/registry.json']
for f in checks:check((ROOT/f).is_file(),f'missing map config {f}')
# A full review of the file list is performed separately when packaging.
print(json.dumps({'status':'PASS' if not errors else 'FAIL','checked_html_entries':6,
                  'current_map_exports':len(expected)-2,'Arduous_river_candidates':45,'errors':errors},indent=2))
sys.exit(1 if errors else 0)
