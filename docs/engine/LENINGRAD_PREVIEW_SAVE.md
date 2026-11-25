# Leningrad movement save and isolated controller restoration — non-production preview (v354)

`core/leningrad_preview_save.js` and `core/leningrad_preview_controller.js` provide a **Node-only, opt-in** version-1 save and restore path for the bounded Leningrad movement pilot. It is **not** connected to browser/local storage, `core/session.js`, historical setup, combat, a fully playable scenario, or canonical-coordinate activation.

## API and responsibilities

- `serialize(snapshot, context, {namespace='legacy-physical', allowUnmarkedLegacy=false})` creates a portable JSON object. A raw pilot snapshot is unmarked: callers must explicitly opt into marking legacy coordinates with `allowUnmarkedLegacy:true`. The output and every Undo entry are then namespace-marked.
- `restore(envelope, context, {targetNamespace=null})` verifies format/version, SHA-256 content integrity, *exact* board/movement/phase/projection fingerprints, phase metadata, and supported snapshot fields. Returns `{scenarioId, namespace, snapshot}`. A different target namespace invokes the existing reversible v352 translator.
- `undoPreview(envelope, context)` validates the supplied save, rewinds one Undo entry, and creates a **new signed preview envelope**. It is a history restoration aid, not a full action log or combat replay.
- `PreviewController.restore(envelope, context)` verifies the versioned envelope and then rehydrates an **isolated** `WargameHistoricalMovementLifecycle` controller. It accepts **only** `legacy-physical` saves; canonical-preview saves are rejected here, not silently activated.
- `PreviewController.save(controller, context)` serializes a rehydrated controller snapshot back to a versioned physical-ID envelope. It does not write a browser save.
- `context` must explicitly contain `{map, movementProfile, phaseConfig, projectionRecord}`. The app supplies these known project inputs; never trust them from the save itself.

For example:

```js
const Save=require('./core/leningrad_preview_save');
const context={map,movementProfile,phaseConfig,projectionRecord};
const envelope=Save.serialize(pilot.snapshot(),context,{allowUnmarkedLegacy:true});
const bytes=JSON.stringify(envelope);
const loaded=Save.restore(JSON.parse(bytes),context);
const candidate=Save.restore(envelope,context,{targetNamespace:'canonical-preview'});
const prior=Save.undoPreview(envelope,context);
const Controller=require('./core/leningrad_preview_controller');
const resumed=Controller.restore(envelope,context); // isolated movement pilot
const rewind=resumed.undo(); // Undo supported after movement-phase finish
const nextSave=Controller.save(rewind.session,context);
```

## Guarantees and limits

- All content is deterministic JSON using sorted keys for hashing. SHA-256 detects accidental corruption but **is not authentication**: someone who can edit a file can recompute its checksum.
- Invalid or future envelope fields, mixed coordinate namespaces, unsupported nested state fields, unknown hexes, actor/cursor phase inconsistencies, invalid completion transitions, and inconsistent Undo unit rosters are rejected.
- Both namespace directions require the error-free **preview** projection; its historical coordinate names remain *uncertified*.
- Fingerprints bind to the exact supplied files. Any legitimate source-board or rules edit invalidates previously emitted preview saves until an explicit compatibility migration is defined.
- The controller adapter restores executable **movement/finish/Undo** only. After finishing a movement phase, both `move()` and `finish()` remain blocked in the unsupported next phase until Undo returns the controller to movement.
- Controller restoration additionally checks chronological used-unit progression, per-move unit location changes, unchanged non-hex state and saved roster. Earlier **paths are not recorded** in the snapshot, so historical path legality cannot be re-proven from this format. The SHA-256 checksum is not authentication.
- Combat actions, game-wide replay, user identity, persistence storage, historical save import, and production canonical activation are outside this scope.

Regressions: `node tests/leningrad-versioned-preview-save-v353.test.js` and `node tests/leningrad-preview-controller-restore-v354.test.js`.
