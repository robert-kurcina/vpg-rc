#!/usr/bin/env python3
"""Verify newest user SVG layer path identities against imported vectors.

It proves exact, unchanged SVG `d` strings for all source geometry items,
not that pixel registration or terrain classification is correct.
"""
from pathlib import Path
import json,hashlib
from lxml import etree
ROOT=Path(__file__).resolve().parent.parent
SRC=ROOT/'maps/source/user-svg'
RECORDS={
 'arduous':'arduous-map-temp(3).svg',
 'leningrad':'leningrad-map-temp(3).svg',
 'kiev':'kiev-map-temp(5).svg',
 'odessa-extension':'odessa-map-temp(4).svg',
}
counts={'railways':0,'coasts':0,'lakes':0}
for game,filename in RECORDS.items():
    file=SRC/filename
    model=json.loads((ROOT/'maps'/f'{game}.json').read_text())
    extracted=json.loads((SRC/f'{game}-svg-extract.json').read_text())
    tree=etree.parse(str(file))
    paths={x.get('id'):x.get('d') for x in tree.xpath('//*[local-name()="path"]') if x.get('id')}
    source_sha=hashlib.sha256(file.read_bytes()).hexdigest()
    assert model['sourceVectorRenderAudit']['sha256']==source_sha,(game,'SHA incorrect')
    for category in ('railways','coasts','lakes'):
        for original in extracted.get(category,[]):
            path_id=original['id']
            assert paths.get(path_id)==original.get('d'), (game,category,path_id,'path d changed or missing')
        counts[category]+=len(extracted.get(category,[]))
    actual={r['sourceSvgId'] for r in model['sourceRailRoutes']}
    expected={r['id'] for r in extracted['railways']}
    assert actual==expected,(game,'railway path IDs not preserved')
    water={r['sourceSvgId'] for r in model.get('sourceWaterRoutes',[])}
    expected_water={r['id'] for p in ('coasts','lakes') for r in extracted.get(p,[])}
    assert water==expected_water,(game,'coast/lake path IDs not preserved')
    if game in ('odessa-extension','leningrad'):
        water_ink=model['sourceWaterScanContours']
        embedded=ROOT/'maps/source'/('odessa-map-scan.webp' if game=='odessa-extension' else 'leningrad-map-scan-current.jpg')
        assert water_ink['sha256']==hashlib.sha256(embedded.read_bytes()).hexdigest(),(game,'source scan changed')
    print(f'{game}: {len(expected)} rails + {len(expected_water)} coast/lake paths; SVG path-d and SHA matches')
assert counts=={'railways':106,'coasts':6,'lakes':3},counts
print('SOURCE PATH INTEGRITY VERIFIED:',counts)
