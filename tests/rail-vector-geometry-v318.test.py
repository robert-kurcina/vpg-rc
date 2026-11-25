#!/usr/bin/env python3
"""Source rail-vector geometry audit plus fail-closed mutated SVG fixtures."""
import importlib.util,json,pathlib,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('rail_audit',ROOT/'tools/audit-rail-path-geometry-v318.py');mod=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(mod)
class GeometryTests(unittest.TestCase):
 def test_source_geometry(self):
  out=json.loads((ROOT/'rules/audit/arduous-kiev-rail-vector-geometry-v318.json').read_text())
  for name,expected_count in [('arduous',85),('kiev',97)]:
   r=mod.inspect_svg(name,ROOT/'maps/source/user-svg'/mod.SOURCES[name],ROOT/'maps'/f'{name}.json')
   self.assertEqual(r,out['maps'][name]);self.assertEqual(r['candidatePairs'],expected_count)
   self.assertFalse(r['issues']);self.assertTrue(all(p['railLayer'] and p['approxLocalPathLength']>0 for p in r['paths']))
   self.assertTrue(all(p['status'].endswith('not-hex-pair-certified') for p in r['paths']))
 def test_mutated_svg_rejected(self):
  original=(ROOT/'maps/source/user-svg/arduous-map-temp(3).svg').read_text()
  mp=ROOT/'maps/arduous.json'
  with tempfile.TemporaryDirectory() as tmp:
   temp=pathlib.Path(tmp)/'mutated.svg'
   for old,new,expected in [('id="path373"','id="corrupt-path373"','missing-id'),('id="layer2"','id="layer2" display="none"','hidden'),('id="path373"','id="path373" stroke="none"','no-stroke')]:
    temp.write_text(original.replace(old,new,1))
    r=mod.inspect_svg('fixture',temp,mp)
    self.assertTrue(r['issues'],(old,new))
    if expected=='missing-id':self.assertTrue(any(x.get('issue')=='missing-id' for x in r['issues']))
    elif expected=='hidden':self.assertTrue(any('hidden' in x.get('issues',[]) for x in r['issues']))
    else:
     # SVG CSS stroke remains present in style; fail-safe check uses element stroke attr.
     self.assertTrue(any('no-stroke' in x.get('issues',[]) for x in r['issues']))
if __name__=='__main__':unittest.main()
