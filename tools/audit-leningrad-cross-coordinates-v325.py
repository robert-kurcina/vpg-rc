#!/usr/bin/env python3
"""Reviewable transcription of German crosses from the bundled ORIGINAL scan.

The observed centers refer to rules/audit/visual/leningrad-east-prussia-scan-crop-v324.png.
This is a manually reviewed, explicitly labeled diagnostic, NOT image recognition or
permission to alter gameplay, and does not derive authority from unrelated images.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
SCAN=ROOT/'maps/source/leningrad-map-scan-current.jpg'
CROP=ROOT/'rules/audit/visual/leningrad-east-prussia-scan-crop-v324.png'
MAP=ROOT/'maps/leningrad.json'
# Cropped original scan visually reviewed at these center positions.
# The original v325 Insterburg inference from game JSON was WRONG.
# The photographed hex grid places the Insterburg cross in column 02, row 11.
# The competing map JSON incorrectly anchors its city at 0311.
OBSERVED=[
 ('0109', 178,311,'cross next to visible 0109 number','high'),
 ('0210', 352,397,'cross beneath visible 0210 number','high'),
 ('0310', 519,500,'cross beneath visible 0310 number','high'),
 ('0211', 320,626,'cross in Insterburg hex, column 02 bottom row in supplied board screenshot','high'),
 ('0411', 670,578,'cross beneath visible 0411 number','high'),
]

def audit():
    source=json.loads(MAP.read_text())
    assert source['sourceGame']=='Target: Leningrad'
    with Image.open(CROP) as im:
        dims=im.size
    assert dims==(1125,759), 'Diagnostic crop changed: re-review cross center points'
    obs=[{'hex':h,'cropPixelCenter':[x,y],'reviewBasis':b,'coordinateConfidence':c} for h,x,y,b,c in OBSERVED]
    assert all(0<=x<dims[0] and 0<=y<dims[1] for _,x,y,_,_ in OBSERVED)
    audit_set={x['cellId'] for x in source['authoredSvgImportAudit']['details']['deployment'] if x['kind']=='cross'}
    # Historical v325 registry as imported, reconstructed from the immutable v327 correction snapshot.
    original=source['v327DeploymentRegistrationCorrection']['originalMarkerSnapshots']
    main_set={c['id'] for c in source['cells'] for m in original.get(c['id'],c.get('tileMarkers',[])) if m['kind']=='cross'}
    scan_set={h for h,*_ in OBSERVED}
    assert len(scan_set)==5 and len(audit_set)==4 and len(main_set)==5
    assert main_set=={'0210','0310','0311','0411','0511'}
    assert audit_set=={'0109','0210','0310','0411'}
    # Detect rather than trust the incorrect legacy city anchor.
    city=[c['id'] for c in source['cells'] if any(m['kind']=='city' and m.get('label')=='Insterburg' for m in original.get(c['id'],c.get('tileMarkers',[])))]
    assert city==['0311'], 'Legacy JSON city anchor changed: re-audit conflict'
    def delta(candidates):return {'scanOnly':sorted(scan_set-candidates),'candidateOnly':sorted(candidates-scan_set),'shared':sorted(scan_set&candidates)}
    return {
      'schemaVersion':2,'scenario':'leningrad','status':'user-screenshot-correction-pending-registration-fix',
      'sourceScan':str(SCAN.relative_to(ROOT)),'sourceScanSha256':hashlib.sha256(SCAN.read_bytes()).hexdigest(),
      'diagnosticCrop':str(CROP.relative_to(ROOT)),'diagnosticCropSha256':hashlib.sha256(CROP.read_bytes()).hexdigest(),
      'coordinateFrame':'pixels relative to unmodified v324 scan-derived diagnostic crop',
      'userSuppliedReferences':[{'path':str(f.relative_to(ROOT)), 'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in [ROOT/'rules/audit/visual/leningrad-user-board-scan-v326.png',ROOT/'rules/audit/visual/leningrad-user-overlay-comparison-v326.png']],
      'reviewedBlackCrosses':obs,'reviewedCandidateHexes':sorted(scan_set),
      'temporarySvgRegistry':sorted(audit_set),'mainSvgRegistry':sorted(main_set),
      'temporaryComparison':delta(audit_set),'mainComparison':delta(main_set),
      'sovietStarCorrection':{'boardScanHex':'0510','legacyConfusedWith':'0511','mapStarAt0510':any(c['id']=='0510' and any(m['kind']=='star' for m in c.get('tileMarkers',[])) for c in source['cells'])},
      'legacyCityRegistrationConflict':{'city':'Insterburg','scanHex':'0211','mapJsonHex':city[0]},
      'uncertainties':['Source SVG and map JSON registrations have not been rewritten or graph-certified','Counter assignments and all other deployments require independent verification'],
      'sourcePolicy':'No historical setup activation; original SVG, printed scan, map JSON, and gameplay untouched',
      'historicalSetupAuthorized':False}

if __name__=='__main__':
    output=ROOT/'rules/audit/leningrad-cross-coordinate-review-v325.json'
    output.write_text(json.dumps(audit(),indent=2)+'\n')
    print(output.relative_to(ROOT))
