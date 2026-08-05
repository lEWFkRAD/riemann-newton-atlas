#!/usr/bin/env node
/* receipt-shot.js — full-resolution render receipt:
 *   560×380 balanced-quality progressive render in headless Chrome,
 *   saves the finished canvas as cathedral-render.png. Background-friendly:
 *   prints progress to stdout; exits 0 on success.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const DIR = __dirname;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9341;
const PAGE = 'file:///' + path.join(DIR, 'index.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); }).on('error', reject);
  });
}

(async () => {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    `--remote-debugging-port=${PORT}`, '--user-data-dir=.chrome-receipt',
    '--window-size=1280,900', PAGE
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
    if (!wsUrl) throw new Error('no CDP target');
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let idc = 0; const pending = new Map();
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } };
    const send = (method, params = {}) => new Promise((res, rej) => { const id = ++idc; pending.set(id, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
    await send('Runtime.enable');
    await sleep(1200);

    await evaluate('window.__cathedral.setResolution(560,380); document.getElementById("ctl-quality").value="8"; window.__cathedral.render()');
    console.log('full-res render started (560×380, quality balanced)…');
    const t0 = Date.now();
    let overlay = '';
    for (let i = 0; i < 2400; i++) {
      await sleep(2000);
      overlay = await evaluate('window.__cathedral.overlayText()');
      if (i % 5 === 0) console.log(`  …${Math.round((Date.now() - t0) / 1000)}s elapsed, overlay=${overlay}`);
      if (overlay === 'done' || overlay === 'stopped') break;
    }
    if (overlay !== 'done') throw new Error('render did not finish: ' + overlay);
    const status = await evaluate('window.__cathedral.statusText()');
    console.log('render status:', status);

    const stats = await evaluate('window.__cathedral.stats()');
    console.log('stats:', JSON.stringify(stats));
    if (stats.hits + stats.escapes + stats.captures !== 560 * 380) throw new Error('pixel census mismatch');

    const dataUrl = await evaluate('document.getElementById("cathedral-view").toDataURL("image/png")');
    fs.writeFileSync(path.join(DIR, 'receipts', 'cathedral-render.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('saved cathedral-render.png');
    ws.close();
  } finally {
    try { process.kill(chrome.pid); } catch (e) { }
  }
  console.log('RECEIPT-SHOT: SUCCESS');
})().catch(e => { console.error('RECEIPT-SHOT FAILED:', e); process.exit(1); });
