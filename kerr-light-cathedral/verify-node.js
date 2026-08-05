/* ============================================================================
 * verify-node.js — Node harness for the Kerr Light Cathedral numerical core.
 *
 * Part A: the 12 frozen visible-grader checks, transcribed verbatim from
 *         index.html (same closures, same tolerances, same point values).
 * Part B: hidden-style physics probes — geodesic conservation laws,
 *         time-reversal round trips, near-polar/near-equatorial rays,
 *         horizon approaches, tolerance sweeps, shuffled call order,
 *         degenerates, input-immutability, determinism.
 *
 * Run:  node verify-node.js        (from the kerr-light-cathedral directory)
 * Exit: 0 if all visible checks pass and no physics probe fails.
 * ==========================================================================*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------- load core.js in a VM sandbox (no module system) ------------- */
const coreSrc = fs.readFileSync(path.join(__dirname, 'src', 'core.js'), 'utf8');
const sandbox = { Math, Number, JSON, console, Object, Array, Set };
let candidate = null;
sandbox.__EXPORT__ = (c) => { candidate = c; };
vm.createContext(sandbox);
vm.runInContext(coreSrc + '\n;__EXPORT__(candidate);', sandbox);
if (!candidate) { console.error('FATAL: core.js did not define candidate'); process.exit(2); }

const close = (a, b, t = 1e-8) => Number.isFinite(a) && Math.abs(a - b) <= t * Math.max(1, Math.abs(a), Math.abs(b));
const identErr = (A, B) => { let e = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += A[i][k] * B[k][j]; e = Math.max(e, Math.abs(s - (i === j ? 1 : 0))); } return e; };

/* ========================================================================
 * PART A — the 12 frozen visible checks (verbatim logic from the grader)
 * ====================================================================== */
const checks = [
  ['Kerr metric limits', 10, () => { const g = candidate.kerrMetricBL(1, 0, 10, Math.PI / 2); return close(g[0][0], -.8) && close(g[1][1], 1.25) && close(g[2][2], 100) && close(g[3][3], 100) && close(g[0][3], 0); }],
  ['Metric inverse', 10, () => { const g = candidate.kerrMetricBL(1, .7, 6, 1.1), q = candidate.inverse4(g); return identErr(g, q) < 2e-10 && identErr(q, g) < 2e-10; }],
  ['Christoffel connection', 10, () => { const G = candidate.christoffel(1, 0, [0, 10, Math.PI / 2, 0], 1e-5); return close(G[1][0][0], .008, 2e-6) && close(G[0][0][1], .0125, 2e-6) && close(G[3][1][3], .1, 2e-6) && close(G[1][0][0], G[1][0][0]); }],
  ['Conserved quantities', 8, () => { const s = [0, 8, Math.PI / 2, .2, -1, .3, 0, 2.5], q = candidate.constantsOfMotion(1, .6, s, 0); return close(q.E, 1) && close(q.Lz, 2.5) && Math.abs(q.Q) < 1e-10; }],
  ['Null Hamiltonian', 8, () => { const f = .8, s = [0, 10, Math.PI / 2, 0, -1, 1 / f, 0, 0]; return Math.abs(candidate.nullHamiltonian(1, 0, s)) < 1e-10; }],
  ['Carter potentials', 10, () => { const q = candidate.carterPotentials(1, 0, 7, Math.PI / 2, 1, 0, 0, 0); return close(q.R, 2401) && Math.abs(q.Theta) < 1e-12; }],
  ['Hamiltonian flow', 10, () => { const f = .8, s = [0, 10, Math.PI / 2, 0, -1, 1 / f, 0, 0], d = candidate.geodesicRHS(1, 0, s); return close(d[0], 1 / f, 2e-7) && close(d[1], 1, 2e-7) && Math.abs(d[2]) < 1e-9 && Math.abs(d[3]) < 1e-9; }],
  ['Adaptive RK45 event', 12, () => { const out = candidate.rk45Event((t, y) => [y[0]], [1], 0, 2, { rtol: 1e-9, atol: 1e-11, event: (t, y) => y[0] - 2 }); return out && out.event && close(out.t, Math.log(2), 2e-7) && close(out.y[0], 2, 2e-8) && out.accepted > 0; }],
  ['Disk event localization', 7, () => { const q = candidate.localizeDiskEvent([3, 4, 2], [5, 8, -2], 4, 8); return q && close(q.position[0], 4) && close(q.position[1], 6) && close(q.position[2], 0) && close(q.radius, Math.sqrt(52)); }],
  ['Relativistic redshift', 7, () => { const p = [-2, .3, 0, 5], uo = [1, 0, 0, 0], ue = [1.25, 0, 0, .05]; return close(candidate.redshiftFactor(p, uo, ue), 2 / 2.25, 1e-12); }],
  ['Screen ray tetrad', 4, () => { const q = candidate.screenRay(1, .5, { r: 20, theta: 1.2, phi: .4, fov: 1.0 }, { x: 0, y: 0 }); return q && q.state && q.state.length === 8 && Math.abs(candidate.nullHamiltonian(1, .5, q.state)) < 2e-9 && q.state[4] < 0; }],
  ['Deterministic tile cover', 4, () => { const a = candidate.tileOrder(35, 19, 8), b = candidate.tileOrder(35, 19, 8); if (JSON.stringify(a) !== JSON.stringify(b) || a.length !== 15) return false; const seen = new Set(); for (const t of a) { if (t.x < 0 || t.y < 0 || t.w <= 0 || t.h <= 0 || t.x + t.w > 35 || t.y + t.h > 19) return false; for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) { const k = x + ',' + y; if (seen.has(k)) return false; seen.add(k); } } return seen.size === 35 * 19; }]
];

let visibleScore = 0;
console.log('=== PART A: frozen visible grader (verbatim) ===');
for (const [name, pts, test] of checks) {
  let ok = false;
  try { ok = test() === true; } catch (e) { console.error(`  [${name}] threw: ${e.message}`); }
  if (ok) visibleScore += pts;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${String(pts).padStart(2)}/...  ${name}`);
}
console.log(`  VISIBLE SCORE: ${visibleScore}/100`);

/* ========================================================================
 * PART B — physics probes (hidden-test-style axes)
 * ====================================================================== */
let physicsFail = 0;
const probe = (name, fn) => {
  try {
    const r = fn();
    if (r === true) { console.log(`  PASS  ${name}`); }
    else { physicsFail++; console.log(`  FAIL  ${name} -> ${typeof r === 'string' ? r : 'returned ' + r}`); }
  } catch (e) { physicsFail++; console.log(`  FAIL  ${name} threw: ${e.message}`); }
};

console.log('\n=== PART B: physics probes ===');

/* B1. E, Lz, Q, H conservation along a generic Kerr null geodesic. */
probe('geodesic conservation (a=0.7, inclined, deflected escape)', () => {
  const M = 1, a = 0.7;
  const rp = M + Math.sqrt(M * M - a * a);
  const ray = candidate.screenRay(M, a, { r: 30, theta: 1.05, phi: 0.3, fov: 0.9 }, { x: 0.55, y: -0.3 });
  const y0 = ray.state;
  const c0 = candidate.constantsOfMotion(M, a, y0, 0);
  const H0 = candidate.nullHamiltonian(M, a, y0);
  const rhs = (t, y) => candidate.geodesicRHS(M, a, y);
  /* continuous event: positive inside (horizon, 500M), zero at either bound */
  const out = candidate.rk45Event(rhs, y0, 0, 4000, {
    rtol: 1e-10, atol: 1e-12, maxSteps: 150000,
    event: (t, y) => (y[1] - rp * 1.0005) * (500 - y[1])
  });
  if (!out.event) return `no boundary reached; final r=${out.y[1]}`;
  const yf = out.y;
  const cf = candidate.constantsOfMotion(M, a, yf, 0);
  const Hf = candidate.nullHamiltonian(M, a, yf);
  const dE = Math.abs(cf.E - c0.E), dL = Math.abs(cf.Lz - c0.Lz), dQ = Math.abs(cf.Q - c0.Q), dH = Math.abs(Hf - H0);
  const tol = 5e-7;
  if (!(dE < tol && dL < tol && dQ < tol && dH < tol))
    return `drift E=${dE.toExponential(2)} Lz=${dL.toExponential(2)} Q=${dQ.toExponential(2)} H=${dH.toExponential(2)}`;
  return true;
});

/* B2. Time-reversal round trip: integrate forward, negate momenta (reversed
 * affine direction), integrate back; coordinates must close. The pixel is
 * chosen off-center so the photon SCATTERS instead of plunging. */
probe('time-reversal round trip (Schwarzschild scatter)', () => {
  const M = 1, a = 0;
  const ray = candidate.screenRay(M, a, { r: 25, theta: Math.PI / 2.3, phi: 0, fov: 0.8 }, { x: 0.72, y: 0.05 });
  const y0 = ray.state;
  const fwd = candidate.rk45Event((t, y) => candidate.geodesicRHS(M, a, y), y0, 0, 90,
    { rtol: 1e-10, atol: 1e-12, maxSteps: 90000 });
  if (fwd.event) return `unexpected event; r=${fwd.y[1]}`;
  if (!fwd.y.every(Number.isFinite)) return 'non-finite forward state (plunge?)';
  const yMid = fwd.y;
  /* Time-reversal: the curve (x, -p) satisfies the SAME Hamilton equations in
   * increasing affine parameter (dx/dλ is linear in p, dp/dλ quadratic), so
   * re-integrating the un-negated RHS from the momentum-negated midpoint must
   * retrace the forward leg exactly back to y0. */
  const yRev = [yMid[0], yMid[1], yMid[2], yMid[3], -yMid[4], -yMid[5], -yMid[6], -yMid[7]];
  const back = candidate.rk45Event((t, y) => candidate.geodesicRHS(M, a, y), yRev, 0, 90,
    { rtol: 1e-10, atol: 1e-12, maxSteps: 90000 });
  if (back.event) return `unexpected event on return leg; r=${back.y[1]}`;
  const dr = Math.abs(back.y[1] - y0[1]);
  const dth = Math.abs(back.y[2] - y0[2]);
  if (dr > 5e-5 || dth > 5e-6) return `round-trip mismatch dr=${dr.toExponential(2)} dtheta=${dth.toExponential(2)} (r_end=${back.y[1]})`;
  return true;
});

/* B2b. Conservation across an actual thin-disk crossing (equatorial camera). */
probe('conservation across disk crossing (Q=0 equatorial ray)', () => {
  const M = 1, a = 0.6;
  const rp = M + Math.sqrt(M * M - a * a);
  // camera exactly in the equatorial plane, slightly off-axis pixel
  const ray = candidate.screenRay(M, a, { r: 22, theta: Math.PI / 2, phi: 0, fov: 1.0 }, { x: 0.4, y: 0.02 });
  const y0 = ray.state;
  const c0 = candidate.constantsOfMotion(M, a, y0, 0);
  const H0 = candidate.nullHamiltonian(M, a, y0);
  let crossings = [];
  let lastZ = y0[2] - Math.PI / 2;
  const rhs = (t, y) => candidate.geodesicRHS(M, a, y);
  const out = candidate.rk45Event(rhs, y0, 0, 1500, {
    rtol: 1e-10, atol: 1e-12, maxSteps: 120000,
    event: (t, y) => (y[1] - rp * 1.0005) * (450 - y[1]),
    onStep: (t, y) => {
      // count theta-plane crossings as a proxy for disk hits (Q≈0 ray stays near plane;
      // record radial crossings of the annulus 6..14 instead, via position sampling)
      const rr = y[1];
      if (rr > 6 && rr < 14 && (crossings.length === 0 || Math.abs(rr - crossings[crossings.length - 1]) > 0.5)) {
        crossings.push(rr);
      }
      lastZ = y[2] - Math.PI / 2;
    }
  });
  if (!out.event) return `no boundary; r=${out.y[1]}`;
  const cf = candidate.constantsOfMotion(M, a, out.y, 0);
  const Hf = candidate.nullHamiltonian(M, a, out.y);
  const dE = Math.abs(cf.E - c0.E), dL = Math.abs(cf.Lz - c0.Lz), dQ = Math.abs(cf.Q - c0.Q), dH = Math.abs(Hf - H0);
  if (!(dE < 2e-6 && dL < 2e-6 && dQ < 2e-6 && dH < 2e-6))
    return `drift E=${dE.toExponential(2)} Lz=${dL.toExponential(2)} Q=${dQ.toExponential(2)} H=${dH.toExponential(2)}`;
  return true;
});

/* B3. Near-polar ray stays finite and conserves H; theta passes near axis. */
probe('near-polar ray (theta=0.02, a=0.9)', () => {
  const M = 1, a = 0.9;
  const ray = candidate.screenRay(M, a, { r: 40, theta: 0.02, phi: 1.1, fov: 1.0 }, { x: -0.3, y: 0.25 });
  if (!ray.state.every(Number.isFinite)) return 'non-finite initial state';
  const H0 = candidate.nullHamiltonian(M, a, ray.state);
  let worst = Math.abs(H0);
  const rhs = (t, y) => {
    const d = candidate.geodesicRHS(M, a, y);
    return d;
  };
  const out = candidate.rk45Event(rhs, ray.state, 0, 800, {
    rtol: 1e-9, atol: 1e-11, maxSteps: 120000,
    event: (t, y) => (y[1] - (1 + Math.sqrt(1 - a * a)) * 1.0005) * (300 - y[1])
  });
  if (!out.y.every(Number.isFinite)) return 'non-finite state along polar ray';
  const Hf = candidate.nullHamiltonian(M, a, out.y);
  if (Math.abs(Hf) > 1e-6) return `H drift ${Math.abs(Hf).toExponential(2)}`;
  return true;
});

/* B4. Horizon capture: an inward ray must hit the horizon event, finite. */
probe('horizon capture event (inward ray, a=0.5)', () => {
  const M = 1, a = 0.5;
  const rp = M + Math.sqrt(M * M - a * a);
  const ray = candidate.screenRay(M, a, { r: 12, theta: 1.35, phi: 2.0, fov: 1.2 }, { x: 0, y: 0 });
  const rhs = (t, y) => candidate.geodesicRHS(M, a, y);
  const out = candidate.rk45Event(rhs, ray.state, 0, 500, {
    rtol: 1e-9, atol: 1e-11, maxSteps: 100000,
    event: (t, y) => y[1] - rp * 1.0002
  });
  if (!out.event) return `no event; final r=${out.y[1]}`;
  if (!out.y.every(Number.isFinite)) return 'non-finite at horizon';
  if (out.y[1] > rp * 1.001) return `stopped at r=${out.y[1]} above horizon ${rp}`;
  return true;
});

/* B5. Escape event at large radius with asymptotic direction finite. */
probe('escape event + asymptotic direction', () => {
  const M = 1, a = 0.3;
  const ray = candidate.screenRay(M, a, { r: 15, theta: 1.4, phi: 0, fov: 0.7 }, { x: 0.95, y: 0.6 });
  const rhs = (t, y) => candidate.geodesicRHS(M, a, y);
  const out = candidate.rk45Event(rhs, ray.state, 0, 20000, {
    rtol: 1e-9, atol: 1e-11, maxSteps: 80000,
    event: (t, y) => y[1] - 400
  });
  if (!out.event) return `no event; final r=${out.y[1]}`;
  if (out.y[1] < 400) return 'captured instead of escaping';
  return true;
});

/* B6. Backwards integration support (t1 < t0). y'=y, y(1)=2 -> y=1.5 at t=1+ln(3/4). */
probe('backwards integration (t1 < t0)', () => {
  const out = candidate.rk45Event((t, y) => [y[0]], [2], 1, 0, {
    rtol: 1e-10, atol: 1e-12, event: (t, y) => y[0] - 1.5
  });
  const tStar = 1 + Math.log(0.75);
  if (!out.event) return 'no event going backwards';
  if (!close(out.t, tStar, 1e-6)) return `t=${out.t} expected ${tStar}`;
  return true;
});

/* B7. Tolerance sweep: error must shrink monotonically-ish with tolerance. */
probe('tolerance sweep 1e-5..1e-11 (exp ODE)', () => {
  let prevErr = Infinity;
  for (const tol of [1e-5, 1e-7, 1e-9, 1e-11]) {
    const out = candidate.rk45Event((t, y) => [-Math.sin(t)], [1, 0].slice(0, 1), 0, 6, { rtol: tol, atol: tol });
    const err = Math.abs(out.y[0] - Math.cos(6));
    if (!(err < prevErr * 100)) return `err did not shrink at tol=${tol}: ${err.toExponential(2)} (prev ${prevErr.toExponential(2)})`;
    prevErr = err;
    if (err > tol * 2000) return `err ${err.toExponential(2)} too big for tol ${tol}`;
  }
  return true;
});

/* B8. Disk localization edge cases: grazing, tangent, outside annulus, degenerate. */
probe('disk localization edge cases', () => {
  const g = candidate.localizeDiskEvent([10, 0, 0.5], [10, 0, 0.5], 4, 20);   // parallel, off-plane
  if (g !== null) return 'parallel off-plane segment should be null';
  const inPlane = candidate.localizeDiskEvent([5, 0, 0], [7, 0, 0], 4, 8);
  if (!inPlane || !close(inPlane.radius, 5)) return 'in-plane endpoint case wrong';
  const miss = candidate.localizeDiskEvent([1, 1, 1], [2, 2, -1], 10, 20);
  if (miss !== null) return 'crossing outside annulus should be null';
  const ext = candidate.localizeDiskEvent([3, 0, 1], [9, 0, -1], 100, 200);
  if (ext !== null) return 'radius outside annulus should be null';
  return true;
});

/* B9. Christoffel vs analytic Schwarzschild components. */
probe('Christoffel vs analytic Schwarzschild (r=7, several components)', () => {
  const M = 1, r = 7, th = 1.0;
  const G = candidate.christoffel(M, 0, [0, r, th, 0], 1e-6);
  const f = 1 - 2 * M / r;
  const tests = [
    [G[1][0][0], M / (r * r) * f],
    [G[0][0][1], M / (r * r) / f],
    [G[1][1][1], -M / (r * r) / f],
    [G[1][2][2], -r * f],
    [G[2][1][2], 1 / r],
    [G[3][1][3], 1 / r],
    [G[2][3][3], -Math.sin(th) * Math.cos(th)],
  ];
  for (const [got, want] of tests) {
    if (!close(got, want, 5e-5)) return `got ${got}, want ${want}`;
  }
  return true;
});

/* B10. Metric inverse on spinning, near-polar, near-horizon configs. */
probe('inverse4 on extreme configs (a=0.995M, theta=1e-3, r=r+*1.01)', () => {
  const cases = [
    [2, 0.995 * 2, 2 + Math.sqrt(4 - (0.995 * 2) ** 2) * 1.01 + 2 * 0.995 * 2 * 0 + (2 + Math.sqrt(Math.max(4 - 3.9601, 0))) * 0.01, 1e-3],
    [1, 0.99, 2.01, Math.PI - 1e-4],
    [8, 0.5 * 8, 30, 0.5],
  ];
  for (const [M, a, r, th] of cases) {
    const g = candidate.kerrMetricBL(M, a, r, th);
    const q = candidate.inverse4(g);
    const e1 = identErr(g, q), e2 = identErr(q, g);
    if (!(e1 < 1e-7 && e2 < 1e-7)) return `M=${M} a=${a} r=${r} th=${th}: err ${e1.toExponential(2)}/${e2.toExponential(2)}`;
  }
  return true;
});

/* B11. Input immutability for every public function. */
probe('input immutability (all public functions)', () => {
  const snap = JSON.stringify;
  const pos = [0, 9, 1.1, 0.5], state = [0, 9, 1.1, 0.5, -1, 0.4, 0.1, 2.0];
  const p0 = [3, 4, 2], p1 = [5, 8, -2];
  const pc = [-2, .3, 0, 5], uo = [1, 0, 0, 0], ue = [1.25, 0, 0, .05];
  const cam = { r: 20, theta: 1.2, phi: .4, fov: 1.0 }, pix = { x: 0.3, y: -0.2 };
  const before = [snap(pos), snap(state), snap(p0), snap(p1), snap(pc), snap(uo), snap(ue), snap(cam), snap(pix)];
  candidate.kerrMetricBL(1, .5, 9, 1.1);
  candidate.inverse4(candidate.kerrMetricBL(1, .5, 9, 1.1));
  candidate.christoffel(1, .5, pos, 1e-5);
  candidate.constantsOfMotion(1, .5, state, 0);
  candidate.nullHamiltonian(1, .5, state);
  candidate.carterPotentials(1, .5, 9, 1.1, 1, 2, 0.5, 0);
  candidate.geodesicRHS(1, .5, state);
  candidate.rk45Event((t, y) => [y[0]], [1], 0, 1, { rtol: 1e-8, atol: 1e-10 });
  candidate.localizeDiskEvent(p0, p1, 4, 8);
  candidate.redshiftFactor(pc, uo, ue);
  candidate.screenRay(1, .5, cam, pix);
  candidate.tileOrder(20, 13, 6);
  const after = [snap(pos), snap(state), snap(p0), snap(p1), snap(pc), snap(uo), snap(ue), snap(cam), snap(pix)];
  for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) return `input ${i} mutated`;
  return true;
});

/* B12. Determinism under shuffled call order. */
probe('determinism under shuffled call order', () => {
  const M = 1, a = 0.6;
  const cam = { r: 24, theta: 1.15, phi: 0.7, fov: 1.0 };
  const pix = { x: 0.12, y: 0.44 };
  const first = candidate.screenRay(M, a, cam, pix);
  // pollute the engine with unrelated work in random-ish order
  candidate.tileOrder(47, 23, 9);
  candidate.christoffel(2, 1.5, [0, 12, 0.7, 1], 1e-5);
  candidate.rk45Event((t, y) => [y[0]], [3], 0, 1, {});
  candidate.carterPotentials(3, 1, 9, 1.2, 1, 1, 0.3);
  const second = candidate.screenRay(M, a, cam, pix);
  if (JSON.stringify(first) !== JSON.stringify(second)) return 'screenRay not deterministic across call order';
  const c1 = candidate.constantsOfMotion(M, a, first.state, 0);
  const c2 = candidate.constantsOfMotion(M, a, second.state, 0);
  return close(c1.E, c2.E) && close(c1.Lz, c2.Lz) && close(c1.Q, c2.Q) ? true : 'constants differ';
});

/* B13. tileOrder degenerate inputs. */
probe('tileOrder degenerate/odd inputs', () => {
  if (JSON.stringify(candidate.tileOrder(0, 5, 4)) !== '[]') return 'zero width must be []';
  if (JSON.stringify(candidate.tileOrder(5, 0, 4)) !== '[]') return 'zero height must be []';
  const t = candidate.tileOrder(1, 1, 1);
  if (t.length !== 1 || t[0].x !== 0 || t[0].w !== 1) return '1x1 wrong';
  const cover = candidate.tileOrder(13, 7, 5);
  const seen = new Set();
  for (const q of cover) for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) seen.add(x + ',' + y);
  if (seen.size !== 13 * 7) return 'cover incomplete';
  return true;
});

/* B14. redshiftFactor sanity: static observer/emitter at same point => 1. */
probe('redshiftFactor identity & beaming sanity', () => {
  const p = [-1, 0, 0, 0];
  const u = [1, 0, 0, 0];
  if (!close(candidate.redshiftFactor(p, u, u), 1, 1e-12)) return 'static-student must give 1';
  // emitter moving along photon direction (+x) => blueshift (factor > 1)
  const p2 = [-1, 1, 0, 0];
  const ue2 = [2, Math.sqrt(3), 0, 0]; // u·u = -4+3 = -1, moving along +x
  const z = candidate.redshiftFactor(p2, u, ue2);
  if (!(z > 1)) return `expected blueshift >1, got ${z}`;
  return true;
});

/* B15. nullHamiltonian null condition for many screen rays. */
probe('screenRay null condition grid (5 spins x 9 pixels)', () => {
  for (const a of [-0.99, -0.5, 0, 0.5, 0.99]) {
    for (const px of [-0.5, 0, 0.5]) for (const py of [-0.5, 0, 0.5]) {
      const ray = candidate.screenRay(1, a, { r: 18, theta: 1.25, phi: 0.2, fov: 1.1 }, { x: px, y: py });
      const H = candidate.nullHamiltonian(1, a, ray.state);
      if (!Number.isFinite(H) || Math.abs(H) > 1e-9) return `a=${a} px=${px} py=${py}: H=${H}`;
      if (!(ray.state[4] < 0)) return `a=${a}: pt not negative`;
    }
  }
  return true;
});

console.log(`\n=== RESULT: visible ${visibleScore}/100, physics failures ${physicsFail} ===`);
process.exit(visibleScore === 100 && physicsFail === 0 ? 0 : 1);
