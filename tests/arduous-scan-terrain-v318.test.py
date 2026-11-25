import importlib.util
import json
import pathlib
import tempfile
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
SCRIPT=ROOT/'tools/audit-arduous-scan-terrain-v318.py'
spec=importlib.util.spec_from_file_location('arduous_scan_terrain',SCRIPT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class ScanTerrainTest(unittest.TestCase):
    def test_reproduces_committed_audit(self):
        self.assertEqual(mod.inspect(),json.loads(mod.OUT.read_text()))
    def test_scan_matches_source_hash(self):
        result=mod.inspect()
        self.assertEqual(result['sourceScanSha256'],json.loads(mod.MAP.read_text())['sourceImageSHA256'])
        self.assertEqual(result['scanDimensions'],[900,575])
    def test_all_authored_terrain_corroborrated(self):
        report=mod.inspect()['coverage']
        self.assertEqual((report['authoredForestCorroborated'],report['authoredSwampCorroborated']),(30,20))
        self.assertEqual(report['unresolvedWithDominantForestOrSwampCenterColor'],0)
        self.assertEqual(report['unresolvedWithoutForestOrSwampCenterColor'],105)
        self.assertEqual(report['stillUntranscribed'],0)
    def test_does_not_authorize_gameplay(self):
        report=mod.inspect()
        self.assertFalse(report['authorizedForMovement'])
        self.assertTrue(all(not r['movementCertifiedByThisAudit'] for r in report['hexEvidence']))
    def test_modified_scan_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=pathlib.Path(tmp)/mod.SCAN.name
            p.write_bytes(mod.SCAN.read_bytes()+b'not-original')
            with self.assertRaisesRegex(ValueError,'checksum'):
                mod.inspect(scan_path=p)
    def test_bad_svg_registration_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=pathlib.Path(tmp)/mod.MAP.name
            board=json.loads(mod.MAP.read_text())
            c=next(c for c in board['cells'] if c['terrain']=='forest')
            c['pixelCenter']=[1,1]
            p.write_text(json.dumps(board))
            with self.assertRaisesRegex(ValueError,'sample-outside-scan'):
                mod.inspect(map_path=p)

if __name__=='__main__':unittest.main()
