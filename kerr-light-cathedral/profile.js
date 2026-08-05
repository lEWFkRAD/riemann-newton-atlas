/* profile.js — count RHS evals per ray + time the hot functions */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const coreSrc = fs.readFileSync(path.join(__dirname, 'src', 'core.js'), 'utf8');
const sandbox = { Math, Number, JSON, console, Object, Array, Set };
let candidate = null;
sandbox.__EXPORT__ = (c) => { candidate = c; };
vm.createContext(sandbox);
vm.runInContext(coreSrc + '\n;__EXPORT__(candidate);', sandbox);

const M = 1, a = 0.6;
const rp = M + Math.sqrt(M * M - a * a);
const ESC = 90;
const FAST = { rtol: 2e-5, atol: 2e-7, maxSteps: 420, initialStep: 1.0, maxStep: 6.0 };

let rhsCalls = 0;
const rhs = (t, y) => { rhsCalls++; return candidate.geodesicRHS(M, a, y); };

const rays = [];
for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) {
  rays.push([i / 11 * 2 - 1, j / 7 * 2 - 1]);
}
let totalSteps = 0;
const t0 = process.hrtime.bigint();
for (const [px, py] of rays) {
  const ray = candidate.screenRay(M, a, { r: 26, theta: 1.25, phi: 0, fov: 1.15 }, { x: px, y: py });
  const out = candidate.rk45Event(rhs, ray.state, 0, 2500, Object.assign({}, FAST, {
    event: (t, y) => (y[1] - rp * 1.0008) * (ESC - y[1])
  }));
  totalSteps += out.steps;
}
const t1 = process.hrtime.bigint();
const ms = Number(t1 - t0) / 1e6;
console.log(`${rays.length} rays: ${ms.toFixed(1)} ms total, ${ms / rays.length} ms/ray`);
console.log(`steps ${totalSteps}, rhsCalls ${rhsCalls}, rhs/step ${(rhsCalls / totalSteps).toFixed(2)}`);

/* time geodesicRHS alone */
const ray = candidate.screenRay(M, a, { r: 26, theta: 1.25, phi: 0, fov: 1.15 }, { x: 0.3, y: 0.1 });
const N = 100000;
const u0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) candidate.geodesicRHS(M, a, ray.state);
const u1 = process.hrtime.bigint();
console.log(`geodesicRHS: ${(Number(u1 - u0) / N / 1000).toFixed(3)} us/call`);

const s0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) candidate.screenRay(M, a, { r: 26, theta: 1.25, phi: 0, fov: 1.15 }, { x: 0.3, y: 0.1 });
const s1 = process.hrtime.bigint();
console.log(`screenRay: ${(Number(s1 - s0) / N / 1000).toFixed(3)} us/call`);
