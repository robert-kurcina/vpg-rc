import copy, importlib.util, json, pathlib, tempfile, unittest, xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('terrain_svg76',ROOT/'tools/extract-arduous-svg-terrain-v318.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class SvgTerrainPerHexTests(unittest.TestCase):
 def test_reproducible_all_hexes(self):
  report=mod.inspect()
  self.assertEqual(report,json.loads(mod.OUT.read_text()))
  self.assertEqual(report['counts']['hexes'],155)
  self.assertEqual((report['counts']['forest'],report['counts']['swamp'],report['counts']['noAuthoredOverlay']),(30,20,105))
  self.assertFalse(report['authorizedForMovement'])
  self.assertEqual(len({v['hexId'] for v in report['hexes']}),155)
 def test_untranscribed_hexes_are_visually_unmarked_not_gameplay_open(self):
  r=mod.inspect();self.assertEqual(r['untranscribedHexes'],[])
  for cell in r['hexes']:
   self.assertFalse(cell['gameplayTerrainCertified'])
   if cell['hexId'] in ('0211','0907'):
    self.assertIsNone(cell['terrainOverlay'])
    self.assertEqual(cell['previousTerrainValue'],'open')
    self.assertEqual(cell['previousTerrainStatus'],'source-svg-scan-reviewed-open-v412')
 def test_all_50_markers_have_source_ids_and_registered_hex(self):
  r=mod.inspect();by={c['hexId']:c for c in r['hexes']}
  self.assertEqual(len(r['authoredGeometry']),50)
  for g in r['authoredGeometry']:
   self.assertEqual(by[g['hexId']]['terrainOverlay'],g['feature'])
   self.assertEqual(by[g['hexId']]['sourceSvgIds'],[g['sourceSvgId']])
   self.assertLess(g['centerResidualPx'],4.1)
   self.assertLess(g['centerResidualPx'],g['nextNearestDistancePx'])
 def test_reject_corrupt_svg(self):
  tree=ET.parse(mod.SVG);root=tree.getroot();e=next(n for n in root.iter() if n.get('id')=='path205');e.set('d','M 0 0 L 2 2')
  with tempfile.TemporaryDirectory() as d:
   f=pathlib.Path(d)/'changed.svg';tree.write(f)
   with self.assertRaisesRegex(ValueError,'checksum-mismatch'):mod.inspect(svg_path=f)
 def test_reject_wrong_registration_even_when_source_is_untouched(self):
  data=json.loads(mod.MAP.read_text());data['authoredSourceVectors']['registration']['translateX']+=90
  with tempfile.TemporaryDirectory() as d:
   f=pathlib.Path(d)/'changed.json';f.write_text(json.dumps(data))
   with self.assertRaisesRegex(ValueError,'vector-to-hex-mismatch'):mod.inspect(map_path=f)
 def test_reject_mismatched_source_registration(self):
  data=json.loads(mod.MAP.read_text());data['authoredSvgImportAudit']['details']['terrain']['forest'][0]['cellId']='0202'
  with tempfile.TemporaryDirectory() as d:
   f=pathlib.Path(d)/'changed.json';f.write_text(json.dumps(data))
   with self.assertRaisesRegex(ValueError,'vector-to-hex-mismatch'):mod.inspect(map_path=f)
 def test_affine_transform_is_correct(self):
  self.assertEqual(mod.point(mod.transform('translate(3,4) scale(2)'),(2,3)),(7.,10.))
  self.assertEqual(mod.point(mod.transform('matrix(1,0,0,1,5,6)'),(2,3)),(7.,9.))

if __name__=='__main__':unittest.main()
