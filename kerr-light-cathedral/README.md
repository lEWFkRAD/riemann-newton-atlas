# Kerr Light Cathedral

Kerr Light Cathedral is a two-tier gravitational-lensing laboratory produced from an adversarial numerical-relativity benchmark.

## Open the exhibits

- [`index.html`](index.html) — accuracy-first CPU reference, interactive observatory, and frozen 100-point grader.
- [`cathedral-live.html`](cathedral-live.html) — animated WebGL2 edition with camera orbit, drag/zoom navigation, Keplerian disk shear, Doppler beaming, gravitational redshift, and a lensed star field.

Both are standalone HTML files. Download the directory and open either page in a modern browser. If local browser security blocks WebGL, serve the folder with:

```powershell
python -m http.server 8377 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8377/cathedral-live.html`.

## What is reference-grade versus real-time

The CPU page is the numerical reference. It implements the Boyer–Lindquist Kerr metric, stable 4×4 inversion, Christoffel symbols, Carter constants and potentials, Hamiltonian null-geodesic flow, adaptive Dormand–Prince 5(4), event localization, local camera tetrads, relativistic redshift, and deterministic progressive rendering.

The GPU page is the real-time exhibit. It uses a fixed-step RK4 shader with a bounded step count so every pixel can advance in parallel. That makes animation possible, but it is not claimed to match the adaptive CPU solver's accuracy.

## Verification

- Frozen visible grader: **100/100** in Node and headless Chrome.
- Supplemental physics probes: **16/16**.
- Frozen grader block: byte-identical to the starter, SHA-256 `15e13f21d5b40b4da241584e41a2cdcfdc2be0c1f80ccb191a2116084f63b1af`.
- CPU smoke render: every pixel classified exactly once with disk, escape, and capture classes present.
- Full CPU receipt: 560×380, 212,800 traced pixels.
- Live WebGL2 verification: shader compiled, animation advanced, no page exceptions, non-blank 960×540 image, and measured 53% left/right brightness asymmetry.

Re-run the numerical checks from this directory:

```powershell
node verify-node.js
node verify-chrome.js
node verify-live.js
```

The browser scripts currently target the standard Windows installation path for Google Chrome.

## Receipts

- [`receipts/cathedral-render.png`](receipts/cathedral-render.png) — full-resolution CPU render.
- [`receipts/verify-chrome.png`](receipts/verify-chrome.png) — CPU observatory in headless Chrome.
- [`receipts/verify-chrome-canvas.png`](receipts/verify-chrome-canvas.png) — raw CPU smoke render.
- [`receipts/verify-live.png`](receipts/verify-live.png) — live WebGL2 verification frame.
- Text receipts: [`verify-node.log`](verify-node.log), [`verify-chrome.log`](verify-chrome.log), and [`verify-live.log`](verify-live.log).

## Known limitations

- The GPU page uses fixed-step RK4 and a step cap; it is the animated approximation, not the accuracy reference.
- The CPU renderer currently detects disk crossings from accepted-step endpoints instead of applying the core's precise segment localizer. An independent audit found some false/missed disk pixels and intersection-radius error. The underlying numerical core and frozen grader remain valid.
- The CPU visualization uses first-hit thin-disk shading and no multi-hit compositing.
- Performance varies sharply between Node's VM harness, software WebGL, and an accelerated desktop GPU.

## Credits

- Project direction and publication: [@lEWFkRAD](https://github.com/lEWFkRAD)
- Primary mathematical implementation, optimization, verification tooling, and live GPU extension: **Hermes Agent**, using **Qwen3.8 Max** through Nous
- Benchmark design and independent numerical review: **OpenAI Codex**
- Visual inspection support: **Nous-hosted cloud vision**

See [`NOTES.md`](NOTES.md) for the implementation decisions and performance history. The pristine benchmark is retained as [`index.starter.html`](index.starter.html).
