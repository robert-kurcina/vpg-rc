#!/usr/bin/env python3
"""Summarize paired existing campaign parity reports; reject divergent receipts."""
import json
import statistics
import sys
from pathlib import Path

def main(root):
    groups = {}
    digest = None
    for label in ('baseline', 'candidate'):
        rows = []
        for i in range(1, 4):
            row = json.loads((root / f'{label}-{i}' / 'kiev-operational-parity.json').read_text())
            assert row['exactCampaign'] and row['actions'] == 433
            assert (row['scenario'], row['seed'], row['difficulty']) == ('kiev', 7, 3)
            assert row['campaignDigest'], 'Missing campaign digest'
            if digest is None:
                digest = row['campaignDigest']
            assert row['campaignDigest'] == digest, 'Cross-revision campaign mismatch'
            rows.append(row)
        metrics = {}
        for name in ('browserSeconds', 'headlessSeconds', 'headlessCpuMs', 'heapStartBytes', 'heapEndBytes'):
            values = [r[name] for r in rows]
            assert all(isinstance(x, (int, float)) and x >= 0 for x in values), name
            metrics[name] = {'samples': values, 'median': statistics.median(values),
                             'min': min(values), 'max': max(values)}
        groups[label] = metrics
    reductions = {key: 100 * (1 - groups['candidate'][key]['median'] / groups['baseline'][key]['median'])
                  for key in ('browserSeconds', 'headlessSeconds', 'headlessCpuMs')}
    print(json.dumps({'exactCampaign': True, 'campaignDigest': digest, 'actions': 433,
                      'measurements': groups, 'medianReductionPct': reductions,
                      'limitations': 'Three alternating trials per revision on one runner; heap endpoints are not peak heap or allocation counts; no hardware cache, browser CPU or disk I/O measurements.'}, indent=2))

if __name__ == '__main__':
    main(Path(sys.argv[1]))
