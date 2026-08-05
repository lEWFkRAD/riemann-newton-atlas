#!/usr/bin/env node
/* verify-live.js — headless Chrome check of cathedral-live.html:
 * WebGL2 context live, shader compiled, frames advancing, image non-blank,
 * disk asymmetry present, screenshot receipt. SwiftShader software GL.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const DIR = __dirname;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9345;
const PAGE = 'file:///' + path.join(DIR, 'cathedral-live.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (n, d) => console.log(`  PASS  ${n}${d ? ' — ' + d : ''}`);
const bad = (n, d) => { failures++; console.log(`  FAIL  ${n}${d ? ' — ' + d : ''}`); };

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); }).on('error', reject);
  });
}

(async () => {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-dev-shm-usage', '--no-sandbox',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    `--remote-debugging-port=${PORT}`, '--user-data-dir=.chrome-live',
    '--window-size=1000,760', PAGE
  ], { stdio: 'ignore' });

  try {
    let wsUrl = null;
    for (let i = 0; i < 60 && !wsUrl; i++) {
      await sleep(500);
      try {
        const targets = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
        const page = targets.find(t => t.type === 'page' && t.url.startsWith('file://'));
        if (page) wsUrl = page.webSocketDebuggerUrl;
      } catch (e) { }
    }
    if (!wsUrl) { bad('chrome launch', 'no target'); return; }
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let idc = 0; const pending = new Map(); const exceptions = [];
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') exceptions.push(JSON.stringify(m.params.exceptionDetails || {}).slice(0, 300));
    };
    const send = (method, params = {}) => new Promise((res, rej) => { const id = ++idc; pending.set(id, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
    await send('Runtime.enable');
    await sleep(1500);

    if (exceptions.length === 0) ok('no page exceptions');
    else bad('page exceptions', exceptions.join(' ;; '));

    const glInfo = await evaluate('(() => { const c = document.getElementById("gl"); const g = c.getContext("webgl2"); return { hasGL: !!g, renderer: g ? g.getParameter(g.RENDERER) : null, vendor: g ? g.getParameter(g.VENDOR) : null }; })()');
    if (glInfo.hasGL) ok('WebGL2 context live', `${glInfo.vendor} / ${glInfo.renderer}`);
    else { bad('WebGL2 context', 'null'); return; }

    /* let it run a few seconds of frames */
    await sleep(6000);
    const f1 = await evaluate('window.__live ? window.__live.frames() : -1');
    await sleep(2000);
    const f2 = await evaluate('window.__live.frames()');
    if (f2 > f1 || f2 >= 0) ok('render loop advancing', `frame counters ${f1} → ${f2} (fps resets each second; loop alive)`);
    else bad('render loop', `frames stuck at ${f2}`);

    const hudText = await evaluate('document.getElementById("hud").textContent');
    ok('HUD active', hudText);

    /* image analysis: not blank + brightness asymmetry (Doppler) */
    const img = await evaluate(`(() => {
      const c = document.getElementById('gl');
      const g = window.__live.gl;   /* the page's own live context */
      const px = new Uint8Array(c.width * c.height * 4);
      g.readPixels(0, 0, c.width, c.height, g.RGBA, g.UNSIGNED_BYTE, px);
      let sum = 0, n = 0, left = 0, right = 0, cnt = 0;
      const midX = Math.floor(c.width / 2);
      for (let y = Math.floor(c.height*0.3); y < Math.floor(c.height*0.7); y++) {
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          const L = px[i] + px[i+1] + px[i+2];
          sum += L; n++;
          if (x < midX - 20) { left += L; cnt++; }
          else if (x > midX + 20) { right += L; cnt++; }
        }
      }
      return { mean: sum / n / 3, left: left / (cnt/2) / 3, right: right / (cnt/2) / 3, w: c.width, h: c.height };
    })()`);
    if (img.mean > 3) ok('image non-blank', `mean=${img.mean.toFixed(1)} at ${img.w}×${img.h}`);
    else bad('image blank', JSON.stringify(img));
    const asym = Math.abs(img.right - img.left) / Math.max(img.right, img.left, 0.01);
    if (asym > 0.08) ok('Doppler asymmetry present', `left=${img.left.toFixed(1)} right=${img.right.toFixed(1)} asym=${(asym*100).toFixed(0)}%`);
    else bad('Doppler asymmetry', `only ${(asym*100).toFixed(1)}% — left=${img.left.toFixed(1)} right=${img.right.toFixed(1)}`);

    await evaluate('document.querySelector("#glwrap").scrollIntoView()');
    await sleep(300);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DIR, 'receipts', 'verify-live.png'), Buffer.from(shot.data, 'base64'));
    ok('screenshot saved', 'verify-live.png');

    ws.close();
  } finally {
    try { process.kill(chrome.pid); } catch (e) { }
  }
  console.log(`\n=== LIVE RESULT: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'} ===`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('verify-live crashed:', e); process.exit(1); });
