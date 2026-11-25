import importlib.util, json, pathlib, tempfile, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('lineage',ROOT/'tools/audit-leningrad-source-lineage-v324.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Lineage(unittest.TestCase):
 def test_dedup_and_rule_count(self):
  r=m.report(); f=r['families']
  self.assertEqual([(x['crossCount'],len(x['files'])) for x in f],[(4,2),(5,3)])
  self.assertEqual(len(r['scanDigests']),1)
  self.assertEqual(len(r['scanDigests'][0]['files']),3)
  self.assertFalse(r['historicalSetupAuthorized'])
  self.assertEqual(r['sourceAuthority'],'main-five-cross-candidate-not-promoted')
 def test_snapshot(self):
  saved=json.loads((ROOT/'rules/audit/leningrad-source-lineage-v324.json').read_text())
  self.assertEqual(m.report(),saved)
 def test_missing_svg_family_fails(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)
   (p/'leningrad-main.svg').write_bytes((m.SVG_DIR/'leningrad-main.svg').read_bytes())
   with self.assertRaisesRegex(ValueError,'both SVG families'):m.report(svg_dir=p)
 def test_missing_scan_fails(self):
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaisesRegex(ValueError,'Original scan missing'):m.report(scans_dir=pathlib.Path(d))
 def test_altered_svg_cross_count_fails(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)
   for src in (m.SVG_DIR/'leningrad-main.svg',m.SVG_DIR/'leningrad-map-temp(3).svg'):
    (p/src.name).write_bytes(src.read_bytes())
   old=(p/'leningrad-main.svg').read_text()
   (p/'leningrad-main.svg').write_text(old.replace('xlink:href="#g10"','xlink:href="#not-cross"'))
   with self.assertRaisesRegex(ValueError,'Unexpected authored families'):m.report(svg_dir=p)
if __name__=='__main__':unittest.main()
