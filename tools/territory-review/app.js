/* Browser controller for a purely diagnostic, scenario-configured region review.
 * Uses the approved SVG map export as an image; SVG overlays are hit regions,
 * not alternative terrain tiles or a second game renderer. */
(async function(){'use strict';
 const byId=x=>document.getElementById(x),NS='http://www.w3.org/2000/svg';
 const layer=byId('hex-layer'),counts=byId('counts'),selection=byId('selection'),message=byId('message');
 const cells=new Map(),shapes=new Map();
 let engine,review,selected=null;
 const fetchJSON=async url=>{const res=await fetch(url);if(!res.ok)throw Error(`Unable to load source: ${url} (${res.status})`);return res.json()};
 const explain=x=>({romanian:'Romanian territory (draft)',outside:'Outside Romania (draft)',unreviewed:'Unreviewed'})[x];
 const say=(s)=>{message.textContent=s};
 const active=()=>document.querySelector('input[name="label"]:checked')?.value;
 function render(){
  const s=review.stats();
  counts.textContent=`${s.total} map hexes · ${s.romanian} Romanian (${s.sourcePositive} source-pinned) · `+
   `${s.outside} outside (${s.sourceNegative} source-pinned) · ${s.unreviewed} unreviewed · ${s.manual} manual proposals · `+
   `${review.evidenceStats().cited} citations attached (${review.evidenceStats().uncited} uncited)`;
  for(const [id,el] of shapes){
   const c=review.classification(id);
   el.dataset.label=c.value;el.dataset.evidence=c.evidence;el.dataset.selected=String(id===selected);
   el.setAttribute('aria-label',`Hex ${id}: ${explain(c.value)}, ${c.evidence}`);
   el.querySelector('title').textContent=`${id} · ${explain(c.value)} · ${c.evidence}`;
  }
  if(selected){const x=review.classification(selected);
   selection.textContent=`Hex ${selected}: ${explain(x.value)}. Evidence: ${x.evidence}. `+
    (x.evidence.startsWith('printed')?'This original setup marker is immutable.':'Select a label and click the hex to change it.');
   byId('source-citation').value=review.citation(selected)||'';
  }
  if(!selected)byId('source-citation').value='';
  if(s.unreviewed===0) say('All hexes classified as a manual DRAFT. Independent source review is still required; gameplay remains disabled.');
 }
 function clickHex(id){
  selected=id;
  try{review=review.set(id,active());if(review.classification(id).evidence==='manual-draft')say(`Manually proposed ${explain(active())} at ${id}.`);else say('');}
  catch(e){say(e.message)}
  render();
 }
 function polygon(cell){
  const [x,y]=cell.pixelCenter;const el=document.createElementNS(NS,'polygon');
  // Same symmetric flat-top hex geometry as the approved renderer's clip path.
  const p=[[37.53,0],[18.76,33.26],[-18.76,33.26],[-37.53,0],[-18.76,-33.26],[18.76,-33.26]];
  el.setAttribute('points',p.map(([dx,dy])=>`${(x+dx).toFixed(2)},${(y+dy).toFixed(2)}`).join(' '));
  el.dataset.hex=cell.id;el.setAttribute('tabindex','0');el.setAttribute('role','button');
  el.appendChild(document.createElementNS(NS,'title'));
  el.addEventListener('click',()=>clickHex(cell.id));
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();clickHex(cell.id)}});
  return el;
 }
 function download(data){
  const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='kiev-romania-territory-review-DRAFT.json';link.click();
  URL.revokeObjectURL(url);
 }
 try{
  const config=await fetchJSON('kiev.json');
  if(config.candidateOnly!==true)throw Error('Territory review must remain diagnostic-only');
  const [map,setup]=await Promise.all([fetchJSON(config.map),fetchJSON(config.setup)]);
  engine=WargameHistoricalTerritoryReview.create({map,setup,config});review=engine.create();
  for(const cell of map.cells){cells.set(cell.id,cell);const e=polygon(cell);shapes.set(cell.id,e);layer.appendChild(e)}
  byId('provenance').textContent=JSON.stringify(engine.source,null,2);render();
  byId('next-unreviewed').addEventListener('click',()=>{
   const unknown=engine.ids.filter(id=>review.classification(id).value==='unreviewed');
   if(!unknown.length){say('No unreviewed cells remain. This is still only a draft.');return;}
   // Proximity is a navigation convenience, NEVER an inferred national boundary.
   const anchor=engine.positive.map(id=>cells.get(id).pixelCenter);
   const distance=id=>Math.min(...anchor.map(([x,y])=>{
    const [cx,cy]=cells.get(id).pixelCenter;return (cx-x)**2+(cy-y)**2;
   }));
   unknown.sort((a,b)=>distance(a)-distance(b)||a.localeCompare(b));
   selected=unknown[0];render();shapes.get(selected).focus();
   shapes.get(selected).scrollIntoView({block:'nearest',inline:'nearest'});
   say('Unreviewed hex '+selected+' located by proximity to source-anchored setup positions. This does not establish national territory.');
  });
  byId('cite').addEventListener('click',()=>{
   try{
    if(!selected)throw Error('Select and manually label a hex first');
    review=review.cite(selected,byId('source-citation').value);render();
    say('Draft source locator attached to '+selected+'. It is not independently verified.');
   }catch(e){say(e.message)}
  });
  byId('clear-citation').addEventListener('click',()=>{
   try{
    if(!selected)throw Error('Select a manually labeled hex first');
    review=review.clearCitation(selected);render();say('Draft source locator cleared from '+selected);
   }catch(e){say(e.message)}
  });
  byId('save').addEventListener('click',()=>{download(review.exportDraft());say('Exported a checksum-checked DRAFT. It cannot authorize gameplay.')});
  byId('reset').addEventListener('click',()=>{review=engine.create();selected=null;say('Manual labels cleared; original source markers preserved.');render()});
  byId('load').addEventListener('change',async e=>{
   try{const file=e.target.files?.[0];if(!file)return;
    const saved=JSON.parse(await file.text());const candidate=engine.restore(saved);
    review=candidate;selected=null;render();say('Source-matched DRAFT restored. Game authorization remains disabled.');
   }catch(err){say(`Import rejected: ${err.message}`)}finally{e.target.value=''}
  });
 }catch(err){counts.textContent='Source review unavailable';say(err.message)}
})();
