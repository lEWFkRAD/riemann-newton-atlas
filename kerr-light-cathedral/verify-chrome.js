#!/usr/bin/env node
/* verify-chrome.js — headless Chrome end-to-end gate:
 *   1. frozen-grader integrity (starter vs assembled, SHA-256 of the block)
 *   2. load page in headless Chrome, click the grader button, require 100/100
 *   3. renderer smoke: low-res progressive render to completion, pixel census
 *      (every pixel classified exactly once), non-blank image, console-clean
 *   4. screenshot receipt of the finished render
 * Uses CDP (Chrome DevTools Protocol) over the built-in WebSocket. No deps.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const http = require('http');

const DIR = __dirname;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9337;
const PAGE = 'file:///' + path.join(DIR, 'index.html').replace(/\\/g, '/');

let failures = 0;
const ok = (name, detail) => console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
const bad = (name, detail) => { failures++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); };

/* ---------- 1. frozen grader integrity ---------- */
function graderBlock(file) {
  const html = fs.readFileSync(file, 'utf8');
  const mark = '/* FROZEN VISIBLE GRADER';
  const i = html.indexOf(mark);
  if (i < 0) return null;
  const j = html.indexOf('Object.freeze(candidate);', i);
  return html.slice(i, j + 'Object.freeze(candidate);'.length);
}
const gA = graderBlock(path.join(DIR, 'index.starter.html'));
const gB = graderBlock(path.join(DIR, 'index.html'));
if (gA && gB && crypto.createHash('sha256').update(gA).digest('hex') === crypto.createHash('sha256').update(gB).digest('hex')) {
  ok('frozen grader byte-identical', 'sha256 match starter↔assembled');
} else {
  bad('frozen grader integrity', 'grader block differs or missing');
}

/* ---------- CDP plumbing ---------- */
function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function connectCDP(wsUrl) {
  let lastErr;
  for (let i = 0; i < 40; i++) {
    try {
      const ws = new WebSocket(wsUrl);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      return ws;
    } catch (e) { lastErr = e; await sleep(250); }
  }
  throw lastErr;
}

class Session {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, awaitPromise = false) {
    const r = await this.send('Runtime.evaluate', {
      expression, awaitPromise, returnByValue: true, timeout: 300000
    });
    if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  }
}

async function main() {
  const userData = path.join(DIR, '.chrome-profile');
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${userData}`,
    '--window-size=1280,900', PAGE
  ], { stdio: 'ignore' });

  let wsUrl = null;
  try {
    /* wait for the target */
    for (let i = 0; i < 60 && !wsUrl; i++) {
      await sleep(500);
      try {
        const targets = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
        const page = targets.find(t => t.type === 'page' && t.url.startsWith('file://'));
        if (page) wsUrl = page.webSocketDebuggerUrl;
      } catch (e) { /* not up yet */ }
    }
    if (!wsUrl) { bad('headless chrome launch', 'no page target found'); return; }
    ok('headless chrome attached', 'CDP page target');

    const ws = await connectCDP(wsUrl);
    const s = new Session(ws);
    const consoleMsgs = [], pageExceptions = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && s.pending.has(m.id)) {
        const p = s.pending.get(m.id); s.pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
      } else if (m.method === 'Runtime.consoleAPICalled') {
        consoleMsgs.push((m.params.args || []).map(a => a.value || a.description || '').join(' '));
      } else if (m.method === 'Runtime.exceptionThrown') {
        pageExceptions.push(JSON.stringify(m.params.exceptionDetails || {}).slice(0, 300));
      }
    };
    await s.send('Runtime.enable');
    await s.send('Page.enable');

    /* wait for app-ready */
    await sleep(1200);
    const hooked = await s.evaluate('typeof window.__cathedral === "object" && typeof candidate === "object"');
    if (!hooked) { bad('page boot', '__cathedral or candidate missing'); return; }
    ok('page boot', 'candidate + observatory live');

    /* ---------- 2. frozen grader: click Run, require 100 ---------- */
    await s.evaluate('document.getElementById("run").click()');
    let score = 0, statusText = '';
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      score = await s.evaluate('parseInt(document.getElementById("score").textContent,10)');
      statusText = await s.evaluate('document.getElementById("status").textContent');
      if (statusText.includes('pass') || statusText.includes('incomplete')) break;
    }
    const perTest = await s.evaluate(
      '[...document.querySelectorAll("#tests li")].map(li=>li.textContent.trim()).join(" | ")');
    if (score === 100) ok('visible grader in Chrome', `score 100/100 — "${statusText}"`);
    else bad('visible grader in Chrome', `score ${score}/100 — "${statusText}" :: ${perTest}`);
    console.log('  grader lines:', perTest);

    /* ---------- 3. renderer smoke at low res ---------- */
    const W = 168, H = 112;
    await s.evaluate(`window.__cathedral.setResolution(${W},${H}); document.getElementById('ctl-quality').value='12'; window.__cathedral.render()`);
    let overlay = '';
    for (let i = 0; i < 240; i++) {
      await sleep(500);
      overlay = await s.evaluate('window.__cathedral.overlayText()');
      if (overlay === 'done' || overlay === 'stopped') break;
    }
    if (overlay !== 'done') { bad('renderer completion', `overlay="${overlay}"`); return; }
    const finalStatus = await s.evaluate('window.__cathedral.statusText()');
    ok('renderer completed', finalStatus);

    const stats = await s.evaluate('window.__cathedral.stats()');
    const total = stats.hits + stats.escapes + stats.captures;
    if (total === W * H) ok('pixel census exact', `${total}/${W * H} rays classified (disk ${stats.hits}, escape ${stats.escapes}, capture ${stats.captures})`);
    else bad('pixel census', `${total} != ${W * H}`);
    if (stats.captures > 0 && stats.hits > 0 && stats.escapes > 0) {
      ok('all three ray classes present', `shadow ${stats.captures}, disk ${stats.hits}, stars ${stats.escapes}`);
    } else bad('ray class coverage', JSON.stringify(stats));

    /* image statistics: not blank, shadow exists, disk glow exists */
    const img = await s.evaluate(`(() => {
      const c = document.getElementById('cathedral-view');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let sum = 0, n = 0, bright = 0, dark = 0;
      for (let i = 0; i < d.length; i += 4) {
        const L = d[i] + d[i+1] + d[i+2];
        sum += L; n++;
        if (L > 420) bright++;
        if (L < 12) dark++;
      }
      return { mean: sum / n / 3, bright, dark };
    })()`);
    if (img.mean > 4 && img.bright > 50) ok('image non-blank', `mean=${img.mean.toFixed(1)} bright=${img.bright} dark=${img.dark}`);
    else bad('image statistics', JSON.stringify(img));
    if (img.dark > 100) ok('black-hole shadow present', `${img.dark} near-black pixels`);
    else bad('shadow presence', `only ${img.dark} near-black pixels`);

    /* ---------- 4. screenshot receipt (observatory in view) ---------- */
    await s.evaluate('document.getElementById("candidate-cathedral").scrollIntoView({block:"start"})');
    await sleep(400);
    const shot = await s.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DIR, 'receipts', 'verify-chrome.png'), Buffer.from(shot.data, 'base64'));
    ok('screenshot saved', 'verify-chrome.png (observatory scrolled into view)');
    const canvasPng = await s.evaluate('document.getElementById("cathedral-view").toDataURL("image/png")');
    fs.writeFileSync(path.join(DIR, 'receipts', 'verify-chrome-canvas.png'), Buffer.from(canvasPng.split(',')[1], 'base64'));
    ok('canvas receipt saved', 'verify-chrome-canvas.png (raw 168×112 render)');

    /* console hygiene */
    if (pageExceptions.length === 0) ok('no page exceptions', `${consoleMsgs.length} console messages`);
    else bad('page exceptions', pageExceptions.join(' ;; '));
    for (const m of consoleMsgs.slice(0, 5)) console.log('  console:', m.slice(0, 160));

    ws.close();
  } finally {
    try { process.kill(chrome.pid); } catch (e) { /* already gone */ }
  }

  console.log(`\n=== CHROME RESULT: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'} ===`);
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error('verify-chrome crashed:', e); process.exit(1); });
