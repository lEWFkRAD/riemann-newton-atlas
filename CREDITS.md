# Credits

## Project

- **Project direction and publication:** [@lEWFkRAD](https://github.com/lEWFkRAD)
- **Primary reasoning and code generation:** Qwen3.8 Max, as identified in the run UI
- **Agent runtime, planning, tool use, filesystem work, and browser orchestration:** Hermes Agent
- **Benchmark design, live grading, independent verification, and repository packaging:** OpenAI Codex
- **Visual verification support:** Nous-hosted cloud vision model

Qwen supplied the mathematical and coding intelligence inside the run. Hermes supplied the agent loop around it: reading the assignment, forming the plan, invoking tools, creating and editing files, running checks, driving browser verification, and reporting limitations.

## Mathematical foundations

The project builds on established mathematical and numerical ideas, including:

- Isaac Newton's root-finding method;
- the Aberth–Ehrlich simultaneous polynomial-root method;
- the Dormand–Prince embedded Runge–Kutta method;
- Claude Shannon's entropy;
- box-counting dimension and marching squares.

These names credit the mathematical lineage of the techniques. No endorsement or direct participation by the named researchers or their estates is implied.

## Verification record

Hermes reported the original implementation result and disclosed its known visualization limitation. Codex independently reran the frozen visible harness at 100/100, reran the supplemental stress suite at 48/48, confirmed frozen-harness integrity, inspected the final rendering, and published the reproducible artifact package.

The 3D companion (`3d/`) was built later (2026-08-05) by Hermes Agent on the same verified numerical core and carries its own headless verification receipt ([`proofs/companion-3d.txt`](proofs/companion-3d.txt), re-runnable via `3d/verify-companion.js`). The frozen benchmark `index.html` was not modified.

See [PROVENANCE.md](PROVENANCE.md) and the files under [`proofs/`](proofs/) for the timestamped evidence chain and reproducible receipts.
