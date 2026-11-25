import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('user_hosts',ROOT/'tools/restore-leningrad-approved-v345.py')
AUTH=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUTH)
class UserHostContract(unittest.TestCase):
 def setUp(self):
  self.board=json.loads((ROOT/'maps/leningrad.json').read_text())
 def test_active_host_lock(self):
  self.assertEqual(AUTH.check(self.board),{
   'cross':['0210','0310','0311','0411','0511'],
   'star':['0209','0309','0410','0510','0611']})
 def test_idempotent_apply(self):
  old=AUTH.hosts(self.board)
  derived=copy.deepcopy(self.board)
  self.assertEqual(AUTH.check(derived),old)
  self.assertEqual(derived['geometry'],self.board['geometry'])
  self.assertEqual([c['pixelCenter'] for c in derived['cells']],[c['pixelCenter'] for c in self.board['cells']])
 def test_reject_unauthorized_host_mutation(self):
  bad=copy.deepcopy(self.board)
  source=next(c for c in bad['cells'] if c['id']=='0511')
  marker=next(m for m in source['tileMarkers'] if m['kind']=='cross')
  source['tileMarkers'].remove(marker)
  target=next(c for c in bad['cells'] if c['id']=='0209')
  target['tileMarkers'].append(marker)
  with self.assertRaisesRegex(ValueError,'mismatch'):
   AUTH.check(bad)
 def test_svg_sync_cannot_silently_override_user_authority(self):
  # Apply guard occurs before any output writes.
  proc=subprocess.run([sys.executable,str(ROOT/'tools/sync-leningrad-svg-deployments-v343.py'),'--apply'],
                      cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  self.assertNotEqual(proc.returncode,0)
  self.assertIn('Cannot overwrite user-approved v345 host cells',proc.stderr)
if __name__=='__main__':unittest.main()
