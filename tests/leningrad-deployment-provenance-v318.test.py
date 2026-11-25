import importlib.util
import json
import pathlib
import tempfile
import unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('audit_deployment',ROOT/'tools/audit-leningrad-deployment-provenance-v318.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SourceProvenance(unittest.TestCase):
 def test_source_instance_families_and_digest(self):
  r=m.audit()
  self.assertEqual((r['auditedCrossCount'],r['tileCrossCount']),(4,5))
  self.assertEqual(r['auditOnlyHexes'],['0109'])
  self.assertEqual(r['tileOnlyHexes'],['0311','0511'])
  self.assertEqual(r['commonHexes'],['0210','0310','0411'])
  self.assertNotEqual(r['sourceRegistries']['authoredSvgImportAudit']['sha256'],r['sourceRegistries']['tileMarkers']['sha256'])
  self.assertEqual({x['symbolId'] for x in r['sourceRegistries']['authoredSvgImportAudit']['instances']},{'symbol122'})
  self.assertEqual({x['symbolId'] for x in r['sourceRegistries']['tileMarkers']['instances']},{'g10'})
  self.assertFalse(r['readyForHistoricalDeployment'])
 def test_report_snapshot(self):
  expected=json.loads((ROOT/'rules/audit/leningrad-deployment-source-provenance-v318.json').read_text())
  self.assertEqual(m.audit(),expected)
 def test_missing_instance_fails_closed(self):
  data=json.loads(m.MAP.read_text())
  entry=next(x for x in data['authoredSvgImportAudit']['details']['deployment'] if x['kind']=='cross')
  entry['sourceId']='invented-source-id'
  with self.assertRaisesRegex(ValueError,'expected exactly one'):m.audit(data)
 def test_missing_symbol_fails_closed(self):
  with tempfile.TemporaryDirectory() as d:
   path=pathlib.Path(d)/'corrupt.svg'
   raw=m.SOURCES['tileMarkers'].read_text()
   path.write_text(raw.replace('xlink:href="#g10"','xlink:href="#nonexistent"'))
   with self.assertRaisesRegex(ValueError,'unresolved SVG symbol'):
    m.audit(paths={**m.SOURCES,'tileMarkers':path})
 def test_duplicate_hex_fails_closed(self):
  data=json.loads(m.MAP.read_text())
  cross=next(t for c in data['cells'] for t in c.get('tileMarkers',[]) if t['kind']=='cross')
  c=next(c for c in data['cells'] if c['id']=='0310') # v335 active cross host
  c['tileMarkers'].append(dict(cross))
  with self.assertRaisesRegex(ValueError,'Duplicate cross'):m.audit(data)
if __name__=='__main__':unittest.main()
