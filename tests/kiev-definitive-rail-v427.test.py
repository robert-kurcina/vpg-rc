import importlib.util,json,pathlib,unittest,copy
R=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('kiev_v427',R/'tools/rebuild-kiev-rails-v427.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class SourceRailTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.map=json.loads((R/'maps/kiev.json').read_text())
        cls.ext=json.loads((R/'maps/odessa-extension.json').read_text())
    def test_exact_svg_reconstruction(self):
        expected,report=module.reconstruct(self.map,self.ext)
        self.assertEqual(expected['cells'],self.map['cells'])
        self.assertEqual(expected['hexCenterRailConnections'],self.map['hexCenterRailConnections'])
        self.assertEqual(report['definitiveSourceLinks'],93)
        self.assertEqual(report['reciprocalRailSideRecords'],186)
        self.assertEqual(report['originalRegisteredLinks'],97)
        self.assertEqual(report['registeredMissingFromDefinitive'],['0101:0102','0101:0201','0306:0406','0711:0810','1501:1601'])
        self.assertEqual(report['definitiveMissingFromRegistered'],['0501:0502'])
        self.assertEqual(expected['railwayNetworkAudit']['exteriorStubs'],9)
        self.assertFalse(expected['railwayNetworkAudit']['exteriorStubsCertified'])
    def test_modified_source_vertex_is_rejected(self):
        tampered=copy.deepcopy(self.ext)
        tampered['authoritativeRailRoutes'][0]['points'][0][0]+=1
        with self.assertRaisesRegex(ValueError,'source vertex changed'):
            module.reconstruct(self.map,tampered)
    def test_modified_display_route_is_rejected(self):
        tampered=copy.deepcopy(self.map)
        tampered['sourceRailRoutes'][0]['points'][0][0]+=12
        with self.assertRaisesRegex(ValueError,'Source/display route geometry diverges|Source and approved displayed rail paths cross different hexsides'):
            module.reconstruct(tampered,self.ext)
if __name__=='__main__':unittest.main()
