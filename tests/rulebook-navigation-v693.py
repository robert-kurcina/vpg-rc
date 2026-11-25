"""Validate direct section anchors against supplied PDF-derived heading index."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,re,fitz
ROOT=Path(__file__).resolve().parents[1]/'references/rules'
class Reader(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.targets=[];self.images=[];self.links=[];self.headings={};self.heading=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='a':
   h=a.get('href','');self.links.append(h)
   if h.startswith('#rule-'):self.targets.append(h[1:])
  if tag=='img':self.images.append(a['src'])
  if tag=='h3' and a.get('id','').startswith('rule-'):self.heading=a['id'];self.headings[self.heading]=''
 def handle_data(self,data):
  if self.heading:self.headings[self.heading]+=data
 def handle_endtag(self,tag):
  if tag=='h3':self.heading=None
counts={}
for pdf in sorted(ROOT.glob('*-rules.pdf')):
 html=pdf.with_suffix('.html').read_text();p=Reader();p.feed(html)
 d=fitz.open(pdf);expected={}
 for page in d:
  for block in page.get_text('dict')['blocks']:
   lines=block.get('lines',[])
   for i,line in enumerate(lines):
    text=''.join(span['text'] for span in line['spans']).strip();m=re.match(r'^\[(\d+\.0)\]\s+([A-Z].*)$',text)
    if not m or re.search(r'\.{2,}',text):continue
    num,label=m.groups()
    if label=='GENERAL COURSE' and i+1<len(lines) and ''.join(s['text'] for s in lines[i+1]['spans']).strip()=='OF PLAY':label+=' OF PLAY'
    expected['rule-'+num.replace('.','-')]=f'[{num}] {label}'
 assert p.headings==expected,(pdf.name,p.headings,expected)
 assert len(p.ids)==len(set(p.ids)) and set(p.targets)==set(expected) and len(p.targets)==len(expected)
 for link in p.links:
  if link.startswith('#'):assert link[1:] in p.ids,(pdf.name,link)
  else:assert (ROOT/link).is_file(),(pdf.name,link)
 pages=4 if pdf.name=='b4m-rules.pdf' else len(d)
 assert len(p.images)==pages and all((ROOT/x).is_file() for x in p.images)
 assert hashlib.sha256(pdf.read_bytes()).hexdigest() in html
 counts[pdf.stem]=len(expected)
print('PASS direct source headings:',counts,'total:',sum(counts.values()),'all 24 facsimiles and PDF fingerprints')
