"""Check numbered case coverage against source, including duplicate printed numbers."""
from pathlib import Path
from collections import Counter
from html.parser import HTMLParser
import re,fitz,hashlib,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
RULES=ROOT/'references/rules'
class Reader(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.links=[];self.cases={};self.current=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='a' and a.get('href','').startswith('#case-'):self.links.append(a['href'][1:])
  if tag=='p' and a.get('class')=='rule-case':self.current=a['id'];self.cases[self.current]=''
 def handle_data(self,data):
  if self.current:self.cases[self.current]+=data
 def handle_endtag(self,tag):
  if tag=='p':self.current=None
assets={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in [*RULES.glob('*.pdf'),*RULES.glob('*-page-*.webp')]}
html_hash={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in RULES.glob('*-rules.html')}
subprocess.run([sys.executable,str(ROOT/'scripts/build-rulebook-html.py'),'--text-only'],check=True)
assert all(hashlib.sha256(p.read_bytes()).hexdigest()==h for p,h in assets.items())
assert all(hashlib.sha256(p.read_bytes()).hexdigest()==h for p,h in html_hash.items())
counts={}
for pdf in sorted(RULES.glob('*-rules.pdf')):
 expected=Counter()
 with fitz.open(pdf) as doc:
  for page in doc:
   for line in page.get_text().splitlines():
    m=re.match(r'^\s*\[(\d+\.\d+(?:\.\d+)*)\]\s+(.+)',line)
    if m and not m[1].endswith('.0'):expected[m[1]]+=1
 reader=Reader();reader.feed(pdf.with_suffix('.html').read_text())
 actual=Counter()
 for anchor,text in reader.cases.items():
  num=re.match(r'^\[([^\]]+)\]',text)[1];actual[num]+=1
  assert anchor==f"case-{num.replace('.','-')}-{actual[num]}"
 assert actual==expected,(pdf.name,expected-actual,actual-expected)
 assert len(reader.ids)==len(set(reader.ids))
 assert Counter(reader.links)==Counter(reader.cases.keys())
 counts[pdf.stem]=sum(actual.values())
 if pdf.stem=='b4m-rules':assert '[9.1] Long Odds: After Step 2, above, if the odds are above 6:1' in reader.cases['case-9-1-1']
print('PASS',counts,'total',sum(counts.values()),'source assets unchanged:',len(assets),'reproducible HTML')
