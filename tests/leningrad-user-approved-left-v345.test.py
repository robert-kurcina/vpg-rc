import copy
import importlib.util
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('restore',ROOT/'tools/restore-leningrad-approved-v345.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
spec2=importlib.util.spec_from_file_location('rejected',ROOT/'tools/apply-leningrad-user-hostcells-v344.py')
b=importlib.util.module_from_spec(spec2);spec2.loader.exec_module(b)
class UserApprovedLeft(unittest.TestCase):
 def setUp(self):self.board=json.loads((ROOT/'maps/leningrad.json').read_text())
 def test_authority(self):
  self.assertEqual(a.check(self.board),{'cross':['0210','0310','0311','0411','0511'],'star':['0209','0309','0410','0510','0611']})
 def test_rejected_v344_cannot_reactivate(self):
  with self.assertRaisesRegex(ValueError,'superseded'):b.apply(copy.deepcopy(self.board))
  with self.assertRaisesRegex(ValueError,'superseded'):b.check(copy.deepcopy(self.board))
 def test_mutation_fails(self):
  bad=copy.deepcopy(self.board)
  marker=next(m for m in next(c for c in bad['cells'] if c['id']=='0511')['tileMarkers'] if m['kind']=='cross')
  next(c for c in bad['cells'] if c['id']=='0511')['tileMarkers'].remove(marker)
  next(c for c in bad['cells'] if c['id']=='0109')['tileMarkers'].append(marker)
  with self.assertRaisesRegex(ValueError,'mismatch'):a.check(bad)
 def test_svg_identifiers_unique(self):
  src=[m.get('sourceSvgId') for c in self.board['cells'] for m in c['tileMarkers'] if m.get('kind') in ('cross','star')]
  self.assertEqual(len(src),len(set(src)))
if __name__=='__main__':unittest.main()
