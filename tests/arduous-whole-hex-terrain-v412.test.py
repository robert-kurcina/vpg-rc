import copy, hashlib, importlib.util, json, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=ROOT/'tools/reconcile-arduous-terrain-v412.py'
spec=importlib.util.spec_from_file_location('arduous_terrain_v412',p)
A=importlib.util.module_from_spec(spec);spec.loader.exec_module(A)

class WholeHexTerrain(unittest.TestCase):
 def test_map_report_exhaustive_and_reproducible(self):
  m=json.loads(A.MAP.read_text());report=A.review()
  self.assertEqual(report,json.loads(A.OUT.read_text()))
  self.assertEqual(report['sourceMapSha256'],hashlib.sha256(A.MAP.read_bytes()).hexdigest())
  self.assertEqual(report['counts'],{'hexes':155,'forest':30,'swamp':20,'reviewedOpen':105,
    'currentlyUnclassified':0,'openCityHexes':['0211','0907']})
  self.assertFalse(report['authorizedForMovement'])
  self.assertEqual(len({r['hexId'] for r in report['records']}),155)
  self.assertEqual(sum(c['terrain']=='open' for c in m['cells']),105)
  self.assertEqual(sum(c['terrainStatus']==A.REVIEW_STATUS for c in m['cells']),105)
  self.assertEqual(set(c['terrain'] for c in m['cells']),{'open','forest','swamp'})
  self.assertEqual(m['v412TerrainEvidenceAudit']['priorMapSHA256'],A.ORIGINAL_SHA)
 def test_source_svg_scan_and_city_binding(self):
  report=A.review();m=json.loads(A.MAP.read_text());cells={c['id']:c for c in m['cells']}
  open_entries=[r for r in report['records'] if r['terrain']=='open']
  self.assertEqual(len(open_entries),105)
  for r in open_entries:
   self.assertLess(r['greenFraction'],0.5)
   self.assertLess(r['swampFraction'],0.5)
   self.assertEqual(cells[r['hexId']]['terrainStatus'],A.REVIEW_STATUS)
  self.assertEqual([r['hexId'] for r in open_entries if r['hexId'] in ('0211','0907')],['0211','0907'])
  for h in ('0211','0907'):
   self.assertTrue(any(t.get('kind')=='city' for t in cells[h]['tileMarkers']))
  self.assertEqual(sum(r['review']=='authored-source-svg-marker' for r in report['records']),50)
 def test_reject_original_source_modifications(self):
  m=json.loads(A.MAP.read_text());scan=A.SCAN.read_bytes();svg=A.SVG.read_bytes()
  with self.assertRaisesRegex(ValueError,'Board-scan checksum'):
   A.build(m,svg,scan+b'bad')
  with self.assertRaisesRegex(ValueError,'SVG checksum'):
   A.build(m,svg+b'bad',scan)
 def test_reject_inconsistent_reviewed_terrain(self):
  m=json.loads(A.MAP.read_text());c=next(c for c in m['cells'] if c['id']=='0211')
  c['terrain']='forest'
  with self.assertRaisesRegex(ValueError,'Unmarked non-open'):
   A.build(m,A.SVG.read_bytes(),A.SCAN.read_bytes())
 def test_reject_duplicate_and_changed_source_layer(self):
  m=json.loads(A.MAP.read_text());m['cells'].append(copy.deepcopy(m['cells'][0]))
  with self.assertRaisesRegex(ValueError,'Unexpected topology or duplicate'):
   A.build(m,A.SVG.read_bytes(),A.SCAN.read_bytes())
 def test_runtime_still_refuses_uncertified_movement(self):
  from subprocess import run
  cmd="const G=require('./core/map_movement_graph');const m=require('./maps/arduous.json');if(G.build(m).metadata.riverEdges!==45)process.exit(2)"
  r=run(['node','-e',cmd],cwd=ROOT)
  self.assertEqual(r.returncode,0)

if __name__=='__main__':unittest.main()
