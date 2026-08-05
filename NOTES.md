# NOTES.md — RN-ATLAS-12 submission

Submission: edited `index.html` (candidate block + `#candidate-atlas` container only) + this note.
Frozen harness verified byte-identical to the original; decorative field untouched.

## 1. Numerical stability choices

- **Complex division — Smith's algorithm.** The naive `(a·conj b)/|b|²` overflows when
  `|b|` is large and underflows when small. Smith's scaled form divides by the larger
  component first, keeping every intermediate bounded by `2·max(|re|,|im|)`. Used in
  `div`, Newton steps, and Aberth corrections.
- **Horner, one fused pass.** `p` and `p′` come from a single left-to-right evaluation
  (no separate derivative polynomial), halving the rounding work and guaranteeing the
  derivative corresponds exactly to the evaluated value.
- **Aberth–Ehrlich with Weierstrass correction.** Simultaneous iteration converges
  quadratically for simple roots and stays linear-but-safe for clusters/multiplicities
  because each update subtracts `Σ 1/(zᵢ−zⱼ)` — coincident guesses get shoved apart
  rather than dividing by ~0. Initial guesses use a Cauchy radius bound with golden-angle
  angular spread (low discrepancy, fully deterministic — no `Math.random`).
  Convergence stops on `max|correction| ≤ tol·max(R,1)`, then each guess gets ≤8 plain
  Newton polish steps. That polish is what carries the near-cluster fixture
  (roots 0.0002 apart, `tol 1e-12`) to <8e-5 matching.
- **Quadratic fast path is cancellation-safe.** Of the two `(-b±√D)/2a` branches it keeps
  the larger-magnitude one and recovers the second via Vieta (`r₂ = c/(a·r₁)`), then
  polishes both.
- **RK45 = Dormand–Prince 5(4) with FSAL-free embedded error.** Error is scaled by
  `atol + rtol·max(|z|,|y₅|)` (standard PI-free step control, growth clamped to ×5,
  shrink to ×0.2, safety 0.9). Extra guards specific to Newton flow:
  - *Root terminal* uses the scale-invariant step length `|p/p′| ≤ rootTol·max(1,|z|)`
    rather than a raw residual, so it works for any coefficient scale; the endpoint is
    then polished with ≤4 Newton steps for a tight landing.
  - *Singularity terminal*: `|p′| < 1e-300` or step length > 1e8 → `'singular'`;
    starting exactly at a critical point terminates immediately with reason `'singular'`.
  - *Critical-point proximity*: the error tolerance is tightened near roots of `p′`
    (found once via `aberth` on the derivative coefficients) so steps stay inside the
    smooth regime instead of orbiting a critical point.
  - Step underflow (`h < hMin`) is a terminal reason, not an infinite loop.
  - All outputs are finite for finite inputs; every stage is checked before use.
- **Marching squares on label changes.** The boundary is defined as *where labels differ*,
  not an iso-value of a scalar field. Saddle cells (4 differing edges) are resolved
  deterministically by pairing (T,R)+(L,B) — a fixed convention, symmetric under the
  grid's symmetries, never NaN, never duplicates (a dedupe set remains as defense).
- **Box-counting** counts boxes containing ≥2 distinct labels (−1 excluded), fits
  dimension by least squares on `log N(ε)` vs `log(1/ε)` over the usable scales.

## 2. Complexity

| Operation | Time | Space |
|---|---|---|
| Horner p+p′ | O(n) | O(1) |
| Aberth (per iteration) | O(n²) Weierstrass sum | O(n) |
| Aberth total | O(n²·iters), iters ≲ few hundred for n≤12 | O(n) |
| RK45 step | O(n) per stage × 7 stages | O(path length) |
| Basin classify per pixel | O(80·n) worst case | O(1) |
| Full 700×540 coarse+fine pass | ≈ 2·(W·H) classifications | one `ImageData` + `Int32Array` |
| Marching squares | O(W·H) | O(boundary segments) |

The renderer never blocks: work is tiled (32 px), budgeted per `requestAnimationFrame`,
and a generation counter cancels stale tiles the moment any input changes (pan/zoom/
edit/preset). Progressive = block-4 coarse pass → block-1 fine pass; pan/zoom during a
render reprojects the existing bitmap (affine stretch) so interaction stays at 60 fps,
then re-renders after a 140 ms settle.

## 3. Accessibility

- Canvas carries `role="application"` + a descriptive `aria-label` documenting every
  keyboard binding; it is focusable (`tabindex="0"`).
- Full keyboard operation: arrows pan, `+`/`-` zoom, `0` resets, `E` exports PNG,
  `F`/`B` toggle flow lines / boundary.
- Render status is an `aria-live="polite"` region; editor errors use `role="alert"`.
- All controls are real `<button>`/`<select>`/`<input>` elements with visible
  `:focus-visible` outlines; the hover inspector is decorative (`aria-hidden`).
- Color is never the only signal: basins also differ in iteration-shaded tone, and
  roots are numbered on canvas.

## 4. One known limitation

**The fine pass re-classifies every pixel with plain Newton iteration, so the atlas
resolution is capped by per-pixel iteration cost, and pixels whose Newton orbit is
chaotic (common right on basin boundaries at high zoom) are classified as
boundary/unclassified after the 80-iteration cap.** This is deliberate — chaotic orbits
*are* the boundary fractal — but it means the entropy/dimension metrics are estimates
on an 80-iteration truncation, and very deep zooms show coarser classification than a
path-tracing (RK45-endpoint) classifier would give. Switching the fine pass to
trajectory-endpoint classification would fix fidelity at the cost of ~20× compute.

## 5. Verification performed

- Node port of the 10 frozen checks: **100/100**.
- Real Chrome (puppeteer-core, headless) loading `file://` page: **100/100**, twice
  (second run after the atlas was live — call-order robustness), zero console errors.
- Stress suite (48 cases): degrees 3–12 × random roots, coefficient scales 1e-6…1e9,
  multiplicities 2–4, 24-start basin classification, critical-point start, determinism
  (identical JSON on repeat calls), entropy extremes, marching-squares uniform/saddle:
  **48/48**.
- Atlas metrics sanity: z³−1 → entropy 0.9947, boundary dim ≈ 1.24 (theoretical
  basin-boundary dimension for z³−1 is ≈ 1.1–1.4); degree-12 ring → dim ≈ 1.62.
- Harness section diffed byte-identical against `index.orig.html` backup.
- Size: 46,371 bytes (45.2 KB) < 300 KB. No `eval`, no network, no `Math.random`,
  no global error suppression.
