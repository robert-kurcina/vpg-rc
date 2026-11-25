#!/usr/bin/env python3
"""Independent PDF text + photographic counter-sheet provenance checks.

This does not infer which runtime cell a printed PDF coordinate identifies.
"""
import hashlib
import json
import re
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / 'references/rules/leningrad-rules.pdf'
CONFIG = ROOT / 'maps/counter-configs/leningrad.json'
OUT = ROOT / 'rules/audit/leningrad-full-starting-inventory-v355.json'


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assert_text(name, haystack, needle):
    if needle not in haystack:
        raise AssertionError(f'Rules PDF missing {name}: {needle}')
    return name


def main():
    with fitz.open(PDF) as doc:
        text2 = ' '.join(doc[1].get_text().split())
        text5 = ' '.join(doc[4].get_text().split())
    anchors = re.search(
        r'3\. Place three \(3\) Soviet Infantry Corps and two \(2\) untried Soviet Mechanized Corps.*?hexes ([0-9]{4}), ([0-9]{4}), ([0-9]{4}), ([0-9]{4}), and ([0-9]{4})\)',
        text2
    )
    if not anchors:
        raise AssertionError('Cannot independently extract five reserve printed hexes from PDF p.2 §6.0(3)')
    ids = list(anchors.groups())
    expected_ids = ['0107', '0607', '1305', '1606', '1701']
    if ids != expected_ids:
        raise AssertionError('Reserve printed coordinates differ: ' + str(ids))
    phrases2 = {
        'untriedFour': 'Turn all four Soviet Mechanized Corps to their untried side',
        'frontlineArmies': '4. Place two (2) full-strength Soviet Armies and two (2) untried Soviet Mechanized Corps, and one (1) Soviet Infantry Corps',
        'frontlineStars': 'in the five front line hexes with red stars',
        'armyAdjacency': 'Armies cannot be set up in hexes adjacent to other Armies',
        'sixRemainingArmies': 'six remaining Soviet Infantry Armies',
        'germanTurn4': 'two full strength 6-4 German Infantry Corps',
        'germanInitial': 'remaining units (seven Infantry and two Panzer Corps)',
        'germanFiveCrosses': 'only five hexes, one additional unit is added to four of those five hexes',
    }
    for name, needle in phrases2.items():
        assert_text(name, text2, needle)
    phrases5 = {
        't3WMM': 'Game Turn 3: The Soviet Leningrad Workers’ Militia Infantry Corps',
        't4TwoGerman': 'Game Turn 4: Two German 6-4 Infantry Corps',
        't5Army': 'Game Turn 5: One Soviet Infantry Army (at reduced strength)',
        't6Air': 'Game Turn 6: One German Air Corps (FK VIII)',
        't7Armies': 'Game Turn 7: Two Soviet Infantry Armies (at full strength)',
    }
    for name, needle in phrases5.items():
        assert_text(name, text5, needle)
    config = json.loads(CONFIG.read_text())
    images = {}
    for side in ('front', 'back'):
        r = config['faceSource'][side]
        path = ROOT / r['file']
        observed = sha256(path)
        if observed != r['sha256']:
            raise AssertionError(f'Source {side} photo SHA-256 mismatch')
        images[side] = {'path': r['file'], 'sha256': observed}
    # An independent tally from the PDF structure, not from the candidate migration.
    inventory = {
        'german_initial': {'infantry': 7, 'panzer': 2},
        'german_turn4': {'infantry_6_4': 2},
        'soviet_rear': {'infantry_corps': 3, 'mechanized_corps_untried': 2},
        'soviet_frontline': {'infantry_armies': 2, 'infantry_corps': 1, 'mechanized_corps_untried': 2},
        'soviet_turns_4_to_8': {'infantry_armies': 6},
        'starting_total_ground': 19,
        'later_ground_reinforcements': 9,
        'total_ground_counters_including_workers_militia': 28,
    }
    report = {
        'schemaVersion': 1,
        'checkpoint': 121,
        'source': {'rulesPDF': str(PDF.relative_to(ROOT)), 'rulesPDFSHA256': sha256(PDF), 'printedPages': [2, 5], 'images': images},
        'readMethod': 'PyMuPDF embedded-text extraction; original photograph sources for counter faces; no OCR, scan geometry inference, or canonical projection',
        'verifiedRuleClauses': {'page2': list(phrases2), 'page5': list(phrases5)},
        'independentlyNumberedReserveHexes': ids,
        'reserveHexAuthority': 'rules PDF §6.0 step 3 (printed board identifiers only)',
        'boardPixelAndRuntimeCellRegistrationStatus': 'not certified; no conversion or gameplay activation',
        'sourceBackedStartingInventory': inventory,
        'counterFaceIdentityStatus': 'source-sheet face labels only; assignment to setup hexes and reinforcement slots remains unverified',
        'svgSourceTextLabelCount': None,
        'status': 'source rules and inventory certified; runtime hex correspondence and final setup not certified',
    }
    import xml.etree.ElementTree as ET
    src=ROOT / 'maps/source/user-svg/leningrad-main.svg'
    doc=ET.parse(src)
    labels=doc.findall('.//{http://www.w3.org/2000/svg}text')
    report['svgSourceTextLabelCount']=len(labels)
    if labels:
        raise AssertionError('SVG text-node count changed: requires re-auditing direct printed-number evidence')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('PASS v355 PDF text anchors, source sheet checksums, 19 ground setup units, SVG text authority boundary')


if __name__ == '__main__':
    main()
