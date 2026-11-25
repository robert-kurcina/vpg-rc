"""Shared browser-test fixture: locally serve the authentic project image bytes.

Chromium runs isolated DOM tests without a hosted URL in the CI environment.
This fixture stubs only transport: JSON and binary bytes come directly from
project files; image embedding and all map rendering run in the real browser.
"""
from pathlib import Path
import base64


def asset_lookup(root: Path):
    assets = {}
    directory = root / 'supplied_assets' / 'flat'
    for file in sorted(directory.glob('terrain-*.png')) + [
            directory / 'fortification-overlay.svg', directory / 'city-hex-highlight.svg']:
        assert file.is_file(), file
        rel = '../../../' + file.relative_to(root).as_posix()
        assets[rel] = {
            'base64': base64.b64encode(file.read_bytes()).decode('ascii'),
            'mime': 'image/png' if file.suffix == '.png' else 'image/svg+xml',
        }
    return assets


def install_fetch(page, json_files, root: Path):
    # Binary bytes in base64 are an injection of the actual supplied assets,
    # *not* an alternate renderer or a synthetic map representation.
    page.evaluate('''payload => {
      const files=payload.files, assets=payload.assets;
      window.__nativeTestFiles=files;
      window.fetch=async url=>{
        const key=String(url);
        if(Object.prototype.hasOwnProperty.call(files,key))
          return {ok:true,json:async()=>structuredClone(files[key])};
        if(Object.prototype.hasOwnProperty.call(assets,key)){
          const entry=assets[key];
          return {ok:true,blob:async()=>new Blob([
            Uint8Array.from(atob(entry.base64),s=>s.charCodeAt(0))
          ],{type:entry.mime})};
        }
        return {ok:false,status:404};
      };
    }''', {'files': json_files, 'assets': asset_lookup(root)})
