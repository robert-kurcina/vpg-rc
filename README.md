# vpg_russian_campaign
This is a vibe-coded implementation of Victory Point Games' Russian Campaign by Frank Chadwick.

## Development status

Repository bootstrap for v701 / checkpoint 479. The complete game has not yet been imported. See [PLAN.md](PLAN.md) for approved release decisions and remaining work.

## Import the baseline locally

Obtain the existing `hex_wargame_v701_CHECKPOINT_479_RESUMABLE_ACCEPTANCE.zip` distribution and run (Python 3.11+):

```sh
python3 scripts/import-v701.py /path/to/hex_wargame_v701_CHECKPOINT_479_RESUMABLE_ACCEPTANCE.zip
python3 scripts/import-v701.py /path/to/hex_wargame_v701_CHECKPOINT_479_RESUMABLE_ACCEPTANCE.zip --apply
```

The first command is a dry run; the second extracts into the checkout without committing or pushing. The exact baseline README and PLAN are retained in docs/baseline-v701/. Existing conflicting files are rejected. Review third-party redistribution rights before staging or publishing any supplied maps, artwork, rules or references; the repository license covers only material for which the licensor has rights.

After a complete local import, run `python3 serve.py` and open http://localhost:8765/. GitHub Pages is not yet configured or verified.
