import copy, importlib.util, json, pathlib, tempfile, unittest, xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[1]
modspec=importlib.util.spec_from_file_location('arduous_terrain_source',ROOT/'tools/audit-arduous-terrain-source-v318.py')
mod=importlib.util.module_from_spec(modspec);modspec.loader.exec_module(mod)

class TestArduousTerrainSource(unittest.TestCase):
 def test_original_reproducible_and_not_authorizing(self):
  result=mod.inspect()
  expected=json.loads((ROOT/'rules/audit/arduous-terrain-source-reconciliation-v318.json').read_text())
  self.assertEqual(result,expected)
  self.assertFalse(result['authorizedForMovement'])
  self.assertEqual(result['coverage']['verifiedSourceMarkerRecords'],50)
  self.assertEqual(result['coverage']['provisionalHexes'],0)
  self.assertEqual(result['coverage']['reviewedOpenHexes'],105)
  self.assertEqual(result['coverage']['provisionalByStatus'],{})
  self.assertEqual(len(set(x['hexId'] for x in result['authoredTerrainEvidence'])),50)
 def test_reject_missing_svg_marker(self):
  svg=ET.parse(mod.SVG)
  root=svg.getroot()
  parents={c:p for p in root.iter() for c in p}
  e=next(e for e in root.iter() if e.get('id')=='path205')
  parents[e].remove(e)
  with tempfile.TemporaryDirectory() as td:
   dest=pathlib.Path(td)/'altered.svg';svg.write(dest)
   with self.assertRaisesRegex(ValueError,'checksum-mismatch'):
    mod.inspect(svg_path=dest)
 def test_reject_marker_reassigned_to_unmarked_cell(self):
  board=json.loads(mod.MAP.read_text())
  board['authoredSvgImportAudit']['details']['terrain']['forest'][0]['cellId']='0105'
  with tempfile.TemporaryDirectory() as td:
   dest=pathlib.Path(td)/'altered.json';dest.write_text(json.dumps(board))
   with self.assertRaisesRegex(ValueError,'marker-terrain-disagreement'):
    mod.inspect(map_path=dest)
 def test_reject_unregistered_svg_markers(self):
  board=json.loads(mod.MAP.read_text())
  board['authoredSvgImportAudit']['forestMarkers']=29
  with tempfile.TemporaryDirectory() as td:
   dest=pathlib.Path(td)/'altered.json';dest.write_text(json.dumps(board))
   with self.assertRaisesRegex(ValueError,'marker-count-mismatch'):
    mod.inspect(map_path=dest)
 def test_reject_false_authored_terrain(self):
  board=json.loads(mod.MAP.read_text())
  next(c for c in board['cells'] if c['id']=='0105')['terrainStatus']='user-svg-authored-forest'
  with tempfile.TemporaryDirectory() as td:
   dest=pathlib.Path(td)/'altered.json';dest.write_text(json.dumps(board))
   with self.assertRaisesRegex(ValueError,'authored-cell-unaccounted'):
    mod.inspect(map_path=dest)

if __name__=='__main__':unittest.main()
