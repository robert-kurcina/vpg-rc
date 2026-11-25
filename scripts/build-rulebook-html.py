#!/usr/bin/env python3
"""Build local HTML reading editions from supplied PDFs (PyMuPDF, development only)."""
from pathlib import Path
import fitz, html, re, hashlib, argparse
from collections import Counter
parser=argparse.ArgumentParser(); parser.add_argument("--text-only",action="store_true",help="Retain existing facsimile assets unchanged")
args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[1]/'references/rules'
BOOKS={'b4m':'Battle for Moscow','arduous':'The Arduous Beginning','leningrad':'Target: Leningrad','kiev':'Objective: Kiev','odessa':'Objective: Odessa expansion'}
for key,title in BOOKS.items():
 source=ROOT/f'{key}-rules.pdf'; doc=fitz.open(source); pages=[]; rule_index=[]; case_index=[]; case_counts=Counter()
 # Moscow is supplied as imposed booklet spreads: 4|1 and 2|3.
 order=[(0,1),(1,0),(1,1),(0,0)] if key=='b4m' else [(i,0) for i in range(len(doc))]
 for n,(i,half) in enumerate(order,1):
  page_headings={}; emitted=set()
  p=doc[i]; w=p.rect.width/(2 if key=='b4m' else 1); left=half*w
  clip=fitz.Rect(left,0,left+w,p.rect.height)
  img=f'{key}-page-{n}.webp'
  if not args.text_only:p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),clip=clip,alpha=False).pil_save(ROOT/img,format='WEBP',quality=90)
  elif not (ROOT/img).is_file():raise FileNotFoundError(ROOT/img)
  # Index actual printed major headings, not the first-page dotted TOC.
  # Link to the original printed page, rather than inventing precise text
  # anchors in an imperfect multi-column extraction.
  for block in p.get_text('dict')['blocks']:
   lines=block.get('lines',[])
   for j,line in enumerate(lines):
    text=''.join(span['text'] for span in line['spans']).strip()
    r=fitz.Rect(line['bbox'])*p.rotation_matrix
    if not left <= (r.x0+r.x1)/2 < left+w:continue
    m=re.match(r'^\[(\d+\.0)\]\s+([A-Z].*)$',text)
    if not m or re.search(r'\.{2,}',text):continue
    label=m.group(2)
    # The source splits this heading across two printed lines.
    if label=='GENERAL COURSE' and j+1<len(lines):
     continuation=''.join(span['text'] for span in lines[j+1]['spans']).strip()
     if continuation=='OF PLAY':label+=' '+continuation
    num=m.group(1); anchor=f"rule-{num.replace('.','-')}"
    if num in page_headings:raise ValueError(f"Duplicate heading: {key} {num}")
    page_headings[num]=(label,anchor)
    rule_index.append((num,label,n,anchor))
  columns=[[],[],[]]
  for b in p.get_text('blocks'):
   if b[6]!=0 or not b[4].strip():continue
   r=fitz.Rect(b[:4])*p.rotation_matrix
   if not left <= (r.x0+r.x1)/2 < left+w:continue
   # Headers and footers remain available in the page facsimile.
   if r.y1<53 or r.y0>745:continue
   col=min(2,max(0,int((r.x0-left)/ (w/3))))
   text=b[4]
   # Verified against Moscow printed page 3: PDF stores the end of
   # the first line of 9.1 in a separate overlapping text block.
   if key=='b4m' and n==3:
    if text.strip()=='e, if':continue
    text=text.replace('[9.1] Long Odds: After Step 2, abov\n','[9.1] Long Odds: After Step 2, above, if\n')
   columns[col].append((r.y0,text))
  pieces=[]
  def paragraph(lines,anchor=None):
   text=re.sub(r'\s+',' ','\n'.join(lines).strip().replace('\uf097','•'))
   if text:
    if anchor:pieces.append(f'<p class="rule-case" id="{anchor}">{html.escape(text)}</p>')
    else:pieces.append(f'<p>{html.escape(text)}</p>')
  for col in columns:
   for _,text in sorted(col):
    lines=text.splitlines(); pending=[]; j=0; active_case=None
    while j<len(lines):
     line=lines[j].strip(); m=re.match(r'^\[(\d+\.0)\]\s+([A-Z].*)$',line)
     if m and m.group(1) in page_headings and m.group(1) not in emitted and '..' not in line:
      num=m.group(1); label,anchor=page_headings[num]
      if m.group(2)==label or (m.group(2)=='GENERAL COURSE' and label=='GENERAL COURSE OF PLAY' and j+1<len(lines) and lines[j+1].strip()=='OF PLAY'):
       paragraph(pending,active_case);pending=[];active_case=None
       pieces.append(f'<h3 id="{anchor}">[{html.escape(num)}] {html.escape(label)}</h3>')
       emitted.add(num)
       if m.group(2)!=label:j+=1
       j+=1;continue
     case=re.match(r'^\[(\d+\.\d+(?:\.\d+)*)\]\s+(.+)',line)
     if case and not case.group(1).endswith('.0'):
      paragraph(pending,active_case);pending=[]
      num,label=case.groups();case_counts[num]+=1
      active_case=f"case-{num.replace('.','-')}-{case_counts[num]}"
      case_index.append((num,n,active_case))
     pending.append(lines[j]);j+=1
    paragraph(pending,active_case)
  if emitted!=set(page_headings):raise ValueError(f'Missing headings: {key} page {n}: {set(page_headings)-emitted}')
  pages.append(f'<section id="page-{n}"><h2>Printed page {n}</h2><details><summary>Original page — illustrations and exact layout</summary><img loading="lazy" src="{img}" alt="Original printed page {n}; searchable reading text follows"></details>'+''.join(pieces)+'<p><a href="#top">Return to rule index</a></p></section>')
 nav=' '.join(f'<a href="#page-{n}">{n}</a>' for n in range(1,len(pages)+1))
 rule_links=''.join(f'<li><a href="#{anchor}">[{html.escape(num)}] {html.escape(label)}</a> <span>p. {n}</span></li>' for num,label,n,anchor in rule_index)
 index=f'<nav class="rule-index" aria-label="Printed rule section index"><h2>Rule sections</h2><p>Links jump to the extracted section heading; the printed page facsimile remains authoritative.</p><ul>{rule_links}</ul></nav>'
 case_links=''.join(f'<li><a href="#{anchor}">[{num}] — p. {n}</a></li>' for num,n,anchor in case_index)
 cases=f'<details class="case-index"><summary>Numbered cases ({len(case_index)})</summary><p>Repeated printed numbers are preserved as separate entries. Page images remain authoritative.</p><ul>{case_links}</ul></details>'
 extra='<p><a href="kiev-rules.html">Read base Kiev rules first</a>; expansion overrides apply.</p>' if key=='odessa' else ''
 out=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} — printed rules</title><link rel="stylesheet" href="rulebook.css"></head><body><main id="top"><h1>{title}</h1><p>Source reading edition. Extracted text may contain reading-order or formatting errors; consult the original page for tables, diagrams and exact wording. Printed rules are not a statement of active engine adaptations. Use the in-game Terrain Effects and CRT references for active configuration.</p><p><a href="{source.name}">Original PDF</a></p>{extra}<nav aria-label="Printed pages">Pages: {nav}</nav>{index}{cases}{''.join(pages)}<footer>Source SHA-256: {hashlib.sha256(source.read_bytes()).hexdigest()}</footer></main></body></html>'''
 (ROOT/f'{key}-rules.html').write_text(out,encoding='utf8')
