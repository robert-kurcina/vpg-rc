"""Keep the v342 raster-audit record immutable; never use it to validate live hosts.

Current active deployment host registration is tested against the supplied
SVG by tests/leningrad-svg-hostcells-v343.test.py instead.
"""
import json
import pathlib
import unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class ArchivedScanAudit(unittest.TestCase):
 def test_archived_report_only(self):
  r=json.loads((ROOT/'rules/audit/leningrad-independent-grid-registration-v342.json').read_text())
  self.assertEqual(r['derivedHosts']['cross'],['0109','0210','0211','0310','0411'])
  self.assertEqual(r['derivedHosts']['star'],['0108','0209','0309','0410','0510'])
  self.assertEqual(r['derivedHosts'],r['actualHosts'])  # v342 snapshot only
  self.assertFalse(r['historicalSetupAuthorized'])
  # The original v342 report itself also recorded the divergent SVG positions.
  svg=r['authoredSVGInstanceHosts']
  self.assertEqual(sorted(x['hostCell'] for x in svg if x['kind']=='cross'),['0210','0310','0311','0411','0511'])
  self.assertEqual(sorted(x['hostCell'] for x in svg if x['kind']=='star'),['0209','0309','0410','0510','0611'])
 def test_live_report_uses_only_svg(self):
  map=json.loads((ROOT/'maps/leningrad.json').read_text())
  self.assertEqual(map['v343SourceSvgHostCells']['scanEvidenceUsed'],False)
  active=map['v343SourceSvgHostCells']['hostCellAssignments']
  self.assertEqual(len(active),10)
  self.assertNotEqual(sorted(a['hostCell'] for a in active if a['kind']=='cross'),
                      ['0109','0210','0211','0310','0411'])
if __name__=='__main__':unittest.main()
