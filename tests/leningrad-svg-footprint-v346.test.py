"""Tests source geometry, 197-hex terrain footprint and v345 deployment freeze."""
import copy
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('footprint',ROOT/'tools/audit-leningrad-svg-footprint-v346.py')
A=importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)

class SourceFootprint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report=A.audit()
    def test_geometry_counts_and_exact_source_elements(self):
        r=self.report
        self.assertTrue(r['sourceFootprintReconciled'])
        self.assertEqual((r['sourceGridPathCount'],r['distinctSourceGridCenters'],r['runtimeHexCells'],r['matchedRuntimeCells']), (200,199,197,197))
        self.assertEqual(r['duplicateSvgGridPaths'][0]['svgPathIds'],['path172','path68'])
        self.assertEqual([(x['geometrySlot'],x['sourceSvgPaths']) for x in r['gridOnlyUnpaintedOutlines']],
                         [('1801',['path142']),('2001',['path144'])])
        self.assertEqual(r['runtimeCellsWithoutSourceGridPosition'],[])
        self.assertTrue(all(not any(c['terrainPaintBBoxHits'].values()) for c in r['gridOnlyUnpaintedOutlines']))
    def test_report_matches_live_source_without_overwriting_it(self):
        expected=json.loads((ROOT/'rules/audit/leningrad-svg-footprint-v346.json').read_text())
        self.assertEqual(self.report,expected)
    def test_missing_vector_grid_path_fails_closed(self):
        tree=ET.parse(A.SOURCE)
        grid=next(x for x in tree.iter() if x.get('id')=='layer9')
        grid.remove(next(x for x in grid if x.get('id')=='path142'))
        with tempfile.TemporaryDirectory() as d:
            source=pathlib.Path(d)/'altered.svg'
            tree.write(source, encoding='utf-8',xml_declaration=True)
            r=A.audit(source)
            self.assertFalse(r['sourceFootprintReconciled'])
    def test_new_terrain_paint_on_outline_fails_closed(self):
        tree=ET.parse(A.SOURCE)
        layer=next(x for x in tree.iter() if x.get('id')=='layer14')
        e=ET.SubElement(layer,'{http://www.w3.org/2000/svg}path',{'id':'injected-terrain','d':'M0,0H1'})
        b=A.query_bboxes(A.SOURCE)
        b['injected-terrain']=(1015.0,54.0,1.0,1.0)
        with tempfile.TemporaryDirectory() as d:
            source=pathlib.Path(d)/'altered.svg'
            tree.write(source,encoding='utf-8',xml_declaration=True)
            r=A.audit(source,bbox=b)
            self.assertFalse(r['sourceFootprintReconciled'])
    def test_approved_marker_registry_not_mutated(self):
        board=json.loads(A.MAP.read_text())
        bykind={k:sorted(c['id'] for c in board['cells'] for m in c.get('tileMarkers',[]) if m.get('kind')==k)
                for k in ('cross','star')}
        approved=board['v345UserApprovedLeftRender']
        self.assertEqual(bykind['cross'],sorted(approved['germanCrosses']))
        self.assertEqual(bykind['star'],sorted(approved['sovietStars']))
        self.assertEqual(board['geometry'].get('deploymentMarkerPlacement'),None)
        self.assertFalse(approved['historicalSetupAuthorized'])

if __name__=='__main__':unittest.main()
