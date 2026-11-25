import copy,hashlib,importlib.util,json,pathlib,subprocess,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('kiev_terrain_v428',ROOT/'tools/reconcile-kiev-terrain-v428.py')
K=importlib.util.module_from_spec(spec);spec.loader.exec_module(K)
class TerrainSourceTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.board=json.loads(K.MAP.read_text());cls.ext=json.loads(K.EXT.read_text());cls.source_query=subprocess.check_output(['inkscape',str(K.SRC),'--query-all'],text=True,stderr=subprocess.DEVNULL)
 def test_exhaustive_current_and_source(self):
  updated,report=K.gather(self.board,self.ext,self.source_query)
  self.assertEqual(updated['cells'],self.board['cells'])
  self.assertEqual(report,json.loads(K.AUDIT.read_text()))
  self.assertEqual(report['sourceCertifiedHexes'],149)
  self.assertEqual(report['counts'],{'open':97,'forest':41,'swamp':11})
  self.assertEqual(next(c for c in self.board['cells'] if c['id']=='1502')['terrain'],'forest')
  self.assertEqual(len(report['cityOverlayWithoutBaseSymbol']),16)
  self.assertEqual(report['correctedTerrainHexes'],['0403','0608','1009'])
  self.assertEqual(len(self.board['hexCenterRailConnections']),93)
  self.assertEqual(hashlib.sha256(K.SRC.read_bytes()).hexdigest(),K.PIN)
 def test_no_city_or_river_auto_certification(self):
  cities=set(K.CITY_IDS)
  for c in self.board['cells']:
   if c['id'] in cities:self.assertNotEqual(c['terrainStatus'],K.STATUS)
   else:self.assertEqual(c['terrainStatus'], 'user-adjudicated-terrain-v435' if c['id']=='1502' else K.STATUS)
  self.assertEqual(json.loads((ROOT/'maps/movement-configs/graph-sources.json').read_text())['maps']['kiev-native-draft-v231']['status'],'provisional')
 def test_tampered_data_rejected(self):
  edited=copy.deepcopy(self.board);edited['cells'].append(copy.deepcopy(edited['cells'][0]))
  with self.assertRaisesRegex(ValueError,'Unexpected complete map or duplicate'):K.gather(edited,self.ext,self.source_query)
  altered=copy.deepcopy(self.ext);altered['authoritativeCompositeSvg']['sha256']='bad'
  with self.assertRaisesRegex(ValueError,'pin mismatch'):K.gather(self.board,altered,self.source_query)
  revised=self.source_query.replace('use477,','use477,9999,',1)
  with self.assertRaisesRegex(ValueError,'registration changed|not aligned'):K.gather(self.board,self.ext,revised)
 def test_immutable_source_layers(self):
  # A missing terrain symbol in the source query cannot be silently interpreted as Open.
  missing='\n'.join(line for line in self.source_query.splitlines() if not line.startswith('use477,'))
  with self.assertRaisesRegex(ValueError,'registration changed'):K.gather(self.board,self.ext,missing)
if __name__=='__main__':unittest.main()
