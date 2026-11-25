#!/usr/bin/env python3
"""Rail alignment measurements are evidence only, not movement authorization."""
import copy, importlib.util, json, pathlib, subprocess, sys, tempfile, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('rail_alignment',ROOT/'tools/audit-rail-link-alignment-v318.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class RailAlignmentTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.ledger=json.loads((ROOT/'rules/audit/arduous-kiev-rail-link-alignment-v318.json').read_text())
 def test_reproducible_measurements(self):
  for name,count in [('arduous',85),('kiev',93)]:
   expected=self.ledger['maps'][name]; actual=mod.compute(name)
   self.assertEqual(actual,expected)
   self.assertEqual(len(actual['candidates']),count)
   self.assertEqual(actual['issues'],[])
   self.assertTrue(all('not-gameplay-certified' in c['status'] for c in actual['candidates']))
 def test_kiev_review_queue_not_automatically_certified(self):
  a=self.ledger['maps']['kiev']['candidates']
  flagged=[c for c in a if c['bestReferencedPath']['midpointDistancePx']>10]
  self.assertEqual(len(flagged),0)
  self.assertEqual(len([c for c in flagged if c['bestReferencedPath']['midpointDistancePx']>20]),0)
 def test_altered_source_fails_reproduction(self):
  for name in ['arduous','kiev']:
   changed=json.loads((ROOT/'maps'/f'{name}.json').read_text())
   original=mod.compute(name)
   if name=='kiev':
    changed['sourceRailRoutes'][0]['points'][0][0]+=20
   else:
    changed['authoredSourceVectors']['railways'][0]['d']='M 0,0 L 0,1'
   with tempfile.TemporaryDirectory() as td:
    path=pathlib.Path(td)/'altered.json';path.write_text(json.dumps(changed))
    new=mod.compute(name,path)
    self.assertNotEqual(new['sourceMapSha256'],original['sourceMapSha256'])
    self.assertNotEqual(new['candidates'],original['candidates'])
 def test_missing_path_is_reported(self):
  changed=json.loads((ROOT/'maps/arduous.json').read_text())
  changed['authoredSourceVectors']['railways']=changed['authoredSourceVectors']['railways'][1:]
  with tempfile.TemporaryDirectory() as td:
   path=pathlib.Path(td)/'altered.json';path.write_text(json.dumps(changed))
   report=mod.compute('arduous',path)
   self.assertGreater(len(report['issues']),0)
   self.assertLess(report['measuredLinks'],report['totalCandidateLinks'])
if __name__=='__main__':unittest.main()
