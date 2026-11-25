"""Protect old approved Leningrad geometry while testing current v373 style.

The original user-approved v350 SVG/PNG hashes are retained unchanged as
historical evidence; the new shadow-free render is a separate candidate.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
BASELINE=ROOT/'rules/audit/leningrad-visual-baseline-v350.json'
CANDIDATE=ROOT/'rules/audit/forest-shadow-removal-v373.json'

class CurrentApprovedRender(unittest.TestCase):
 def test_fresh_export_preserves_approved_geometry_and_matches_foreground_shadow_candidate(self):
  evidence=json.loads(BASELINE.read_text())
  self.assertEqual(evidence['approvedDeploymentSource'],'user-confirmed-left-v345')
  self.assertEqual(evidence['approvedRiverRendering'],'smooth-river-wavelets-v350')
  self.assertEqual(evidence['pngSHA256'],'3b622a8a645b3c87f0622dd82de347c6110a10ce639058057b765ff3bb99be2f')
  self.assertEqual(evidence['svgSHA256'],'4ad4965040952244ee4c7dc136e8726616a3c791d64dfa3b5b74fc46f3f0cd03')
  candidate=next(item for item in json.loads(CANDIDATE.read_text())['results'] if item['id']=='leningrad')
  with tempfile.TemporaryDirectory(prefix='leningrad-v373-') as td:
   run=subprocess.run(['node',str(ROOT/'scripts/export-campaign-maps.js'),td],cwd=ROOT,
                      capture_output=True,text=True)
   self.assertEqual(run.returncode,0,run.stderr)
   manifest=json.loads((Path(td)/'manifest.json').read_text())
   ln=next(row for row in manifest if row['id']=='leningrad')
   self.assertFalse(ln['errors'])
   for ext,key in [('.png','pngSHA256'),('.svg','svgSHA256')]:
    p=Path(td)/('leningrad'+ext)
    digest=hashlib.sha256(p.read_bytes()).hexdigest()
    self.assertEqual(digest,ln[key],'fresh manifest mismatch '+ext)
    self.assertEqual(digest,candidate['candidate'+key[0].upper()+key[1:]],'new v373 candidate visual changed '+ext)
    self.assertNotEqual(digest,evidence[key],'legacy v350 image unexpectedly identical to changed v373 '+ext)
   rendered=(Path(td)/'leningrad.svg').read_text()
   self.assertEqual(rendered.count('data-river-smoothing="cubic"'),10)
   self.assertEqual(rendered.count('data-deployment-kind="cross"'),5)
   self.assertEqual(rendered.count('data-deployment-kind="star"'),5)
   self.assertNotIn('forest-shadow',rendered)
   self.assertIn('data-layer="forest-terrain"',rendered)

if __name__=='__main__':unittest.main()
