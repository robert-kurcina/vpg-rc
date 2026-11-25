# Resumable qualification runner

From the project root, repeat the identical command after any interruption (use distinct paths for each job):

```sh
mkdir -p runs
CHECKPOINT_PATH=runs/kiev-standard.checkpoint.json AUDIT_PATH=runs/kiev-standard.json JOURNAL_PATH=runs/kiev-standard.journal.json node tests/historical-operational-qualification-v644.test.js kiev standard 476 5000 campaign baseline greedy same 0 0
```

The runner saves every ten actions, at turn changes and at terminal state. A checkpoint is a local, trusted research file; do not edit it. Do not run multiple writers against the same path. Use a new path for a different seed or configuration. The source-bound save is validated by the engine on resume, and the trace actions must match the restored journal. Reporting metadata is not separately authenticated. A terminal result requires successful validation, including exact restoration. The batch wrapper remains unchanged; use the individual runner command for interrupted jobs.

The included 12-action regression compares the uninterrupted report and journal against a run restored from action 10, ignoring elapsed time. The four full campaigns resumed successfully, but were not also rerun uninterrupted.
