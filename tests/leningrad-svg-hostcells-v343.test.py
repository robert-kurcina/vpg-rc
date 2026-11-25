"""Keep exact authored SVG measurements, but do not silently promote them over explicit user host cells."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('svg_sync',ROOT/'tools/sync-leningrad-svg-deployments-v343.py')
sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync)
spec2=importlib.util.spec_from_file_location('user_hosts',ROOT/'tools/restore-leningrad-approved-v345.py')
auth=importlib.util.module_from_spec(spec2);spec2.loader.exec_module(auth)

class SVGHostCells(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.board,cls.report=sync.positions()
 def test_direct_source_geometry_remains_audited(self):
  r=self.report
  self.assertFalse(r['usesScans'])
  self.assertFalse(r['modifiesRenderer'])
  self.assertEqual(len(r['assignments']),10)
  self.assertLess(max(x['centerError'] for x in r['assignments']),0.01)
  self.assertEqual(sorted(x['hostCell'] for x in r['assignments'] if x['kind']=='cross'),['0210','0310','0311','0411','0511'])
  self.assertEqual(sorted(x['hostCell'] for x in r['assignments'] if x['kind']=='star'),['0209','0309','0410','0510','0611'])
  self.assertEqual(len({x['hostCell'] for x in r['assignments']}),10)
  self.assertEqual([c['hostCell'] for c in r['cityAssignments'] if c['name']=='Insterburg'],['0311'])
 def test_approved_left_matches_svg_instance_hosts(self):
  live=auth.check(self.board)
  self.assertEqual(live['cross'],['0210','0310','0311','0411','0511'])
  self.assertEqual(live['star'],['0209','0309','0410','0510','0611'])
  sync.check_live(self.board,self.report)
  self.assertEqual(self.board['v343SourceSvgHostCells']['sourceSHA256'],self.report['sourceSHA256'])
  self.assertEqual(self.board['v344UserDeploymentAuthority']['historicalSetupAuthorized'],False)
 def test_detects_host_mutation_against_explicit_authority(self):
  forged=copy.deepcopy(self.board)
  first=next(c for c in forged['cells'] if c['id']=='0511')
  m=next(m for m in first['tileMarkers'] if m['kind']=='cross')
  first['tileMarkers'].remove(m)
  target=next(c for c in forged['cells'] if c['id']=='0209')
  target['tileMarkers'].append(m)
  with self.assertRaisesRegex(ValueError,'mismatch'):
   auth.check(forged)
 def test_corrupted_physical_lattice_fails(self):
  forged=copy.deepcopy(self.board)
  for c in forged['cells']:
   if c['id']=='0210':c['pixelCenter']=[200.0,200.0]
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'board.json';path.write_text(json.dumps(forged))
   with self.assertRaisesRegex(ValueError,'does not match a physical hex center'):
    sync.positions(board=path)
 def test_missing_svg_symbol_fails(self):
  text=sync.SVG.read_text()
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'map.svg';path.write_text(text.replace('id="g10"','id="missing_g10"',1))
   with self.assertRaisesRegex(ValueError,'missing source SVG symbol #g10'):
    sync.positions(svg=path)
if __name__=='__main__':unittest.main()
