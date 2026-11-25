import copy,json,pathlib,sys,unittest
from importlib.machinery import SourceFileLoader
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from core.svg_side_occupancy import evaluate
mod=SourceFileLoader('cp78',str(ROOT/'tools/extract-arduous-svg-side-occupancy-v318.py')).load_module()
class TestSideOccupancy(unittest.TestCase):
 def test_snapshot(self):
  self.assertEqual(mod.build(),json.loads(mod.OUT.read_text()))
 def test_source_counts(self):
  x=mod.build();self.assertEqual(x['counts']['hexes'],155)
  self.assertEqual(x['counts']['riverPaths'],5)
  self.assertEqual(x['counts']['reinforcementPaths'],2)
  self.assertFalse(x['authorizedForMovement'])
 def test_reciprocal_canonical_sides(self):
  x=mod.build()
  for key,edge in x['edges'].items():
   self.assertEqual(key,edge['edgeKey'])
   for m in edge['members']:
    self.assertEqual(x['hexes'][m['hexId']]['sides'][m['dir']], [{'edgeKey':key,**o} for o in edge['observations']])
 def test_long_path_spanning_three_sides(self):
  # One continuous line traverses three separate parallel finite sides.
  pts=[(0,1),(30,1)]
  for x in (0,10,20):
   s=evaluate(pts,(x,0),(x+10,0),corridor_px=2)
   self.assertEqual(s['relation'],'side-follow-candidate')
 def test_crossing_not_side_occupation(self):
  res=evaluate([(5,-12),(5,12)],(0,0),(10,0),corridor_px=2)
  self.assertEqual(res['relation'],'point-crossing-or-touch')
 def test_vertex_touch_not_side_occupation(self):
  res=evaluate([(-5,-5),(0,0),(-5,5)],(0,0),(10,0),corridor_px=2)
  self.assertNotEqual(res['relation'],'side-follow-candidate')
 def test_short_near_path_not_side_occupation(self):
  res=evaluate([(3,1),(5,1)],(0,0),(10,0),corridor_px=2)
  self.assertEqual(res['relation'],'short-near-side')
 def test_bad_params_and_source_rejected(self):
  with self.assertRaises(ValueError):evaluate([(0,0),(10,0)],(0,0),(10,0),corridor_px=0)
  import tempfile
  with tempfile.TemporaryDirectory() as t:
   p=pathlib.Path(t)/'map.json';data=json.loads(mod.previous.MAP.read_text());data['authoredSourceVectors']['sourceSvgSha256']='0'*64;p.write_text(json.dumps(data))
   with self.assertRaisesRegex(ValueError,'checksum'):mod.build(p)
if __name__=='__main__':unittest.main()
