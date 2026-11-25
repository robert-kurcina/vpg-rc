import importlib.util,json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('riverreview',ROOT/'tools/audit-arduous-river-candidates-v418.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class TestRiverHexsides(unittest.TestCase):
 def test_reproducible_but_not_authorized(self):
  r=mod.audit();self.assertEqual(r,json.loads(mod.OUT.read_text()))
  self.assertFalse(r['authorizedForMovement'])
  self.assertEqual(r['coverage']['riverSourcePaths'],5)
  self.assertEqual(r['coverage']['observedHexsides'],47)
  self.assertEqual(r['coverage']['sideFollowCandidates'],47)
  self.assertEqual(r['coverage']['internalSideFollowCandidates'],45)
  self.assertEqual(r['coverage']['exteriorSideFollowCandidates'],2)
 def test_candidates_no_false_legal_labels(self):
  r=mod.audit();seen=set()
  for edge in r['sideObservations']:
   self.assertNotIn(edge['edgeKey'],seen);seen.add(edge['edgeKey'])
   self.assertFalse(edge['certifiedRiverCrossing'])
   self.assertTrue(edge['sources'])
   self.assertTrue(all(o['relation']=='side-follow-candidate' for o in edge['observations']))
   self.assertTrue(edge['internalPair']==(len(edge['members'])==2))
if __name__=='__main__':unittest.main()
