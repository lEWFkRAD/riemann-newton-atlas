# Provenance, timeline, and proof

This document distinguishes direct evidence from participant reports. Times are America/New_York on August 4, 2026.

## Attribution model

- **Qwen3.8 Max:** primary reasoning and code generation, identified in the Hermes run UI.
- **Hermes Agent:** agent runtime that read the task, planned the work, invoked tools, created files, ran tests, drove browser checks, and wrote the final report.
- **Nous-hosted cloud vision:** visual inspection support during the Hermes run.
- **OpenAI Codex:** benchmark author, live observer/grader author, independent numerical verifier, reviewer, and GitHub packager.
- **@lEWFkRAD:** project direction and publication authority.

## Evidence labels

- **Observed:** recorded by filesystem metadata, Git history, or the sanitized session timeline.
- **Independently verified:** rerun by Codex against the delivered files.
- **Hermes-reported:** stated by Hermes; retained when an independent rerun was unavailable or would require recreating deleted dependencies.

## Timeline

| Time | Event | Evidence |
|---|---|---|
| 20:55 | Hermes/Qwen session opened and read `index.html`. | Observed in the session export. |
| 21:05 | Hermes completed its detailed implementation plan, inspected the preview through Nous vision, and verified Node/Python/browser availability. | Observed in the session export. |
| 21:49 | `index.orig.html` created before implementation writes. | Filesystem timestamp; original retained in this repository. |
| 21:55 | `candidate-core.js` and the Node harness written. | Filesystem timestamps; verification sources retained. |
| 22:03 | Interactive atlas section and renderer written. | Filesystem timestamps from the source workspace. |
| 22:04 | Splice script assembled the final single-file page. | Filesystem timestamp; final page retained. |
| 22:06 | Real-browser verification script written. | Filesystem timestamp; script retained. |
| 22:10 | `NOTES.md` and the 48-case stress suite completed. | Filesystem timestamps; both retained. |
| 22:14 | Final 46,371-byte `index.html` and browser screenshot produced. | Filesystem timestamps; initial commit `9f2ea9a`. |
| 22:15 | Hermes reported 100/100, 48/48, a successful Chrome render, preset switching, and zero console errors. | Hermes-reported; Node portions independently reproduced. |
| 22:18 | Codex independently reran 100/100 and 48/48 and confirmed the frozen harness hash matched. | Independently verified; receipts in `proofs/`. |
| 22:31 | Public artifact package created on GitHub. | Git commit `9f2ea9a`; release `v1.0.0`. |

## Reproducible proof

From the repository root:

```powershell
node verification/harness-node.js
node verification/stress.js
```

Expected results are recorded in [`proofs/visible-harness.txt`](proofs/visible-harness.txt) and [`proofs/stress-suite.txt`](proofs/stress-suite.txt). Integrity hashes are in [`proofs/hashes.txt`](proofs/hashes.txt).

The raw Hermes session export is intentionally not published because its injected memory context contains unrelated private machine and project information. The timeline above contains only sanitized benchmark-relevant facts.

## Known limitation

Hermes explicitly disclosed that dense atlas pixels use capped discrete Newton iteration rather than an RK45 trajectory for every pixel. The exported RK45 API itself passes its visible numerical checks. This distinction is preserved in `NOTES.md`, the README, and the public review record.
