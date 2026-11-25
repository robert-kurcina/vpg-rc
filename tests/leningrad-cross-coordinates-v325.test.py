import importlib.util,json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('coords',ROOT/'tools/audit-leningrad-cross-coordinates-v325.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class CoordinateReview(unittest.TestCase):
 def test_snapshot(self):
  self.assertEqual(m.audit(),json.loads((ROOT/'rules/audit/leningrad-cross-coordinate-review-v325.json').read_text()))
 def test_differences_are_not_silently_hidden(self):
  r=m.audit()
  self.assertEqual(r['temporaryComparison']['scanOnly'],['0211'])
  self.assertEqual(r['mainComparison']['scanOnly'],['0109','0211'])
  self.assertEqual(r['mainComparison']['candidateOnly'],['0311','0511'])
  self.assertFalse(r['historicalSetupAuthorized'])
  self.assertEqual(r['sovietStarCorrection']['boardScanHex'],'0510')
  self.assertTrue(r['sovietStarCorrection']['mapStarAt0510'])
  self.assertEqual(r['legacyCityRegistrationConflict'],{'city':'Insterburg','scanHex':'0211','mapJsonHex':'0311'})
 def test_source_chain_present(self):
  r=m.audit()
  self.assertEqual(len(r['reviewedBlackCrosses']),5)
  self.assertEqual(len(r['sourceScanSha256']),64)
  self.assertEqual(len(r['diagnosticCropSha256']),64)
  self.assertEqual(len(r['userSuppliedReferences']),2)
  self.assertTrue(all(len(v['sha256'])==64 for v in r['userSuppliedReferences']))
  self.assertEqual(next(x['coordinateConfidence'] for x in r['reviewedBlackCrosses'] if x['hex']=='0211'),'high')
if __name__=='__main__':unittest.main()
