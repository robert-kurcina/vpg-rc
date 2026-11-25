"""Source-pinned Support counter image fixture for offline Chromium screenshots.

The project's live game pages serve PNGs using normal relative HTTP paths.
Chromium's test harness instead opens about:blank via set_content(), where those
relative URLs cannot resolve. This utility gives that *test page* the exact
source PNG bytes after validating each original relative path against the real
package tree. Missing/wrong paths are hard failures, never silent substitutions.
"""
from __future__ import annotations
import base64
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parents[1]
ART_DIR = (ROOT / 'assets' / 'support-counters').resolve()
SELECTOR = '[data-support-face] img, [data-support-fleet] img'


def hydrate_and_verify(page, document: Path, expected: int | None = None) -> int:
    """Resolve actual image paths and decode all current Air/Fleet thumbnails."""
    document = document.resolve()
    assert document.is_file() and document.is_relative_to(ROOT), document
    images = page.eval_on_selector_all(SELECTOR, "els => els.map(e => e.getAttribute('src'))")
    if expected is not None:
        assert len(images) == expected, ('counter images expected', expected, images)
    assert images, 'No source Support counter images in game window'
    replacements = {}
    for item in page.eval_on_selector_all(SELECTOR, "els => els.map(e => ({src:e.getAttribute('src'),face:e.dataset.supportFaceId||''}))"):
        src, face = item['src'], item['face']
        if src.startswith('data:image/png;base64,'):
            # Offline-safe bundle must be byte-identical to the original photo crop.
            assert face, ('missing source face provenance', item)
            source = ART_DIR / (face + '.png')
            assert source.is_file(), ('source Support counter missing', source)
            assert base64.b64decode(src.split(',', 1)[1]) == source.read_bytes(), ('counter art differs from printed source', face)
            continue
        assert src and src.startswith('../../../assets/support-counters/'), ('bad relative source counter path', src)
        parsed = urlparse(src)
        assert not parsed.scheme and not parsed.netloc and not parsed.query and not parsed.fragment, src
        absolute = (document.parent / unquote(parsed.path)).resolve()
        assert absolute.is_relative_to(ART_DIR) and absolute.is_file(), ('missing source counter PNG', src, absolute)
        assert absolute.suffix.lower() == '.png', absolute
        data = absolute.read_bytes()
        assert data.startswith(b'\x89PNG\r\n\x1a\n'), ('bad PNG bytes', absolute)
        replacements[src] = 'data:image/png;base64,' + base64.b64encode(data).decode('ascii')
    loaded = page.evaluate("""async (urls) => {
        const images = [...document.querySelectorAll('[data-support-face] img,[data-support-fleet] img')];
        for (const img of images) {
            const src = img.getAttribute('src');
            if (src in urls) img.src = urls[src];
        }
        await Promise.all(images.map(img => img.decode()));
        return images.map(img => ({ok:img.complete && img.naturalWidth>0 && img.naturalHeight>0,
                                    width:img.naturalWidth,height:img.naturalHeight, alt:img.alt}));
    }""", replacements)
    assert len(loaded) == len(images) and all(item['ok'] for item in loaded), ('broken Support images', loaded)
    return len(loaded)
