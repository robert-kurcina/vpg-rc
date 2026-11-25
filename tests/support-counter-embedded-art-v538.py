#!/usr/bin/env python3
"""Source-photo byte-equivalence audit for standalone Support artwork.

Every embedded image must equal an original support-counters PNG. The bundle is
not a second art source or an approximation of the printed counter artwork.
"""
from pathlib import Path
import base64,json
root=Path(__file__).resolve().parents[1]
script=(root/'core/support_counter_art_bundle.js').read_text()
start=script.index('const faces=Object.freeze(')+len('const faces=Object.freeze(')
end=script.index(');\nroot.WargameSupportCounterArt',start)
data=json.loads(script[start:end]);checks=0
source={f.stem:f for f in (root/'assets/support-counters').glob('*.png')}
assert set(data)==set(source);checks+=1
for key,encoded in data.items():
 assert base64.b64decode(encoded,validate=True)==source[key].read_bytes(),key
 checks+=1
for name in ('kiev/setup-preview','arduous/native-preview','leningrad/native-preview','kiev-odessa/experimental-preview'):
 page=(root/'games'/name/'index.html').read_text()
 assert 'core/support_counter_art_bundle.js' in page,name;checks+=1
 assert 'core/historical_retreat_map_ux.js' in page,name;checks+=1
print('PASS v538 embedded Support counter art:',checks,'byte/route-page assertions')
