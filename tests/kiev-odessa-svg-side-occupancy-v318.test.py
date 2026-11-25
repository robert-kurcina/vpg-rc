import copy,json,pathlib,sys,tempfile,unittest
from importlib.machinery import SourceFileLoader
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
m=SourceFileLoader('cp79',str(ROOT/'tools/extract-kiev-odessa-svg-side-occupancy-v318.py')).load_module()
class TestKievOdessaSides(unittest.TestCase):
 def test_snapshot_both_maps(self):
  for which in ('kiev','kiev-odessa'):
   with self.subTest(which=which):
    self.assertEqual(m.build(which),json.loads(m.OUTPUTS[which].read_text()))
 def test_complete_hex_records_and_visual_only(self):
  for which,n in (('kiev',165),('kiev-odessa',261)):
   x=m.build(which)
   self.assertEqual(len(x['hexes']),n)
   self.assertFalse(x['authorizedForMovement'])
   self.assertEqual(x['counts']['hexes'],n)
 def test_reciprocal_sides(self):
  for which in ('kiev','kiev-odessa'):
   x=m.build(which)
   for key,e in x['edges'].items():
    self.assertEqual(e['edgeKey'],key)
    for member in e['members']:
     self.assertEqual(x['hexes'][member['hexId']]['sides'][member['dir']],
                      [{'edgeKey':key,**o} for o in e['observations']])
 def test_composite_contains_both_provenances_and_seam(self):
  x=m.build('kiev-odessa')
  self.assertEqual(set(v['sourceKey'] for v in x['sources']),{'kiev','odessa'})
  self.assertEqual(x['counts']['riverPaths'],18)
  self.assertEqual(x['counts']['reinforcementPaths'],4)
  self.assertTrue(any(len(e['members'])==2 and any(o['sourceKey']=='odessa' for o in e['observations']) for e in x['edges'].values()))
 def test_mutated_source_hash_rejected(self):
  with tempfile.TemporaryDirectory() as td:
   f=pathlib.Path(td)/'kiev.json'
   data=json.loads(m.KIEV.read_text());data['authoredSourceVectors']['sourceSvgSha256']='0'*64
   f.write_text(json.dumps(data))
   with self.assertRaisesRegex(ValueError,'checksum'):m.build('kiev',kiev_path=f)
 def test_mutated_odessa_hash_rejected(self):
  with tempfile.TemporaryDirectory() as td:
   f=pathlib.Path(td)/'odessa.json'
   data=json.loads(m.ODESSA.read_text());data['additionalSourceVectors'][0]['sourceSvgSha256']='0'*64
   f.write_text(json.dumps(data))
   with self.assertRaisesRegex(ValueError,'checksum'):m.build('kiev-odessa',odessa_path=f)
 def test_missing_sampled_reinforcement_rejected(self):
  with tempfile.TemporaryDirectory() as td:
   f=pathlib.Path(td)/'odessa.json'
   data=json.loads(m.ODESSA.read_text());data['authoredReinforcementTraces'][0]['sourceSvgId']='fabricated'
   f.write_text(json.dumps(data))
   with self.assertRaisesRegex(ValueError,'source SVG element'):m.build('kiev-odessa',odessa_path=f)
if __name__=='__main__':unittest.main()
