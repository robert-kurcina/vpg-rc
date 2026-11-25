#!/usr/bin/env python3
"""Objective: Kiev counter-field colors against the two ORIGINAL supplied JPGs.

Only seven demonstrated sampling errors are corrected. Image files, individual
face identities, reverse pairings, affiliation colors and combat stats remain
untouched. Color is sampled in an unobstructed background zone rather than
from the NATO symbol, printed numerals or a sheet gutter.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/official-counters/source-sheets'
CFG = json.loads((ROOT / 'maps/counter-configs/kiev.json').read_text())
EXPECTED_SHA = {
    'front': '9db4bc6382f174017cb23f9c907369a25e173143a29e292b656b8f48ddfc4724',
    'back': '533165e074c4c6a2774811053347d19615eb85acce69987192301c403dcefeea',
}
CORRECTIONS = {
    'kiev-front-r01c03': ('#485c51', '#8ba195', 'German Panzer Corps 48'),
    'kiev-front-r02c03': ('#4b5b51', '#8ba195', 'German Infantry Corps 54'),
    'kiev-front-r03c03': ('#4a5b51', '#8ba195', 'Game Turn marker'),
    'kiev-front-r04c02': ('#95bf91', '#d7a477', 'Soviet concealed Mechanized Corps'),
    'kiev-front-r04c03': ('#745332', '#d7a477', 'Soviet concealed Mechanized Corps'),
    'kiev-front-r05c03': ('#745332', '#d7a477', 'Soviet concealed Mechanized Corps'),
    'kiev-back-r04c02': ('#c0bccd', '#f8a19a', 'Soviet reduced Infantry Army 40'),
}

checks = 0
def check(condition: bool, description: str):
    global checks
    assert condition, description
    checks += 1

images = {}
for side, sha in EXPECTED_SHA.items():
    filename = SRC / f'counters-kiev-{side}.jpg'
    data = filename.read_bytes()
    check(hashlib.sha256(data).hexdigest() == sha, f'original {side} JPG unchanged')
    check(CFG['faceSource'][side]['sha256'] == sha, f'config pins source {side}')
    images[side] = Image.open(filename).convert('RGB')

allfaces = {f['faceId']: f for side in ('front', 'back') for f in CFG['faces'][side]}
check(len(allfaces) == sum(len(CFG['faces'][side]) for side in ('front','back')),'unique face IDs')
audit = []
for face_id, (prior, corrected, label) in CORRECTIONS.items():
    f = allfaces[face_id]
    side = f['source']
    x, y, w, h = f['crop']
    # Printed sheet is segmented into rectangular counter fields. This small
    # left-middle patch avoids the NATO symbol and bold strength digits on
    # these seven explicitly reviewed faces.
    rect = (round(x+w*.16), round(y+h*.46), round(x+w*.25), round(y+h*.60))
    data = np.asarray(images[side].crop(rect))
    color = np.median(data.reshape(-1,3), axis=0).astype(int)
    sample = '#'+''.join(f'{c:02x}' for c in color)
    planned = np.array([int(corrected[i:i+2],16) for i in (1,3,5)])
    drift = float(np.max(np.abs(color-planned)))
    check(f['observedFieldColor']==corrected,face_id+' corrected metadata')
    check(drift<=3,face_id+' agrees with original JPG pixel samples')
    check(prior!=corrected,face_id+' is a real correction')
    check(f['pairedFaceId'] in allfaces,face_id+' pairing preserved')
    check(allfaces[f['pairedFaceId']]['pairedFaceId']==face_id,face_id+' reciprocal source face pair')
    audit.append({'faceId':face_id,'side':side,'printed':label,'incorrectMetadata':prior,
                  'correctedMetadata':corrected,'measuredSourcePatchMedian':sample,
                  'maxChannelDelta':drift,'sourcePatch':rect})

# A nationally diverse source palette must survive this targeted correction.
source_types = {
 'kiev-front-r02c08': '#95b5de',   # Romanian face
 'kiev-front-r02c07': '#8ba195',   # Slovak face
 'kiev-front-r04c01': '#97be92',   # Italian face
 'kiev-front-r04c08': '#9474b5',   # Hungarian face
 'kiev-front-r03c04': '#e4494d',   # Soviet infantry, full
 'kiev-back-r03c05': '#f8a19a',    # Soviet infantry, reduced
 'kiev-back-r04c06': '#d7a477',    # Soviet Mechanized revealed reverse
}
for face_id, expected in source_types.items():
    check(allfaces[face_id]['observedFieldColor']==expected,face_id+' deliberate printed palette preserved')
for side in ('front','back'):
    for face in CFG['faces'][side]:
        check(len(face['observedFieldColor'])==7 and face['observedFieldColor'].startswith('#'),
              face['faceId']+' printable hex field')

# Projected live counter faces obtain their primary color directly from the
# corrected face-specific observed field rather than a generic faction CSS.
proj = (ROOT / 'core/historical_counter_face_projection.js').read_text()
check('const color=face.observedFieldColor' in proj,'live face projection reads source color')
bundle = (ROOT / 'core/historical_engine_browser_bundle.js').read_text()
for face_id,(_,corrected,_) in CORRECTIONS.items():
    check(f'"faceId":"{face_id}"' in bundle,face_id+' present in shared browser bundle')
    check(corrected in bundle,face_id+' corrected color embedded')

out = {
 'checkpoint':256,'version':'v490','status':'verified-source-pixel-corrections',
 'sourceSHA256':EXPECTED_SHA,'correctedFaces':audit,'checksPassed':checks,
 'scope':'presentation metadata only; no generic palette normalization or gameplay rule change',
}
p = ROOT / 'rules/audit/kiev-counter-color-source-verification-v490.json'
p.write_text(json.dumps(out,indent=2)+'\n')
print('PASS Kiev original counter colors v490', checks, 'assertions')
