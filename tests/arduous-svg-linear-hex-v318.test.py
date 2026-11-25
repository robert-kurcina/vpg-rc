import copy,hashlib,json,pathlib,sys,unittest
from importlib.machinery import SourceFileLoader
ROOT=pathlib.Path(__file__).resolve().parents[1]
mod=SourceFileLoader('cp77',str(ROOT/'tools/extract-arduous-svg-linear-hex-v318.py')).load_module()
class TestSvgLinear(unittest.TestCase):
 def test_reproducibility(self):
  self.assertEqual(mod.build(),json.loads(mod.OUT.read_text()))
 def test_all_hexes(self):
  v=mod.build();self.assertEqual(len(v['hexes']),155)
  self.assertEqual(v['counts']['railDerivedPairs'],88)
  self.assertEqual(v['counts']['railSourcePaths'],34)
  self.assertEqual(v['counts']['riverSourcePaths'],5)
  self.assertEqual(v['counts']['reinforcementSourcePaths'],2)
 def test_source_ids(self):
  v=mod.build();m=json.loads(mod.MAP.read_text());valid={x['id'] for group in ['railways','rivers','entryBoundaries'] for x in m['authoredSourceVectors'][group]}
  for h in v['hexes'].values():
   for f in ['riverSides','reinforcementSides']:
    for obs in h[f].values():
     for item in obs:self.assertIn(item['sourceSvgId'],valid)
 def test_not_authorized(self):
  v=mod.build();self.assertFalse(v['authorizedForMovement']);self.assertTrue(all(x['status']=='svg-near-side-needs-topological-review' for h in v['hexes'].values() for k in ['riverSides','reinforcementSides'] for a in h[k].values() for x in a))
 def test_mutated_svg_digest_fail(self):
  import tempfile
  with tempfile.TemporaryDirectory() as tmp:
   p=pathlib.Path(tmp)/'map.json';m=json.loads(mod.MAP.read_text());m['authoredSourceVectors']['sourceSvgSha256']='0'*64;p.write_text(json.dumps(m))
   with self.assertRaisesRegex(ValueError,'checksum'):mod.build(p)
if __name__=='__main__':unittest.main()
