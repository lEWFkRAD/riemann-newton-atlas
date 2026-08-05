# NOTES — The Kerr Light Cathedral

Hermes Adversarial Showcase · Relativistic Ray Tracing · bonus fixture
Published under `kerr-light-cathedral/` in the Science Stack repository.
Started 2026-08-05.

## Result (TL;DR)

- **Visible grader: 100/100** — verified twice: in Node (`verify-node.js`)
  and in real headless Chrome (`verify-chrome.js`, button-click driven).
- **Physics probes: 16/16** extra checks (null-constraint grid, geodesic
  round-trip symmetry, beaming signs, tile determinism, …) all pass.
- **Renderer**: progressive Hamiltonian ray tracer, 560×380 at ~1.0 ms/ray.
  Every pixel traced exactly once (census-checked in Chrome: 18816/18816 and
  212800/212800). Shadow + Doppler-beamed disk + lensed far-side disk image +
  lensed starfield all present, visually confirmed on receipts.
- Frozen grader byte-identical to starter (SHA-256 match enforced by
  `verify-chrome.js` before anything else runs).

## What was implemented

### `src/core.js` — the numerical core (12 grader functions)

1. `kerrMetricBL` — Boyer-Lindquist Kerr metric (Σ, Δ, A forms).
2. `inverse4` — symmetric 4×4 inverse via cofactors with pivot guard.
3. `christoffel` — central finite differences of the metric (grader
   tolerance is 2e-6; analytic is not required and FD passes cleanly).
4. `constantsOfMotion` — E, Lz, Q from the covariant state.
5. `nullHamiltonian` — ½ g^μν p_μ p_ν from the analytic inverse.
6. `carterPotentials` — separated R(r), Θ(θ) potentials.
7. `geodesicRHS` — Hamiltonian flow: xdot = g^μν p_ν, pdot = ½ ∂_μ g_ab
   xdot^a xdot^b with **analytic metric derivatives** (one trig pass, no
   intermediate arrays). This is the renderer hot path.
8. `rk45Event` — adaptive Dormand-Prince 5(4) with FSAL reuse and event
   localization (see decisions below).
9. `localizeDiskEvent` — thin-disk plane crossing, linear interpolation.
10. `redshiftFactor` — g = (p·u_obs)/(p·u_em).
11. `screenRay` — LNRF tetrad camera → BL covariant state; null constraint
    enforced to <2e-9 across a 5-spin × 9-pixel grid.
12. `tileOrder` — deterministic Hilbert-free tile cover; grader-verified to
    cover every pixel of odd-size canvases exactly once.

### `src/cathedral.js` — the interactive observatory

Replaces the marked `#candidate-cathedral` container (starter's placeholder
text says exactly this is the allowed edit). Progressive tile scheduler on
`candidate.tileOrder`: one animation frame per batch of tiles, cancellable
between tiles, ~20 fps cadence. Controls: spin a/M, inclination, camera
distance, quality tier; drag-to-orbit; ray inspector with Hamiltonian-drift
plot (PRECISE tier 1e-9/1e-11 for the inspected ray so reported drift is
real, not tolerance noise); PNG export; `window.__cathedral` headless hook.

Disk shading: T ∝ r^-3/4 blackbody tint × g³ beaming, inner-edge
gravitational reddening. Star field: deterministic hash grid sampled at the
ray's **asymptotic direction** (never `normalize(pos)` — the classic bug).
Photon-ring enhancement from bending alone (closest-approach window near the
prograde photon orbit), no screen-space hack.

## Key decisions and why

- **DP5(4) error coefficients must be e = b − b\***, not b\* itself. The
  first version stored the embedded-solution weights as the error vector;
  result was integrator stalls and wrong event times. Everything downstream
  (event localization accuracy, step control sanity) depended on fixing
  this. This is the single highest-value lesson of the task.
- **Event localization: secant (Illinois-guarded, bisection fallback) where
  every probe is a fresh DP5 re-integration from the bracket start**, with
  the bracket-start k1 reused from the accepted step's FSAL value. Probes
  carry full 5th-order accuracy (no h^5 dense-output error) at ~5 RHS evals
  each instead of 56 full bisection passes (~336 evals). Measured:
  13.28 → 9.75 RHS/step.
- **Analytic metric derivatives in `geodesicRHS`** instead of finite
  differences or repeated metric-matrix builds: 0.53 µs/call (was ~1.5 µs),
  and exact for the t/φ Killing directions. Combined with the above:
  6.6 ms/ray → 1.0 ms/ray at renderer tolerances.
- **Two integration tiers.** Renderer: rtol 2e-5 / atol 2e-7, maxStep 6,
  cap 420 steps — fast and visually clean. Inspector: rtol 1e-9 / atol
  1e-11 — the drift readout must reflect the integrator, not the tolerance.
- **Star field at asymptotic direction**, photon ring from bending: both
  per the relativistic-rendering skill's pitfalls list; verified visually.
- **Frozen grader integrity as a CI gate**, not a promise: `verify-chrome.js`
  SHA-256-compares the grader block between `index.starter.html` and the
  assembled `index.html` before loading anything.

## Performance log (Node, a=0.6, r=26, mixed rays)

| stage                                | ms/ray |
|--------------------------------------|--------|
| start (cubic-Hermite events, FD-ish) | 6.6    |
| analytic metric derivatives          | 1.6    |
| secant event localization + FSAL     | 1.0    |

## Files and receipts

- `index.html` — assembled fixture (starter + core + cathedral; grader intact)
- `index.starter.html` — pristine starter backup (2026-08-05)
- `verify-node.js` / `verify-node.log` — Node gate: 100/100 + 16 probes
- `verify-chrome.js` / `verify-chrome.log` — Chrome gate: 13 checks, ALL PASS
- `verify-chrome.png` — screenshot with observatory scrolled into view
- `verify-chrome-canvas.png` — raw 168×112 smoke render (vision-verified)
- `cathedral-render.png` — full-res 560×380 receipt
- `assemble.js`, `bench.js`, `profile.js`, `receipt-shot.js` — tooling

## Known limits (honest)

- 2D Canvas renderer, ~1 ms/ray: 560×380 balanced pass ≈ 4 minutes. That's
  the price of tracing every pixel from the metric in pure JS.
- Thin-disk: first crossing wins (optically thin assumption); no multi-hit
  compositing.
- Star density is modest (3 octaves) to keep escape rays cheap.
- Christoffel check uses FD per grader tolerance; `geodesicRHS` does not —
  it uses analytic derivatives, which is why flow error stays ~1e-7.
