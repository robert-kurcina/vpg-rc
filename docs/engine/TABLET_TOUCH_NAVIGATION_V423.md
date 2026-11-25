# Responsive touch navigation — v423

## Policy and implementation

Touching the map with one finger leaves counter and hex taps available. Two contacts are required to pan the map viewport. The shared controller tracks their **midpoint** from native `touchstart` and `touchmove` events and subtracts the midpoint delta from `scrollLeft`/`scrollTop`. Gestures prevent native scrolling and pinch zoom only inside the map viewport. `touch-action:none` applies to the map and its SVG descendants, not the rest of the application. Reserve-pool controls remain independently scrollable and tappable.

The controller uses the existing map DOM; there is no duplicate rendering, map scaling parameter, rule dispatch or save mutation. It creates an accessible first-touch reminder (`role=status`) shown once per browser session; the hint uses sessionStorage when available and a local in-memory guard if not. Mouse, keyboard, and native SVG counter click handlers remain untouched apart from ignoring touch pointers in the existing optional mouse drag handler. A captured post-gesture click guard prevents stray synthetic click actions; an intentional new one-finger touch clears that guard immediately.

The responsive `map-scroll` element owns overflow; an inner `stage` scales with browser width and zoom, while original SVG viewBox geometry and game counter transformations remain source-correct. The shared `map-navigation` toolbar implements +, −, and Fit (100–300%, quarter-step increments), with 150% default on coarse-pointer devices. These are presentation-only controls and do not enter the game-save model.

## Coverage

- `tests/tablet-responsive-browser-v423.py`: genuine Chromium + iPad touch/viewport emulation, 820×1180 and 1180×820, B4M/Arduous/Leningrad, zoom, Settings visibility, counter SVG presence, scrolling geometry and absence of JS errors.
- `tests/two-finger-pan-browser-v423.py`: CDP-dispatched native multi-contact gestures, first-touch reminder, one-finger pan rejection, 2D two-finger pan, fresh single-tap counter selection, reminder nonrepetition, and absence of browser exceptions.
- `tests/two-finger-map-viewer-v423.py`: five-map viewer real shared SVG rendering, iPad gesture, 150% touch zoom, and preservation of horizontal scroll after changing maps.
- Protected hash comparison confirms all five approved SVGs and PNGs, core rules engine, shared CRT and source counter rendering unchanged.

## Limitations

The touch acceptance uses desktop Chromium emulating touch and tablet dimensions, not physical Mobile Safari. Full manual-play campaign certification is not implied. Touch panning does not modify gameplay state; alternative direct pointer dragging remains available on desktop mouse devices.
