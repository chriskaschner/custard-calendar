#!/usr/bin/env node
/**
 * Build the QA gallery HTML for reviewing AI-generated cone candidates.
 * Culver's flavors only. Shows ingredients + Culver's reference photo.
 *
 * Usage: node tools/build_qa_gallery.mjs
 * Output: docs/ai-cone-qa.html
 */

import fs from 'node:fs';
import path from 'node:path';

const fills = JSON.parse(fs.readFileSync('docs/assets/masterlock-flavor-fills.json', 'utf-8'));
const culversKeys = JSON.parse(fs.readFileSync('tools/culvers_flavors.json', 'utf-8'));
const culversSet = new Set(culversKeys);

let culversUrls = {};
try {
  culversUrls = JSON.parse(fs.readFileSync('docs/assets/culvers-image-urls.json', 'utf-8'));
} catch {}

const CANDIDATES_DIR = 'docs/assets/ai-candidates';
const NOT_PICTURED = 'img-fotd-notpictured.png';

function flavorSlug(key) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Build flavor data - Culver's only
const flavors = fills.flavors
  .filter(f => culversSet.has(f.flavor_key))
  .map(f => {
    const slug = flavorSlug(f.flavor_key);
    const dir = path.join(CANDIDATES_DIR, slug);
    let candidates = [];
    try {
      candidates = fs.readdirSync(dir)
        .filter(name => name.endsWith('.png') && !name.includes('-processed') && !name.includes('medium-') && !name.includes('high-'))
        .sort();
      if (candidates.length === 0) {
        candidates = fs.readdirSync(dir)
          .filter(name => name.endsWith('.png') && !name.includes('-processed'))
          .sort();
      }
    } catch {}

    const culversUrl = culversUrls[f.flavor_key];
    const hasRef = culversUrl && !culversUrl.includes(NOT_PICTURED);

    const po = f.premium_treatment_override || {};

    return {
      key: f.flavor_key,
      title: f.title,
      slug,
      description: f.description || '',
      ingredients: {
        base: po.base || '',
        swirls: po.swirls || '',
        chunks: po.chunks || '',
        texture: po.texture || '',
      },
      candidates,
      culversUrl: hasRef ? culversUrl : null,
    };
  });

const flavorCount = flavors.length;

// Generate HTML
const flavorRows = flavors.map(f => {
  const candidateImgs = f.candidates.map((c, i) => `
        <div class="candidate" data-flavor="${f.slug}" data-index="${i + 1}" onclick="selectCandidate(this)">
          <img src="assets/ai-candidates/${f.slug}/${c}" loading="lazy" />
          <span class="label">#${i + 1}</span>
        </div>`).join('');

  const refCol = f.culversUrl
    ? `<div class="ref-col"><img src="${f.culversUrl}" loading="lazy" /><span class="ref-label">Culver's ref</span></div>`
    : `<div class="ref-col empty"><span class="ref-label">No ref</span></div>`;

  // Escape HTML in ingredient text
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `
    <div class="flavor-row" data-flavor="${f.slug}" data-status="pending">
      <div class="flavor-info">
        <span class="flavor-name">${esc(f.title)}</span>
        <span class="flavor-desc">${esc(f.description)}</span>
        ${refCol}
        <details class="ingredients">
          <summary>Prompt details</summary>
          <div class="ing-item"><b>Base:</b> ${esc(f.ingredients.base)}</div>
          <div class="ing-item"><b>Swirls:</b> ${esc(f.ingredients.swirls)}</div>
          <div class="ing-item"><b>Chunks:</b> ${esc(f.ingredients.chunks)}</div>
          <div class="ing-item"><b>Texture:</b> ${esc(f.ingredients.texture)}</div>
        </details>
      </div>
      <div class="candidates">
        ${candidateImgs}
      </div>
      <div class="actions">
        <button class="flag-btn" onclick="flagFlavor('${f.slug}')">Flag</button>
      </div>
    </div>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AI Cone QA - Culver's (${flavorCount} Flavors)</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0e1117; color: #e6edf3; font-family: system-ui, sans-serif; padding: 16px; }

  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
  h1 { font-size: 18px; }
  .progress { font-size: 14px; color: #8b949e; }
  .progress-bar { width: 200px; height: 8px; background: #21262d; border-radius: 4px; overflow: hidden; }
  .progress-fill { height: 100%; background: #6dd49b; transition: width 0.3s; }

  .filters { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .filters button { background: #21262d; color: #e6edf3; border: 1px solid #30363d; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .filters button.active { background: #388bfd; border-color: #388bfd; }
  .filters input { background: #21262d; color: #e6edf3; border: 1px solid #30363d; padding: 4px 8px; border-radius: 4px; font-size: 12px; width: 200px; }

  .flavor-row { display: flex; gap: 8px; align-items: flex-start; padding: 12px; margin-bottom: 4px; border: 1px solid #21262d; border-radius: 6px; background: #161b22; }
  .flavor-row.focused { border-color: #58a6ff; }
  .flavor-row[data-status="approved"] { border-color: #238636; }
  .flavor-row[data-status="flagged"] { border-color: #da3633; }
  .flavor-row.hidden { display: none; }

  .flavor-info { width: 180px; flex-shrink: 0; }
  .flavor-name { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .flavor-desc { display: block; font-size: 11px; color: #8b949e; margin-bottom: 6px; line-height: 1.3; }
  .ref-col { margin-bottom: 6px; }
  .ref-col img { width: 120px; height: auto; border-radius: 4px; background: #fff; }
  .ref-col.empty { height: 40px; display: flex; align-items: center; }
  .ref-label { display: block; font-size: 10px; color: #8b949e; margin-top: 2px; }

  .ingredients { font-size: 10px; color: #8b949e; margin-top: 4px; }
  .ingredients summary { cursor: pointer; color: #58a6ff; }
  .ingredients summary:hover { text-decoration: underline; }
  .ing-item { margin: 2px 0; line-height: 1.3; }
  .ing-item b { color: #c9d1d9; }

  .candidates { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; }
  .candidate { position: relative; cursor: pointer; border: 3px solid transparent; border-radius: 4px; transition: border-color 0.15s; }
  .candidate:hover { border-color: #58a6ff; }
  .candidate.selected { border-color: #6dd49b; }
  .candidate img { display: block; width: 120px; height: 140px; object-fit: contain; background: repeating-conic-gradient(#2d333b 0% 25%, #22272e 0% 50%) 0 0 / 12px 12px; border-radius: 2px; }
  .candidate .label { position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.7); color: #e6edf3; font-size: 9px; padding: 1px 5px; border-radius: 2px; }

  .actions { width: 50px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; }
  .flag-btn { background: #21262d; color: #da3633; border: 1px solid #30363d; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; }
  .flag-btn:hover { background: #da3633; color: #fff; }

  .export-bar { position: sticky; bottom: 0; background: #0e1117; border-top: 1px solid #30363d; padding: 12px; display: flex; gap: 12px; align-items: center; }
  .export-bar button { background: #238636; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
  .export-bar button:hover { background: #2ea043; }
</style>
</head>
<body>

<div class="header">
  <h1>AI Cone QA - Culver's Only</h1>
  <div class="progress">
    <span id="count">0</span>/${flavorCount} approved
    <div class="progress-bar"><div class="progress-fill" id="bar" style="width:0%"></div></div>
  </div>
</div>

<div class="filters">
  <button class="active" onclick="filterRows('all', this)">All (${flavorCount})</button>
  <button onclick="filterRows('pending', this)">Pending</button>
  <button onclick="filterRows('approved', this)">Approved</button>
  <button onclick="filterRows('flagged', this)">Flagged</button>
  <input type="text" id="search" placeholder="Search flavor..." oninput="filterBySearch(this.value)" />
</div>

${flavorRows}

<div class="export-bar">
  <button onclick="exportManifest()">Export Manifest JSON</button>
  <span id="export-status" style="color:#8b949e;font-size:12px;"></span>
</div>

<script>
const TOTAL = ${flavorCount};
const state = JSON.parse(localStorage.getItem('ai-cone-qa-culvers') || '{}');

document.querySelectorAll('.flavor-row').forEach(row => {
  const slug = row.dataset.flavor;
  if (state[slug]) {
    row.dataset.status = state[slug].status;
    if (state[slug].selected) {
      const c = row.querySelector('.candidate[data-index="' + state[slug].selected + '"]');
      if (c) c.classList.add('selected');
    }
  }
});
updateProgress();

function selectCandidate(el) {
  const slug = el.dataset.flavor;
  const idx = el.dataset.index;
  const row = el.closest('.flavor-row');
  row.querySelectorAll('.candidate').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  row.dataset.status = 'approved';
  state[slug] = { status: 'approved', selected: parseInt(idx) };
  localStorage.setItem('ai-cone-qa-culvers', JSON.stringify(state));
  updateProgress();
}

function flagFlavor(slug) {
  const row = document.querySelector('.flavor-row[data-flavor="' + slug + '"]');
  row.querySelectorAll('.candidate').forEach(c => c.classList.remove('selected'));
  row.dataset.status = 'flagged';
  state[slug] = { status: 'flagged', selected: null };
  localStorage.setItem('ai-cone-qa-culvers', JSON.stringify(state));
  updateProgress();
}

function updateProgress() {
  const approved = Object.values(state).filter(s => s.status === 'approved').length;
  document.getElementById('count').textContent = approved;
  document.getElementById('bar').style.width = (approved / TOTAL * 100) + '%';
}

function filterRows(filter, btn) {
  document.querySelectorAll('.filters button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.flavor-row').forEach(row => {
    if (filter === 'all') { row.classList.remove('hidden'); return; }
    row.classList.toggle('hidden', row.dataset.status !== filter);
  });
}

function filterBySearch(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.flavor-row').forEach(row => {
    const name = row.querySelector('.flavor-name').textContent.toLowerCase();
    row.classList.toggle('hidden', q && !name.includes(q));
  });
}

function exportManifest() {
  const manifest = {
    generated_at: new Date().toISOString(),
    model: 'gpt-image-1.5',
    quality: 'medium',
    brand: 'culvers',
    total_flavors: TOTAL,
    approved_count: Object.values(state).filter(s => s.status === 'approved').length,
    flagged_count: Object.values(state).filter(s => s.status === 'flagged').length,
    flavors: {}
  };
  document.querySelectorAll('.flavor-row').forEach(row => {
    const slug = row.dataset.flavor;
    const candidates = Array.from(row.querySelectorAll('.candidate img')).map(img => img.getAttribute('src').split('/').pop());
    const s = state[slug] || { status: 'pending', selected: null };
    manifest.flavors[slug] = {
      slug: slug,
      status: s.status,
      selected: s.selected ? candidates[s.selected - 1] : null,
      candidates: candidates
    };
  });
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ai-generation-manifest.json';
  a.click();
  document.getElementById('export-status').textContent = 'Exported ' + manifest.approved_count + '/' + TOTAL + ' approved, ' + manifest.flagged_count + ' flagged';
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const rows = Array.from(document.querySelectorAll('.flavor-row:not(.hidden)'));
  const focused = document.querySelector('.flavor-row.focused');
  let idx = focused ? rows.indexOf(focused) : -1;
  if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); idx = Math.min(idx + 1, rows.length - 1); }
  else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); idx = Math.max(idx - 1, 0); }
  else if (e.key >= '1' && e.key <= '9' && focused) {
    const c = focused.querySelector('.candidate[data-index="' + e.key + '"]');
    if (c) selectCandidate(c);
    return;
  }
  else if (e.key === 'f' && focused) { flagFlavor(focused.dataset.flavor); return; }
  else return;
  if (focused) focused.classList.remove('focused');
  if (rows[idx]) { rows[idx].classList.add('focused'); rows[idx].scrollIntoView({ block: 'center' }); }
});
</script>
</body>
</html>`;

fs.writeFileSync('docs/ai-cone-qa.html', html);
console.log('Built docs/ai-cone-qa.html');
console.log('Culvers flavors:', flavors.length);
console.log('With reference photo:', flavors.filter(f => f.culversUrl).length);
console.log('Without reference:', flavors.filter(f => !f.culversUrl).length);
