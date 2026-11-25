"""Hard visual regression: fresh engine PNG must match the user-approved LEFT v343 render.

Runs the real export command in a clean temporary directory, not a stale packaged PNG.
The original left and right halves are preserved, byte-unaltered, in the checkpoint
comparison image. We intentionally reject the right v344 result.
"""
from pathlib import Path
from PIL import Image, ImageChops
import hashlib
import json
import subprocess
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
COMPARE=ROOT/'rules/audit/visual/leningrad-user-approved-before-after-v345.png'
class ApprovedRenderedImage(unittest.TestCase):
 def test_fresh_export_exactly_matches_user_approved_left(self):
  with tempfile.TemporaryDirectory(prefix='leningrad-v345-') as td:
   run=subprocess.run(['node',str(ROOT/'scripts/export-campaign-maps.js'),td],cwd=ROOT,
                      capture_output=True,text=True)
   self.assertEqual(run.returncode,0,run.stderr)
   m=json.loads((Path(td)/'manifest.json').read_text())
   ln=next(row for row in m if row['id']=='leningrad')
   png=Path(td)/ln['png']
   self.assertEqual(hashlib.sha256(png.read_bytes()).hexdigest(),ln['pngSHA256'])
   fresh=Image.open(png).convert('RGB')
   compare=Image.open(COMPARE).convert('RGB')
   self.assertEqual(fresh.size,(1250,819))
   self.assertEqual(compare.size,(1360,529))
   left=compare.crop((0,0,680,529))
   right=compare.crop((680,0,1360,529))
   southwest=fresh.crop((0,290,680,819))
   self.assertIsNone(ImageChops.difference(left,southwest).getbbox(),
                     'Fresh image MUST equal the user-confirmed correct LEFT v343 render')
   self.assertIsNotNone(ImageChops.difference(right,southwest).getbbox(),
                        'Rejected v344 RIGHT must not accidentally be restored')
if __name__=='__main__':unittest.main()
