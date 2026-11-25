#!/usr/bin/env python3
"""Create alternate terrain bitmap tiles for v439. Never rewrite the original raster assets.

Map each original terrain's CIELAB mean toward an opaque target color, while
retaining local lightness and chroma differences (topographic/foliage/water details).
The alpha mask, image dimensions, and authored terrain classification are unchanged.
"""
from pathlib import Path
import json
import hashlib
import numpy as np
from PIL import Image
from skimage.color import rgb2lab, lab2rgb

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT/'supplied_assets'/'flat'
TARGETS = {'open': '#dcd4c9', 'forest': '#727f61', 'swamp': '#616f6f'}
SCALE = {'open': (.86, .59), 'forest': (.83, .72), 'swamp': (.85, .64)}

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def run():
    result = {}
    for terrain, hexc in TARGETS.items():
        source = SRC/f'terrain-{terrain}.png'
        output = SRC/f'terrain-{terrain}-v439.png'
        rgba = np.asarray(Image.open(source).convert('RGBA'), dtype=np.uint8)
        alpha = rgba[:,:,3].copy()
        mask = alpha > 250
        rgb = rgba[:,:,:3].astype(np.float64)/255
        lab = rgb2lab(rgb)
        base = lab[mask].mean(axis=0)
        target = np.array([int(hexc[i:i+2],16) for i in (1,3,5)], dtype=np.float64).reshape(1,1,3)/255
        tgt_lab = rgb2lab(target)[0,0]
        light_scale, chroma_scale = SCALE[terrain]
        transformed = lab.copy()
        transformed[:,:,0] = tgt_lab[0] + (lab[:,:,0] - base[0])*light_scale
        transformed[:,:,1:] = tgt_lab[1:] + (lab[:,:,1:] - base[1:])*chroma_scale
        out_rgb = (np.clip(lab2rgb(transformed),0,1)*255).round().astype(np.uint8)
        out_rgba = np.dstack([out_rgb,alpha])
        # RGB values under zero-alpha are cleared for deterministic raster output.
        out_rgba[alpha==0,:3]=0
        Image.fromarray(out_rgba, mode='RGBA').save(output, optimize=True)
        reread = np.asarray(Image.open(output).convert('RGBA'))
        assert reread.shape==rgba.shape, 'unexpected dimensions'
        assert np.array_equal(reread[:,:,3], rgba[:,:,3]), 'alpha mask altered'
        assert not np.array_equal(reread[:,:,:3],rgba[:,:,:3]), 'tile not recolored'
        result[terrain] = {
            'input':str(source.relative_to(ROOT)), 'output':str(output.relative_to(ROOT)),
            'target':hexc+'ff', 'sourceSha256':sha(source),'variantSha256':sha(output),
            'originalOpaqueRGBMean':np.round(rgba[:,:,:3][mask].mean(axis=0),1).tolist(),
            'variantOpaqueRGBMean':np.round(reread[:,:,:3][mask].mean(axis=0),1).tolist(),
            'sourceDimensions':list(Image.open(source).size), 'alphaUnchanged':True,
            'labLightnessDetailRetention':light_scale,'labChromaDetailRetention':chroma_scale,
        }
    path=ROOT/'rules/audit/terrain-bitmap-recolor-v439.json'
    path.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:{'variantOpaqueRGBMean':v['variantOpaqueRGBMean'],'variantSha256':v['variantSha256']} for k,v in result.items()},indent=2))

if __name__ == '__main__': run()
