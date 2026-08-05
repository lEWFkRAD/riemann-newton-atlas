#!/usr/bin/env node
/* assemble.js — build the final index.html from starter + src/core.js + src/cathedral.js */
'use strict';
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const starter = fs.readFileSync(path.join(dir, 'index.starter.html'), 'utf8');
const core = fs.readFileSync(path.join(dir, 'src', 'core.js'), 'utf8');
const cathedral = fs.readFileSync(path.join(dir, 'src', 'cathedral.js'), 'utf8');

const startMark = '/* ==================== CANDIDATE IMPLEMENTATION: EDIT THIS BLOCK ==================== */';
const endMark = '/* ================== END CANDIDATE IMPLEMENTATION: DO NOT CROSS ================== */';

const i0 = starter.indexOf(startMark);
const i1 = starter.indexOf(endMark);
if (i0 < 0 || i1 < 0) { console.error('candidate block markers not found'); process.exit(1); }

const head = starter.slice(0, i0 + startMark.length);
const tail = starter.slice(i1);

let html = head + '\n' + core + '\n' + tail;

/* append the observatory as a second script after the main one */
const closeScript = '</script>\n</body>';
const j = html.lastIndexOf(closeScript);
if (j < 0) { console.error('closing script/body not found'); process.exit(1); }
html = html.slice(0, j) + '</script>\n<script>\n' + cathedral + '\n</script>\n</body>' + html.slice(j + closeScript.length);

fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log('assembled index.html:', html.length, 'bytes');

/* sanity: markers and frozen grader intact, candidate defined exactly once */
const checks = [
  ['start marker', html.includes(startMark)],
  ['end marker', html.includes(endMark)],
  ['frozen grader intact', html.includes("const frozen=document.currentScript.textContent.split('/* FROZEN VISIBLE GRADER')[1]")],
  ['candidate defined once', (html.match(/const candidate\s*=/g) || []).length === 1],
  ['cathedral attached', html.includes('candidate-cathedral') && html.includes('Lensing observatory')],
  ['no TODO left', !/\/\* TODO \*\//.test(html)],
];
let bad = 0;
for (const [name, ok] of checks) { console.log((ok ? 'OK  ' : 'BAD ') + name); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
