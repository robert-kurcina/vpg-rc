#!/usr/bin/env python3
"""Run the current focused regression suite, without rewriting historical evidence."""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'tests' / 'active-regressions.json'

def load_tests():
    data = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if set(data) != {'schemaVersion', 'focused'} or data['schemaVersion'] != 1:
        raise ValueError('Unsupported active regression manifest')
    tests = data['focused']
    if not isinstance(tests, list) or not tests or any(not isinstance(t, str) for t in tests):
        raise ValueError('Expected nonempty list of test paths')
    if len(set(tests)) != len(tests):
        raise ValueError('Duplicate regression paths')
    for name in tests:
        path = Path(name)
        target = (ROOT / path).resolve()
        if path.is_absolute() or '..' in path.parts or path.parts[0:1] != ('tests',) or path.suffix != '.js' or not target.is_relative_to(ROOT / 'tests') or not target.is_file():
            raise ValueError('Invalid regression path: ' + name)
    return tests

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--list', action='store_true', help='Validate and list commands without running them')
    parser.add_argument('--timeout', type=int, default=120, help='Per-test timeout in seconds')
    args = parser.parse_args()
    if args.timeout < 1:
        parser.error('--timeout must be positive')
    tests = load_tests()
    if args.list:
        for name in tests:
            print('node ' + name)
        return 0
    for index, name in enumerate(tests, 1):
        start = time.monotonic()
        print(f'[{index}/{len(tests)}] node {name}', flush=True)
        try:
            result = subprocess.run(['node', name], cwd=ROOT, timeout=args.timeout)
        except (subprocess.TimeoutExpired, OSError) as exc:
            print(f'FAIL {name}: {exc}', file=sys.stderr, flush=True)
            return 1
        if result.returncode:
            print(f'FAIL {name}: exit {result.returncode}', file=sys.stderr, flush=True)
            return 1
        print(f'PASS {name} ({time.monotonic()-start:.2f}s)', flush=True)
    print(f'PASS all {len(tests)} focused regressions', flush=True)
    return 0

if __name__ == '__main__':
    sys.exit(main())
