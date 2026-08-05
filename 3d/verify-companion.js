// RN-Atlas 3D companion verification — headless Chrome + SwiftShader.
// Boots the self-contained atlas3d.html, checks math stats, preset switch,
// coefficient-editor path, the root-drag pipeline, and framebuffer content.
// Requires: npm install (puppeteer-core) and Google Chrome at the default path.
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'file:///' + path.resolve(__dirname, 'atlas3d.html').replace(/\\/g, '/');
const SHOTS = path.resolve(__dirname, 'shots');

(async () => {
  require('fs').mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
           '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    defaultViewport: { width: 1400, height: 900, deviceScaleFactor: 1 }
  });
  const page = await browser.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('requestfailed', r => problems.push('reqfail: ' + r.url()));

  console.log('goto', URL);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__pageReady === true, { timeout: 90000 });
  const fatal = await page.evaluate(() => window.__fatal || null);
  if (fatal) problems.push('fatal: ' + fatal);

  const s0 = await page.evaluate(() => window.__getStats());
  console.log('BOOT   :', JSON.stringify(s0));
  if (!s0 || !s0.classified) problems.push('no classified pixels at boot');
  if (!s0 || !(s0.entropy > 0.9)) problems.push('boot entropy suspiciously low');
  if (!s0 || !(s0.dim > 1.0 && s0.dim < 1.6)) problems.push('boot boundary dim outside expected z^3-1 range');
  if (!s0 || !(s0.curves > 0)) problems.push('no flow curves built');

  const px = await page.evaluate(() => {
    const c = document.getElementById('scene-canvas');
    const off = document.createElement('canvas');
    off.width = c.width; off.height = c.height;
    const octx = off.getContext('2d');
    octx.drawImage(c, 0, 0);
    const d = octx.getImageData(0, 0, c.width, c.height).data;
    let lit = 0, colored = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] + d[i + 1] + d[i + 2] > 40) lit++;
      if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 24) colored++;
    }
    return { litPct: lit / (d.length / 4), colPct: colored / (d.length / 4) };
  });
  console.log('PIXELS :', JSON.stringify(px));
  if (px.litPct < 0.15) problems.push('framebuffer mostly black');
  if (px.colPct < 0.05) problems.push('framebuffer nearly colorless');

  await page.evaluate(() => window.__setPreset(4));
  await new Promise(r => setTimeout(r, 400));
  const s12 = await page.evaluate(() => window.__getStats());
  console.log('DEG-12 :', JSON.stringify(s12));
  if (!s12 || s12.degree !== 12) problems.push('preset 4 did not yield degree 12');

  await page.evaluate(() => window.__applyCoeffs('1 0\n0 0\n-2 0\n1 0'));
  await new Promise(r => setTimeout(r, 400));
  const sc = await page.evaluate(() => window.__getStats());
  console.log('CUSTOM :', JSON.stringify(sc));
  if (!sc || sc.degree !== 3) problems.push('custom coefficients did not yield degree 3');

  // Drag pipeline: move root 0 to (0.2, 0.9), re-solve, check coverage.
  await page.evaluate(() => window.__setPreset(0));
  await new Promise(r => setTimeout(r, 400));
  const before = await page.evaluate(() => window.__getRoots());
  const moved = await page.evaluate(() => window.__moveRoot(0, 0.2, 0.9));
  const after = await page.evaluate(() => ({ roots: window.__getRoots(), stats: window.__getStats() }));
  console.log('DRAG   :', JSON.stringify({ moved, dim: after.stats.dim, classified: after.stats.classified }));
  if (Math.abs(after.roots[0].re - 0.2) > 1e-9 || Math.abs(after.roots[0].im - 0.9) > 1e-9)
    problems.push('dragged root did not land on target');
  if (!after.stats || after.stats.classified / after.stats.total < 0.9)
    problems.push('post-drag classification coverage < 90%');
  if (after.stats.dim === s0.dim && after.stats.segments === s0.segments)
    problems.push('drag produced no boundary geometry change');
  const lines = (await page.evaluate(() => document.getElementById('coeffs').value)).trim().split('\n');
  if (lines.length !== 4) problems.push('editor not synced after drag (' + lines.length + ' lines)');

  // Screenshots for the receipts.
  await page.evaluate(() => window.__setPreset(0));
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { window.__frameCamera(30, 42, 8.5); window.__captureFrame(); });
  await page.screenshot({ path: path.join(SHOTS, 'hero.png') });
  await page.evaluate(() => window.__setPreset(4));
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { window.__frameCamera(110, 55, 9.5); window.__captureFrame(); });
  await page.screenshot({ path: path.join(SHOTS, 'degree12.png') });

  await browser.close();
  if (problems.length) {
    console.log('\n=== COMPANION CHECK: FAIL ===');
    problems.forEach(p => console.log(' -', p));
    process.exit(1);
  }
  console.log('\n=== COMPANION CHECK: ALL CHECKS PASS (headless SwiftShader) ===');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
