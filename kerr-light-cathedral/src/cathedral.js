/* ============================================================================
 * THE KERR LIGHT CATHEDRAL — progressive gravitational-lensing observatory
 *
 * Pure-2D progressive ray tracer built on the numerical core above:
 *   - tile scheduler (candidate.tileOrder) → every pixel rendered exactly once
 *   - each tile traced in one animation frame (cancellable between tiles)
 *   - Hamiltonian geodesics via candidate.rk45Event with horizon/escape/disk
 *     event localization
 *   - LNRF camera tetrad rays (candidate.screenRay), Doppler+gravitational
 *     frequency shift on disk hits, asymptotic-direction lensed star field,
 *     photon-ring enhancement, Hamiltonian-drift instrumentation
 *
 * Appends itself to #candidate-cathedral. No external dependencies.
 * ==========================================================================*/
(() => {
  'use strict';
  const stage = document.getElementById('candidate-cathedral');
  if (!stage) return;

  /* inject observatory styles (starter CSS has no obs-* classes) */
  const style = document.createElement('style');
  style.textContent = `
  .obs-wrap{position:relative;margin-top:14px}
  .obs-overlay{position:absolute;top:8px;right:10px;padding:3px 9px;border-radius:999px;background:#05030acc;border:1px solid #3f2b55;font:11px ui-monospace,monospace;color:var(--cyan)}
  .obs-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px 14px;margin-top:12px}
  .ctl-row{display:flex;align-items:center;gap:8px;font-size:13px}
  .ctl-row label{min-width:88px;color:var(--muted)}
  .ctl-row input[type=range]{flex:1;accent-color:var(--gold)}
  .ctl-row output{min-width:44px;text-align:right;font:12px ui-monospace,monospace;color:var(--gold)}
  .ctl-row select{flex:1;background:#120b1d;color:var(--text);border:1px solid #3f2b55;border-radius:8px;padding:4px 6px}
  .obs-buttons{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
  .obs-status{margin-top:10px;font-size:13px;color:var(--muted);min-height:20px}
  .obs-info{margin-top:8px;border-top:1px dashed #372a44;padding-top:6px}
  .obs-info h4,.obs-plot h4{margin:6px 0;font-size:13px;color:var(--gold);letter-spacing:.06em;text-transform:uppercase}
  `;
  document.head.appendChild(style);

  stage.innerHTML = '';
  stage.setAttribute('aria-label', 'Interactive Kerr black hole lensing observatory');

  /* ------------------------- DOM construction --------------------------- */
  const el = (tag, attrs, parent) => {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (parent || stage).appendChild(n);
    return n;
  };

  const head = el('div', { class: 'obs-head' });
  el('h3', { text: 'Lensing observatory', style: 'margin:0 0 4px;font-size:17px' }, head);
  el('p', { text: 'Progressive Hamiltonian ray trace — each pixel integrated from the metric, never canned.', style: 'margin:0;color:var(--muted);font-size:13px' }, head);

  const wrap = el('div', { class: 'obs-wrap' });
  const canvas = el('canvas', { id: 'cathedral-view', width: '560', height: '380', tabindex: '0', 'aria-label': 'Kerr black hole render. Drag to orbit, arrow keys to pan. R to re-render.' }, wrap);
  const overlay = el('div', { class: 'obs-overlay', id: 'obs-overlay', text: 'idle' }, wrap);
  canvas.style.cssText = 'width:100%;height:auto;display:block;border-radius:10px;background:#020108;cursor:grab;outline-offset:3px';
  canvas.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); render(); } });

  const ctl = el('div', { class: 'obs-controls' });
  const mkCtl = (labelText, id, min, max, step, value) => {
    const row = el('div', { class: 'ctl-row' }, ctl);
    const lab = el('label', { for: id, text: labelText }, row);
    const inp = el('input', { type: 'range', id, min, max, step, value, 'aria-label': labelText }, row);
    const out = el('output', { for: id, text: value }, row);
    inp.addEventListener('input', () => { out.textContent = inp.value; });
    return inp;
  };
  const spinCtl = mkCtl('spin a/M', 'ctl-spin', '-0.99', '0.99', '0.01', '0.60');
  const inclCtl = mkCtl('inclination θ', 'ctl-incl', '0.06', '3.08', '0.02', '1.25');
  const distCtl = mkCtl('camera r/M', 'ctl-dist', '8', '60', '1', '26');
  const qualCtl = el('select', { id: 'ctl-quality', 'aria-label': 'Render quality' }, el('div', { class: 'ctl-row' }, ctl));
  for (const [v, t] of [['12', 'fast (12 px/tile)'], ['8', 'balanced (8 px/tile)'], ['4', 'fine (4 px/tile)']]) {
    el('option', { value: v, text: t, ...(v === '8' ? { selected: 'selected' } : {}) }, qualCtl);
  }

  const btnRow = el('div', { class: 'obs-buttons' });
  const renderBtn = el('button', { class: 'run', id: 'btn-render', text: 'Render cathedral' }, btnRow);
  const stopBtn = el('button', { class: 'run', id: 'btn-stop', text: 'Stop', disabled: 'disabled' }, btnRow);
  const exportBtn = el('button', { class: 'run', id: 'btn-export', text: 'Export PNG' }, btnRow);

  const status = el('div', { class: 'obs-status', id: 'obs-status', role: 'status', 'aria-live': 'polite', text: 'Ready. Drag the image to orbit, or press Render.' });

  const info = el('div', { class: 'obs-info', id: 'obs-info' }, null);
  info.innerHTML = '<h4>Ray inspector</h4><p id="obs-ray" style="margin:4px 0;font:12px ui-monospace,monospace;color:var(--cyan)">click the image to inspect a traced ray</p>';

  const plotBox = el('div', { class: 'obs-plot' });
  el('h4', { text: 'Hamiltonian drift |H(λ)−H₀| along last inspected ray', style: 'margin:8px 0 4px;font-size:13px' }, plotBox);
  const plot = el('canvas', { id: 'obs-plot-canvas', width: '560', height: '90', 'aria-label': 'Conserved Hamiltonian drift plot' }, plotBox);
  plot.style.cssText = 'width:100%;height:auto;display:block;background:#06040d;border:1px solid #2c2140;border-radius:8px';

  /* ----------------------------- state ---------------------------------- */
  const view = { yaw: 0.0, pitch: 0.0 };
  let jobToken = 0;          // cancellation token for the progressive scheduler
  let rendering = false;
  let diskStats = { hits: 0, escapes: 0, captures: 0 };
  let lastInspected = null;

  const cam = () => ({
    r: parseFloat(distCtl.value),
    theta: clamp(parseFloat(inclCtl.value) + view.pitch, 0.05, Math.PI - 0.05),
    phi: view.yaw,
    fov: 1.15
  });
  const M = 1;
  const spin = () => parseFloat(spinCtl.value);
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  const rpOf = (a) => M + Math.sqrt(Math.max(M * M - a * a, 0));
  const DISK_IN = 6.0, DISK_OUT = 18.0, ESCAPE_R = 90;

  /* Integration presets: the renderer uses the fast tier; the ray inspector
   * and any physics readout use the precise tier so reported drifts are real. */
  const FAST = { rtol: 2e-5, atol: 2e-7, maxSteps: 420, initialStep: 1.0, maxStep: 6.0 };
  const PRECISE = { rtol: 1e-9, atol: 1e-11, maxSteps: 1400, initialStep: 0.2 };

  /* --------------------------- shaders of logic -------------------------- */

  /* Trace one screen ray end-to-end. Returns:
   *   { kind:'disk'|'escape'|'capture', color:[r,g,b], H0, Hdrift, drift } */
  function traceRay(a, camera, pixel, recordDrift) {
    const ray = candidate.screenRay(M, a, camera, pixel);
    const y0 = ray.state;
    const rp = rpOf(a);
    const H0 = candidate.nullHamiltonian(M, a, y0);
    const drift = recordDrift ? [0] : null;
    let diskHit = null;
    let prevTh = null;

    const rhs = (t, y) => candidate.geodesicRHS(M, a, y);
    let minR = y0[1];
    const iopts = recordDrift ? PRECISE : FAST;
    const out = candidate.rk45Event(rhs, y0, 0, 2500, Object.assign({}, iopts, {
      event: (t, y) => (y[1] - rp * 1.0008) * (ESCAPE_R - y[1]),
      onStep: (t, y) => {
        if (y[1] < minR) minR = y[1];
        if (recordDrift && drift.length < 240) {
          drift.push(Math.abs(candidate.nullHamiltonian(M, a, y) - H0));
        }
        // thin-disk crossing: equatorial-plane SIGN CHANGE inside the annulus
        if (!diskHit && prevTh !== null) {
          const a0 = prevTh - Math.PI / 2, a1 = y[2] - Math.PI / 2;
          if (a0 * a1 < 0 && y[1] > DISK_IN && y[1] < DISK_OUT) {
            diskHit = { r: y[1], theta: y[2], state: y.slice(), t };
          }
        }
        prevTh = y[2];
      }
    }));

    const yf = out.y;
    const Hf = candidate.nullHamiltonian(M, a, yf);
    const driftMax = drift ? Math.max(...drift) : Math.abs(Hf - H0);

    /* 1. horizon capture — the shadow */
    if (out.event && yf[1] <= rp * 1.02) {
      return { kind: 'capture', color: [0, 0, 0], H0, Hdrift: driftMax, drift };
    }

    /* 2. disk crossing (first hit wins — optically thin assumption) */
    if (diskHit) {
      const s = diskHit.state;
      const rr = diskHit.r;
      const uEm = emitterVelocity(a, rr, s);
      const g = candidate.redshiftFactor([s[4], s[5], s[6], s[7]], ray.observerU, uEm);
      const color = diskColor(rr, a, g);
      return { kind: 'disk', color, H0, Hdrift: driftMax, drift, g, r: rr };
    }

    /* 3. escape — lensed star field sampled at asymptotic direction, plus
     *    photon-ring enhancement for rays whose closest approach grazed the
     *    photon orbit (r≈3M; emerges from bending, enhanced for visibility). */
    const d = candidate.geodesicRHS(M, a, yf);
    const dir = cartDir(a, yf, d);
    let col = starfield(dir);
    const rph = 2 * (1 + Math.cos((2 / 3) * Math.acos(-clamp(a, -1, 1))));  // prograde photon orbit
    const dn = Math.abs(minR - rph);
    if (dn < 0.9) {
      const glow = 0.5 * Math.exp(-(dn * dn) / 0.045);
      col = [col[0] + glow, col[1] + glow * 0.82, col[2] + glow * 0.45];
    }
    return { kind: 'escape', color: col, H0, Hdrift: driftMax, drift };
  }

  /* Keplerian emitter 4-velocity in BL coordinates (prograde, equatorial). */
  function emitterVelocity(a, r, s) {
    const th = s[2];
    const Omega = 1 / (Math.pow(r, 1.5) + a);           // M=1
    const g = candidate.kerrMetricBL(M, a, r, th);
    const A1 = g[0][0] + 2 * g[0][3] * Omega + g[3][3] * Omega * Omega;
    const ut = A1 < 0 ? 1 / Math.sqrt(-A1) : 1;
    return [ut, 0, 0, ut * Omega];
  }

  /* Thin-disk color: T ∝ r^-3/4 blackbody tint × Doppler/grav beaming g^3,
   * with inner-edge gravitational reddening and a soft outer falloff. */
  function diskColor(r, a, g) {
    const T = Math.pow(6 / r, 0.75);
    const beaming = g * g * g;
    let rr = T * (0.9 + 0.6 * Math.min(beaming, 3));
    let gg = T * T * (0.75 + 0.5 * Math.min(beaming, 3));
    let bb = T * T * T * (0.55 + 0.5 * Math.min(beaming, 3));
    // blueshift pushes toward cyan-white, redshift toward ember
    if (g > 1) { bb *= Math.min(g * g, 2.2); gg *= Math.min(g, 1.5); }
    else { rr *= Math.min(1 / Math.max(g, 0.4), 2.0); bb *= Math.max(g * g, 0.15); }
    const edge = clamp((r - DISK_IN) / 1.2, 0, 1) * clamp((DISK_OUT - r) / 2.5, 0, 1);
    const lum = 1.15 * beaming * edge;
    return [rr * lum, gg * lum, bb * lum];
  }

  /* Convert asymptotic coordinate velocity to a Cartesian direction. */
  function cartDir(a, y, d) {
    const r = y[1], th = y[2], ph = y[3];
    const st = Math.sin(th), ct = Math.cos(th), sp = Math.sin(ph), cp = Math.cos(ph);
    const vx = d[1] * st * cp + r * (d[2] * ct * cp - d[3] * st * sp);
    const vy = d[1] * st * sp + r * (d[2] * ct * sp + d[3] * st * cp);
    const vz = d[1] * ct - r * d[2] * st;
    const n = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    return [vx / n, vy / n, vz / n];
  }

  /* Deterministic hash star field on the celestial sphere. */
  const hash11 = (n) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
  function starfield(dir) {
    const th = Math.acos(clamp(dir[2], -1, 1));
    const ph = Math.atan2(dir[1], dir[0]);
    let r = 0, g = 0, b = 0;
    // Milky-Way band
    const mw = Math.exp(-Math.pow(Math.sin(th - 1.35), 2) / 0.08);
    r += 0.045 * mw; g += 0.06 * mw; b += 0.13 * mw;
    for (let oct = 1; oct <= 3; oct++) {
      const sc = oct * 9;
      const gx = ph * sc, gy = th * sc;
      const ix = Math.floor(gx), iy = Math.floor(gy);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const cx = ix + dx, cy = iy + dy;
        const h = hash11(cx * 73856093 + cy * 19349663 + oct * 12345);
        if (h < 0.82) continue;
        const sx = cx + hash11(h * 7.13), sy = cy + hash11(h * 3.71);
        const dd = Math.hypot(gx - sx, gy - sy);
        const size = 0.05 + 0.10 * hash11(h + 1);
        const inten = Math.exp(-(dd * dd) / (size * size)) * (0.5 + 0.9 * hash11(h + 2));
        const tcol = hash11(h + 3);
        if (tcol < 0.4) { r += 0.32 * inten; g += 0.42 * inten; b += 0.75 * inten; }
        else if (tcol < 0.75) { r += 0.72 * inten; g += 0.66 * inten; b += 0.5 * inten; }
        else { r += 0.8 * inten; g += 0.45 * inten; b += 0.3 * inten; }
      }
    }
    return [r * 0.75, g * 0.75, b * 0.75];
  }

  /* ---------------------- progressive tile scheduler --------------------- */

  function render() {
    if (rendering) { jobToken++; }         // cancel any in-flight job
    const token = ++jobToken;
    rendering = true;
    renderBtn.disabled = true;
    stopBtn.disabled = false;
    diskStats = { hits: 0, escapes: 0, captures: 0 };

    const a = spin();
    const camera = cam();
    const tile = parseInt(qualCtl.value, 10);
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#020108'; ctx.fillRect(0, 0, W, H);
    const tiles = candidate.tileOrder(W, H, tile);
    let ti = 0;
    const t0 = performance.now();

    const doTile = (t) => {
      const img = ctx.createImageData(t.w, t.h);
      for (let py = 0; py < t.h; py++) for (let px = 0; px < t.w; px++) {
        const nx = ((t.x + px + 0.5) / W) * 2 - 1;
        const ny = 1 - ((t.y + py + 0.5) / H) * 2;
        const res = traceRay(a, camera, { x: nx, y: ny }, false);
        if (res.kind === 'disk') diskStats.hits++;
        else if (res.kind === 'escape') diskStats.escapes++;
        else diskStats.captures++;
        const o = (py * t.w + px) * 4;
        img.data[o] = Math.min(255, Math.pow(res.color[0], 0.85) * 255);
        img.data[o + 1] = Math.min(255, Math.pow(res.color[1], 0.85) * 255);
        img.data[o + 2] = Math.min(255, Math.pow(res.color[2], 0.85) * 255);
        img.data[o + 3] = 255;
      }
      ctx.putImageData(img, t.x, t.y);
    };

    const stepFrame = () => {
      if (token !== jobToken) { rendering = false; return; }   // cancelled
      const budget = performance.now() + 46;                    // ~20fps cadence
      while (ti < tiles.length && performance.now() < budget) {
        doTile(tiles[ti]); ti++;
      }
      const pct = Math.round(100 * ti / tiles.length);
      overlay.textContent = `tracing ${pct}%`;
      status.textContent = `Rendering… ${pct}% (${ti}/${tiles.length} tiles)`;
      if (ti < tiles.length) {
        requestAnimationFrame(stepFrame);
      } else {
        rendering = false;
        renderBtn.disabled = false;
        stopBtn.disabled = true;
        overlay.textContent = 'done';
        const secs = ((performance.now() - t0) / 1000).toFixed(1);
        status.textContent =
          `Rendered ${W}×${H} in ${secs}s — disk hits ${diskStats.hits}, ` +
          `escaped ${diskStats.escapes}, captured ${diskStats.captures}. ` +
          `Click the image to inspect a ray.`;
      }
    };
    requestAnimationFrame(stepFrame);
  }

  /* ------------------------------ controls ------------------------------- */

  renderBtn.addEventListener('click', render);
  stopBtn.addEventListener('click', () => {
    jobToken++; rendering = false;
    renderBtn.disabled = false; stopBtn.disabled = true;
    overlay.textContent = 'stopped';
    status.textContent = 'Render cancelled between tiles — partial image kept.';
  });
  exportBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `kerr-cathedral-a${spinCtl.value}-r${distCtl.value}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  /* drag to orbit */
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    view.yaw += (e.clientX - lastX) * 0.008;
    view.pitch = clamp(view.pitch - (e.clientY - lastY) * 0.006, -1.2, 1.2);
    lastX = e.clientX; lastY = e.clientY;
    status.textContent = `Orbiting: yaw ${view.yaw.toFixed(2)}, pitch ${view.pitch.toFixed(2)}. Release to re-render.`;
  });
  canvas.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = 'grab';
    canvas.releasePointerCapture(e.pointerId);
    render();
  });

  /* re-render on parameter change (debounced) */
  let deb = null;
  for (const c of [spinCtl, inclCtl, distCtl, qualCtl]) {
    c.addEventListener('change', () => {
      clearTimeout(deb);
      deb = setTimeout(render, 120);
    });
  }

  /* ray inspector */
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((e.clientY - rect.top) / rect.height) * 2;
    const a = spin(), camera = cam();
    const res = traceRay(a, camera, { x: nx, y: ny }, true);
    const rayEl = document.getElementById('obs-ray');
    const line = [];
    line.push(res.kind === 'capture' ? '⬛ captured by the horizon' :
      res.kind === 'disk' ? `🟠 disk hit at r=${res.r.toFixed(3)}M, g=${res.g.toFixed(4)}` :
        '✨ escaped to the star field');
    line.push(`|ΔH|max = ${res.Hdrift.toExponential(2)} (H₀=${res.H0.toExponential(2)})`);
    rayEl.textContent = line.join(' · ');
    lastInspected = res;
    drawPlot(res.drift || [res.Hdrift]);
  });

  function drawPlot(series) {
    const c = plot, x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = '#06040d'; x.fillRect(0, 0, c.width, c.height);
    if (!series || series.length < 2) return;
    const mx = Math.max(...series, 1e-16);
    x.strokeStyle = '#3a2a55';
    x.beginPath(); x.moveTo(0, c.height - 14); x.lineTo(c.width, c.height - 14); x.stroke();
    x.strokeStyle = '#55e6ff'; x.lineWidth = 1.5;
    x.beginPath();
    for (let i = 0; i < series.length; i++) {
      const px = (i / (series.length - 1)) * (c.width - 8) + 4;
      const py = c.height - 14 - (Math.log10(Math.max(series[i], 1e-18) / mx) + 18) / 18 * -(c.height - 24);
      const vv = c.height - 14 - clamp((Math.log10(series[i] / 1e-16) / 16) * (c.height - 24), 0, c.height - 24);
      if (i === 0) x.moveTo(px, vv); else x.lineTo(px, vv);
    }
    x.stroke();
    x.fillStyle = '#bcaec7'; x.font = '10px ui-monospace,monospace';
    x.fillText('log10 |ΔH| over accepted steps (cyan = drift series)', 8, 12);
  }

  /* keyboard access for sliders is native; add global shortcut */
  document.addEventListener('keydown', e => {
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
      render();
    }
  });

  /* initial paint hint */
  overlay.textContent = 'press Render';

  /* headless-test hook (used by verify-chrome.js; harmless in a browser) */
  window.__cathedral = {
    render,
    traceRay,
    stats: () => Object.assign({}, diskStats),
    setResolution(w, h) { canvas.width = w; canvas.height = h; },
    overlayText: () => overlay.textContent,
    statusText: () => status.textContent
  };
})();
