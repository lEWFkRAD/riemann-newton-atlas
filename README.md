# Riemann–Newton Atlas

A dependency-free, single-file complex-dynamics laboratory completed by Hermes as an adversarial mathematical programming benchmark.

## Run it

Download `index.html` and open it in a modern browser. The page includes:

- an Aberth–Ehrlich simultaneous complex-root solver;
- an adaptive Dormand–Prince RK45 Newton-flow integrator;
- basin entropy, boundary box dimension, and marching squares;
- a progressive interactive Newton atlas with presets, pan/zoom, root inspection, flow lines, boundaries, and PNG export;
- ten deterministic checks with an in-page 100-point score.

![Completed degree-12 atlas](screenshot.png)

## Verified result

- Visible benchmark: **100/100**
- Supplemental stress suite: **48/48**
- Frozen benchmark harness: byte-identical to `original/index.orig.html`
- Final HTML: 46,371 bytes
- No external libraries, network calls, `eval`, or `Math.random` in the deliverable

The implementation and verification rationale are documented in [NOTES.md](NOTES.md).

For a plain-English tour of the image, see [ANNOTATIONS.md](ANNOTATIONS.md). Full attribution is in [CREDITS.md](CREDITS.md).

## Re-run verification

From the repository root:

```powershell
node verification/harness-node.js
node verification/stress.js
cd verification
npm install
node browser-test.js
```

The browser test currently targets the standard Windows installation path for Google Chrome.

## Known limitation

The interactive atlas classifies its dense pixel field with capped discrete Newton iteration for responsiveness. The exported RK45 API implements continuous Newton flow and passes its numerical tests, but the atlas pixels are not individually classified by RK45 trajectory endpoints.

## Credits

- Project direction and publication: [@lEWFkRAD](https://github.com/lEWFkRAD)
- Numerical implementation and interactive atlas: Hermes Agent
- Benchmark design and independent verification: OpenAI Codex
- Visual verification support: Nous-hosted cloud vision
