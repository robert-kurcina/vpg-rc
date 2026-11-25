#!/usr/bin/env python3
"""Extract exactly the five user-authored vector counter groups; no redraw.

The large original SVG is preserved as supplied (including five raster references).
Only the five vector groups are converted into directly parameterized templates.
This script fails closed when the Inkscape layer names change.
"""
from pathlib import Path
import argparse, base64, copy, hashlib, json, re
from lxml import etree as ET

SVG = 'http://www.w3.org/2000/svg'
INK = 'http://www.inkscape.org/namespaces/inkscape'
LABEL = '{'+INK+'}label'
FIELDS={'unit_color_first':'primary','unit_color_second':'secondary',
        'status_reduced':'status_reduced','status_undamaged':'status_undamaged','status_damaged':'status_damaged',
        'unit_size':'size','unit_id':'unit_id','attr_offense':'offense','attr_defense':'defense',
        'attr_movement':'movement','dash':'dash','dash-left':'dash_left','dash-right':'dash_right'}
NATO=('infantry','armor','mechanized','shock','artillery','cavalry','support','depot')
TEMPLATES={'army-2':'g365','army-3':'g430','stuka':'g329','air':'g399','fleet':'g385'}
# Typography is a designated browser-portable rendering profile. The source SVG is
# never rewritten. Its original position, size, tracking, alignment and rotation
# stay intact. Only the font choice and narrow-letter horizontal scale change.
TYPOGRAPHY={
    'profile': 'counter-portable-sans-v1',
    'font_stack': 'Arial,Helvetica,Arimo,"Liberation Sans",sans-serif',
    'heavy_font_stack': '"Arial Black",Arial,Helvetica,Arimo,"Liberation Sans",sans-serif',
    'regular_weight': '400',
    'heavy_weight': '900',
    'narrow_scale_x': 0.78,
}

def getstyle(el,key):
    for token in (el.get('style') or '').split(';'):
        if ':' in token:
            a,b=token.split(':',1)
            if a.strip()==key:return b.strip()
    return ''

def apply_portable_typeface(text_el):
    """Retype an extracted counter label, keeping its own SVG coordinates.

    Source Arial Black -> heavy sans; source Arial Narrow -> ordinary sans
    geometrically compressed around the label's original x-anchor, *before*
    any pre-existing SVG rotation/translation. SVG tspan styles are overridden
    too, otherwise tspan font-family and fill silently defeat parent styles.
    """
    tspans=list(text_el.iter('{'+SVG+'}tspan'))
    family=' '.join(getstyle(el,'font-family') for el in [text_el]+tspans).lower()
    if 'arial narrow' in family:kind='narrow'
    elif 'arial black' in family:kind='heavy'
    else:kind='regular'
    font=TYPOGRAPHY['heavy_font_stack'] if kind=='heavy' else TYPOGRAPHY['font_stack']
    weight=TYPOGRAPHY['heavy_weight'] if kind=='heavy' else TYPOGRAPHY['regular_weight']
    for el in [text_el]+tspans:
        setstyle(el,'font-family',font)
        setstyle(el,'font-weight',weight)
        setstyle(el,'font-stretch','normal')
        # Inkscape-specific font declarations must not suggest the source family
        # is available in the browser when it has deliberately been replaced.
        style=el.get('style') or ''
        style=';'.join(t for t in style.split(';') if not t.strip().startswith('-inkscape-font-specification:'))
        el.set('style',style)
    if kind=='narrow':
        factor=TYPOGRAPHY['narrow_scale_x']
        # x is in the local text coordinate system; apply before the authored
        # transform. This preserves the text anchor even for a rotated unit ID.
        anchor=tspans[0].get('x') if tspans and tspans[0].get('x') is not None else text_el.get('x')
        if anchor is None:raise ValueError('Condensed label without an x anchor')
        x=float(anchor)
        original=(text_el.get('transform') or '').strip()
        additional=f'translate({x*(1-factor):.7f},0) scale({factor:.7f},1)'
        text_el.set('transform',(original+' '+additional).strip())
    text_el.set('data-counter-typography',kind)
    return kind


def setstyle(el,key,val):
    d={}
    for s in (el.get('style') or '').split(';'):
        if ':' in s:
            a,b=s.split(':',1); d[a.strip()]=b.strip()
    d[key]=val
    el.set('style',';'.join(f'{k}:{v}' for k,v in d.items()))

def main(src,dest):
    # The engine owns the designated portable typography profile, not a CSS
    # override in one viewer. Reload this file on every counter import.
    profile_path=dest/'assets/official-counters/typography-profile.json'
    if not profile_path.exists():raise FileNotFoundError('Missing counter typography profile: '+str(profile_path))
    configured=json.loads(profile_path.read_text())
    if set(configured)!=set(TYPOGRAPHY):raise ValueError('Invalid counter typography profile keys')
    if not (0.55<=float(configured['narrow_scale_x'])<=1.0):raise ValueError('narrow_scale_x must be between 0.55 and 1.0')
    if not all(isinstance(configured[k],str) and configured[k] for k in ('font_stack','heavy_font_stack','regular_weight','heavy_weight','profile')):raise ValueError('Invalid font profile values')
    TYPOGRAPHY.update(configured)
    tree=ET.parse(str(src)); root=tree.getroot()
    asset={}; stats={}
    for kind,id in TEMPLATES.items():
        found=root.xpath(f'.//*[@id="{id}"]')
        if len(found)!=1: raise ValueError(f'Expected exactly one template {id}: {len(found)}')
        g=copy.deepcopy(found[0]); tree_group=found[0]
        body=[e for e in tree_group.iter() if e.get(LABEL)=='unit_color_first']
        if len(body)!=1: raise ValueError('Missing unique body rectangle '+kind)
        # All original templates use a translated 50x50 base rectangle.
        rect=body[0]; x,y=float(rect.get('x')),float(rect.get('y'))
        if abs(float(rect.get('width'))-50)>.01: raise ValueError('unexpected counter size')
        def translate(s):
            match=re.fullmatch(r'translate\(\s*([-\d.eE]+)\s*[, ]\s*([-\d.eE]+)\s*\)',s or '')
            if not match: raise ValueError('Cannot normalize non-translation '+str(s))
            return tuple(map(float,match.groups()))
        dx,dy=translate(tree_group.get('transform'))
        bx,by=translate(rect.get('transform'))
        tx,ty=-(dx+bx+x),-(dy+by+y)
        count_symbols=0; roles=[]; typography=[]
        for e in g.iter():
            label=e.get(LABEL)
            for attribute in list(e.attrib):
                if attribute.startswith('{'+INK+'}') or attribute=='id' or attribute.startswith('{http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd}'):
                    del e.attrib[attribute]
            if label == "nato_symbol": e.set("data-role","nato_symbol")
            if label in FIELDS:
                role=FIELDS[label]
                # The fleet's damaged face contains the literal DAMAGED legend;
                # it is not the normal numeric power field.
                if label=='attr_defense' and any(p.get('data-role')=='status_damaged' for p in e.iterancestors()):role='damage_text'
                e.set('data-role',role); roles.append(role)
                if role in ('primary','secondary'):
                    setstyle(e,'fill','@@'+role+'@@')
                elif role.startswith('status_'):
                    setstyle(e,'display','@@'+role+'@@')
                    if role=='status_reduced':
                        # Preserve the authored damage-strip shape; the runtime
                        # supplies white for red counter fields and red otherwise.
                        setstyle(e,'fill','@@color_reduced_bar@@')
                elif e.tag=='{'+SVG+'}text':
                    # Preserve the original text layout, transforms and color; only swap its content.
                    text_nodes=list(e.iter('{'+SVG+'}tspan'))
                    if text_nodes:
                        text_nodes[0].text='@@'+role+'@@'
                        for other in text_nodes[1:]:other.text=''
                    else:
                        e.text='@@'+role+'@@'
                    if role in ('offense','defense','movement','size','unit_id','damage_text'):
                        # Child tspans have their own fill declarations. Set both
                        # levels so custom black/white digit colors actually work.
                        for text_node in [e]+list(e.iter('{'+SVG+'}tspan')):
                            setstyle(text_node,'fill','@@color_'+role+'@@')
            if label in NATO and e.tag=='{'+SVG+'}g' and e.getparent() is not None and e.getparent().get('data-role')=='nato_symbol':
                e.set('data-nato',label)
                setstyle(e,'display','@@nato_'+label+'@@')
                count_symbols+=1
            if e.tag=='{'+SVG+'}text':
                typography.append(apply_portable_typeface(e))
            # Some strings need no data-role but must preserve exact SVG geometry.
        if kind.startswith('army') and count_symbols!=8: raise ValueError(f'{kind}: expected eight NATO alternatives, got {count_symbols}')
        outer=ET.Element('{'+SVG+'}g',nsmap={None:SVG},attrib={'transform':f'translate({tx:.7f},{ty:.7f})'})
        outer.append(g)
        ET.cleanup_namespaces(outer)
        string=ET.tostring(outer,encoding='unicode')
        # Use a single JS-substitution path; do not inline source reference raster images.
        if 'image' in roles: raise ValueError('Reference sheet leaked into a vector')
        asset[kind]=string
        stats[kind]={'source_group':id,'roles':sorted(set(roles)), 'nato_alternatives':count_symbols,'bytes':len(string),'body_offset':[round(tx,7),round(ty,7)],'text_roles':typography}
    path=dest/'assets/official-counters';path.mkdir(parents=True,exist_ok=True)
    (path/'source-counters.svg').write_bytes(src.read_bytes())
    # Keep all five official counter reference sheets accessible as their
    # original embedded PNG byte streams. No OCR or image generation is used.
    references=path/'reference-sheets';references.mkdir(parents=True,exist_ok=True)
    expected_titles=('The Arduous Beginning (front)', 'Battle for Moscow (reverse)',
                     'Objective Kiev (front)', 'Target: Leningrad (front)',
                     'Target: Leningrad (reverse)')
    sheets=root.xpath('./s:g[@id="layer1"]/s:image',namespaces={'s':SVG})
    if len(sheets)!=len(expected_titles):raise ValueError('Expected 5 original source reference images')
    records=[]
    for i,(e,title) in enumerate(zip(sheets,expected_titles),1):
        uri=e.get('{http://www.w3.org/1999/xlink}href') or e.get('href')
        if not uri or not uri.startswith('data:image/png;base64,'):raise ValueError('Reference is not an embedded PNG')
        content=base64.b64decode(uri.split(',',1)[1]);name=f'sheet-{i}.png';(references/name).write_bytes(content)
        records.append({'file':name,'source_svg_element':e.get('id'),'title_as_printed':title,
             'sha256':hashlib.sha256(content).hexdigest(),'source_x':e.get('x'),'source_y':e.get('y'),
             'source_width':e.get('width'),'source_height':e.get('height')})
    (references/'INDEX.json').write_text(json.dumps({'source_layer':'counter-sheets',
      'sheets':records,'note':'Reference screenshots extracted losslessly. Counter roster, combat values, nationality and per-scenario rules have NOT been transcribed or certified.'},indent=2)+'\n')
    (path/'source-manifest.json').write_text(json.dumps({'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),
      'source_file':'source-counters.svg','source_reference_layer':'counter-sheets','typography':TYPOGRAPHY,'templates':stats,
      'note':'Five authored vector counter groups only. Raster reference-sheet layer retained, not emitted in runtime sprites.'},indent=2)+'\n')
    js='/* Generated exclusively from assets/official-counters/source-counters.svg by scripts/import-official-counters.py. */\n'
    js+='(function(root){const t='+json.dumps(asset,ensure_ascii=False,separators=(',',':'))+';'
    js+='if(typeof module==="object"&&module.exports)module.exports=t;root.WargameOfficialCounters=t;})(typeof globalThis!=="undefined"?globalThis:this);\n'
    (dest/'core/official_counter_templates.js').write_text(js)
    print(json.dumps(stats,indent=2))

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('svg',type=Path);a.add_argument('engine',type=Path);p=a.parse_args()
    main(p.svg,p.engine)
