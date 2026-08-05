/* bench.js — measure per-ray cost of the cathedral FAST preset to size the render */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const coreSrc = fs.readFileSync(path.join(__dirname, 'src', 'core.js'), 'utf8');
const sandbox = { Math, Number, JSON, console, Object, Array, Set };
let candidate = null;
sandbox.__EXPORT__ = (c) => { candidate = c; };
vm.createContext(sandbox);
vm.runInContext(coreSrc + '\n;__EXPORT__(candidate);', sandbox);

const M = 1;
const FAST = { rtol: 2e-5, atol: 2e-7, maxSteps: 420, initialStep: 1.0, maxStep: 6.0 };
const ESC = 90;

function bench(a, camR, theta, pixels, label) {
  const rp = M + Math.sqrt(M * M - a * a);
  const t0 = process.hrtime.bigint();
  let caps = 0, escs = 0, disks = 0, steps = 0;
  for (const [px, py] of pixels) {
    const ray = candidate.screenRay(M, a, { r: camR, theta, phi: 0, fov: 1.15 }, { x: px, y: py });
    let prevTh = null, disk = false;
    const out = candidate.rk45Event((t, y) => candidate.geodesicRHS(M, a, y), ray.state, 0, 2500,
      Object.assign({}, FAST, {
        event: (t, y) => (y[1] - rp * 1.0008) * (ESC - y[1]),
        onStep: (t, y) => {
          if (!disk && prevTh !== null) {
            const a0 = prevTh - Math.PI / 2, a1 = y[2] - Math.PI / 2;
            if (a0 * a1 < 0 && y[1] > 6 && y[1] < 18) disk = true;
          }
          prevTh = y[2];
        }
      }));
    steps += out.steps;
    if (disk) disks++;
    else if (out.event && out.y[1] <= rp * 1.02) caps++;
    else escs++;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`${label}: ${pixels.length} rays in ${ms.toFixed(1)} ms -> ${(ms / pixels.length).toFixed(3)} ms/ray, avg steps ${(steps / pixels.length).toFixed(1)} (cap ${caps}, disk ${disks}, esc ${escs})`);
  return ms / pixels.length;
}

const grid = [];
for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) grid.push([i / 11 * 2 - 1, j / 7 * 2 - 1]);
const per = bench(0.6, 26, 1.25, grid, 'a=0.6 r=26 FAST mixed');
for (const [w, h] of [[280, 190], [420, 285], [560, 380]]) {
  console.log(`estimate ${w}x${h}: ${(per * w * h / 1000).toFixed(0)} s`);
}
