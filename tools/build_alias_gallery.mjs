#!/usr/bin/env node
/**
 * Build HTML gallery for reviewing non-Culver's flavor alias assignments.
 * Each row shows the non-Culver's flavor with 2-3 Culver's cone options
 * to pick from (matched by base similarity). Also includes pure-base
 * and unique-generation flavors with their own candidates.
 */

import fs from 'node:fs';
import path from 'node:path';

const fills = JSON.parse(fs.readFileSync('docs/assets/masterlock-flavor-fills.json', 'utf-8'));
const culversKeys = new Set(JSON.parse(fs.readFileSync('tools/culvers_flavors.json', 'utf-8')));
const CONES_DIR = 'docs/assets/cones';
const CANDIDATES_DIR = 'docs/assets/ai-candidates';

function slug(key) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Build flavor maps
const culversFlavors = [];
const nonCulvers = [];

for (const f of fills.flavors) {
  if (culversKeys.has(f.flavor_key)) {
    culversFlavors.push(f);
  } else {
    nonCulvers.push(f);
  }
}

// Skip exact matches already deployed
const exactDone = new Set(['brownie explosion', 'cashew delight', "really reese's"]);

// Base family grouping for matching
const BASE_FAMILIES = {
  chocolate: ['chocolate', 'dark_chocolate', 'chocolate_custard'],
  vanilla: ['vanilla', 'butter_pecan', 'caramel', 'cheesecake'],
  mint: ['mint'],
  espresso: ['espresso'],
  lemon: ['lemon'],
  fruit: ['cherry', 'strawberry', 'peach', 'banana', 'raspberry'],
  special: ['blue_moon', 'orange', 'pistachio', 'coconut', 'pumpkin', 'maple', 'root_beer'],
};

function getFamily(base) {
  for (const [fam, members] of Object.entries(BASE_FAMILIES)) {
    if (members.includes(base)) return fam;
  }
  return 'other';
}

function scoreMatch(ncProfile, cfProfile) {
  let score = 0;
  // Same base
  if (ncProfile.base === cfProfile.base) score += 5;
  // Same family
  else if (getFamily(ncProfile.base) === getFamily(cfProfile.base)) score += 2;

  // Ribbon similarity
  if (ncProfile.ribbon && cfProfile.ribbon) {
    if (ncProfile.ribbon === cfProfile.ribbon) score += 3;
    else score += 1; // both have ribbons
  } else if (!ncProfile.ribbon && !cfProfile.ribbon) {
    score += 1;
  }

  // Topping overlap
  const ncTops = new Set(ncProfile.toppings || []);
  const cfTops = new Set(cfProfile.toppings || []);
  for (const t of ncTops) {
    if (cfTops.has(t)) score += 2;
  }

  // Density match
  if (ncProfile.density === cfProfile.density) score += 1;

  return score;
}

// For each non-Culver's, find top 3 Culver's matches
const rows = [];

for (const nc of nonCulvers) {
  if (exactDone.has(nc.flavor_key)) continue;
  const p = nc.profile;
  if (!p) continue;

  const isPure = (!p.toppings || p.toppings.length === 0) && !p.ribbon && p.density === 'pure';

  // Check if this flavor has its own generated candidates
  const ncSlug = slug(nc.flavor_key);
  const candidateDir = path.join(CANDIDATES_DIR, ncSlug);
  let ownCandidates = [];
  try {
    ownCandidates = fs.readdirSync(candidateDir)
      .filter(name => name.endsWith('.png') && !name.includes('-processed') && !name.includes('medium-') && !name.includes('high-'))
      .sort()
      .slice(0, 5);
  } catch {}

  // Score all Culver's flavors
  const scored = culversFlavors
    .map(cf => ({
      key: cf.flavor_key,
      title: cf.title,
      slug: slug(cf.flavor_key),
      score: scoreMatch(p, cf.profile),
      profile: cf.profile,
    }))
    .filter(s => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  rows.push({
    key: nc.flavor_key,
    title: nc.title,
    slug: ncSlug,
    description: nc.description || '',
    profile: p,
    isPure,
    ownCandidates,
    matches: scored,
  });
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Generate HTML
const flavorRows = rows.map(r => {
  const matchOptions = r.matches.map((m, i) => {
    const coneFile = `assets/cones/${m.slug}.png`;
    const exists = fs.existsSync(path.join('docs', coneFile));
    if (!exists) return '';
    return `
      <div class="match-option" data-flavor="${r.slug}" data-alias="${m.slug}" onclick="selectAlias(this)">
        <img src="${coneFile}" loading="lazy" />
        <span class="match-label">${esc(m.title)}</span>
        <span class="match-score">score: ${m.score}</span>
      </div>`;
  }).join('');

  const ownCandidateImgs = r.ownCandidates.map((c, i) => `
    <div class="candidate" data-flavor="${r.slug}" data-file="${c}" onclick="selectOwn(this)">
      <img src="assets/ai-candidates/${r.slug}/${c}" loading="lazy" />
      <span class="label">#${i + 1}</span>
    </div>`).join('');

  const profileStr = `base: ${r.profile.base}` +
    (r.profile.ribbon ? `, ribbon: ${r.profile.ribbon}` : '') +
    (r.profile.toppings && r.profile.toppings.length ? `, toppings: ${r.profile.toppings.join(', ')}` : '') +
    `, density: ${r.profile.density}`;

  const tag = r.isPure ? '<span class="tag pure">pure base</span>' :
    (r.ownCandidates.length > 0 ? '<span class="tag gen">has candidates</span>' : '<span class="tag alias">alias only</span>');

  return `
    <div class="flavor-row" data-flavor="${r.slug}" data-status="pending">
      <div class="flavor-info">
        <span class="flavor-name">${esc(r.title)}</span> ${tag}
        <span class="flavor-desc">${esc(r.description)}</span>
        <span class="flavor-profile">${esc(profileStr)}</span>
      </div>
      <div class="options">
        <div class="alias-section">
          <span class="section-label">Reuse Culver's cone:</span>
          <div class="match-options">${matchOptions}</div>
        </div>
        ${r.ownCandidates.length > 0 ? `
        <div class="own-section">
          <span class="section-label">Own candidates:</span>
          <div class="candidates">${ownCandidateImgs}</div>
        </div>` : ''}
      </div>
      <div class="actions">
        <button class="skip-btn" onclick="skipFlavor('${r.slug}')">Skip</button>
      </div>
    </div>`;
}).join('\n');

const totalCount = rows.length;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Non-Culver's Alias Review (${totalCount} Flavors)</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0e1117; color: #e6edf3; font-family: system-ui, sans-serif; padding: 16px; }

  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
  h1 { font-size: 18px; }
  .progress { font-size: 14px; color: #8b949e; }
  .progress-bar { width: 200px; height: 8px; background: #21262d; border-radius: 4px; overflow: hidden; }
  .progress-fill { height: 100%; background: #6dd49b; transition: width 0.3s; }

  .filters { display: flex; gap: 8px; margin-bottom: 12px; }
  .filters button { background: #21262d; color: #e6edf3; border: 1px solid #30363d; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .filters button.active { background: #388bfd; border-color: #388bfd; }

  .flavor-row { display: flex; gap: 8px; align-items: flex-start; padding: 12px; margin-bottom: 4px; border: 1px solid #21262d; border-radius: 6px; background: #161b22; }
  .flavor-row[data-status="assigned"] { border-color: #238636; }
  .flavor-row[data-status="skipped"] { border-color: #8b949e; opacity: 0.6; }
  .flavor-row.hidden { display: none; }

  .flavor-info { width: 180px; flex-shrink: 0; }
  .flavor-name { font-size: 13px; font-weight: 600; }
  .flavor-desc { display: block; font-size: 11px; color: #8b949e; margin: 4px 0; line-height: 1.3; }
  .flavor-profile { display: block; font-size: 10px; color: #6e7681; font-family: monospace; }

  .tag { font-size: 9px; padding: 1px 6px; border-radius: 3px; margin-left: 4px; vertical-align: middle; }
  .tag.pure { background: #1f6feb; color: #fff; }
  .tag.gen { background: #238636; color: #fff; }
  .tag.alias { background: #6e40c9; color: #fff; }

  .options { flex: 1; }
  .section-label { font-size: 10px; color: #8b949e; display: block; margin-bottom: 4px; }
  .alias-section { margin-bottom: 8px; }
  .own-section { border-top: 1px solid #21262d; padding-top: 8px; }

  .match-options { display: flex; gap: 8px; }
  .match-option { cursor: pointer; border: 3px solid transparent; border-radius: 4px; text-align: center; transition: border-color 0.15s; }
  .match-option:hover { border-color: #58a6ff; }
  .match-option.selected { border-color: #6dd49b; }
  .match-option img { display: block; width: 100px; height: 117px; object-fit: contain; background: repeating-conic-gradient(#2d333b 0% 25%, #22272e 0% 50%) 0 0 / 12px 12px; border-radius: 2px; }
  .match-label { display: block; font-size: 10px; margin-top: 2px; }
  .match-score { display: block; font-size: 9px; color: #6e7681; }

  .candidates { display: flex; gap: 6px; }
  .candidate { position: relative; cursor: pointer; border: 3px solid transparent; border-radius: 4px; transition: border-color 0.15s; }
  .candidate:hover { border-color: #58a6ff; }
  .candidate.selected { border-color: #6dd49b; }
  .candidate img { display: block; width: 100px; height: 117px; object-fit: contain; background: repeating-conic-gradient(#2d333b 0% 25%, #22272e 0% 50%) 0 0 / 12px 12px; border-radius: 2px; }
  .candidate .label { position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.7); color: #e6edf3; font-size: 9px; padding: 1px 5px; border-radius: 2px; }

  .actions { width: 50px; flex-shrink: 0; }
  .skip-btn { background: #21262d; color: #8b949e; border: 1px solid #30363d; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; }

  .export-bar { position: sticky; bottom: 0; background: #0e1117; border-top: 1px solid #30363d; padding: 12px; display: flex; gap: 12px; align-items: center; }
  .export-bar button { background: #238636; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
</style>
</head>
<body>

<div class="header">
  <h1>Non-Culver's Alias Review</h1>
  <div class="progress">
    <span id="count">0</span>/${totalCount} assigned
    <div class="progress-bar"><div class="progress-fill" id="bar" style="width:0%"></div></div>
  </div>
</div>

<div class="filters">
  <button class="active" onclick="filterRows('all', this)">All (${totalCount})</button>
  <button onclick="filterRows('pending', this)">Pending</button>
  <button onclick="filterRows('assigned', this)">Assigned</button>
  <button onclick="filterRows('skipped', this)">Skipped</button>
</div>

${flavorRows}

<div class="export-bar">
  <button onclick="exportAliases()">Export Alias Map JSON</button>
  <span id="export-status" style="color:#8b949e;font-size:12px;"></span>
</div>

<script>
const TOTAL = ${totalCount};
const state = JSON.parse(localStorage.getItem('ai-cone-aliases') || '{}');

document.querySelectorAll('.flavor-row').forEach(row => {
  const s = row.dataset.flavor;
  if (state[s]) {
    row.dataset.status = state[s].status;
    if (state[s].alias) {
      const el = row.querySelector('.match-option[data-alias="' + state[s].alias + '"]');
      if (el) el.classList.add('selected');
    }
    if (state[s].ownFile) {
      const el = row.querySelector('.candidate[data-file="' + state[s].ownFile + '"]');
      if (el) el.classList.add('selected');
    }
  }
});
updateProgress();

function selectAlias(el) {
  const slug = el.dataset.flavor;
  const alias = el.dataset.alias;
  const row = el.closest('.flavor-row');
  row.querySelectorAll('.match-option, .candidate').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  row.dataset.status = 'assigned';
  state[slug] = { status: 'assigned', type: 'alias', alias: alias, ownFile: null };
  localStorage.setItem('ai-cone-aliases', JSON.stringify(state));
  updateProgress();
}

function selectOwn(el) {
  const slug = el.dataset.flavor;
  const file = el.dataset.file;
  const row = el.closest('.flavor-row');
  row.querySelectorAll('.match-option, .candidate').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  row.dataset.status = 'assigned';
  state[slug] = { status: 'assigned', type: 'own', alias: null, ownFile: file };
  localStorage.setItem('ai-cone-aliases', JSON.stringify(state));
  updateProgress();
}

function skipFlavor(slug) {
  const row = document.querySelector('.flavor-row[data-flavor="' + slug + '"]');
  row.querySelectorAll('.match-option, .candidate').forEach(c => c.classList.remove('selected'));
  row.dataset.status = 'skipped';
  state[slug] = { status: 'skipped', type: null, alias: null, ownFile: null };
  localStorage.setItem('ai-cone-aliases', JSON.stringify(state));
  updateProgress();
}

function updateProgress() {
  const assigned = Object.values(state).filter(s => s.status === 'assigned').length;
  document.getElementById('count').textContent = assigned;
  document.getElementById('bar').style.width = (assigned / TOTAL * 100) + '%';
}

function filterRows(filter, btn) {
  document.querySelectorAll('.filters button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.flavor-row').forEach(row => {
    if (filter === 'all') { row.classList.remove('hidden'); return; }
    row.classList.toggle('hidden', row.dataset.status !== filter);
  });
}

function exportAliases() {
  const out = { aliases: {}, own: {}, skipped: [] };
  for (const [slug, s] of Object.entries(state)) {
    if (s.status === 'assigned' && s.type === 'alias') out.aliases[slug] = s.alias;
    else if (s.status === 'assigned' && s.type === 'own') out.own[slug] = s.ownFile;
    else if (s.status === 'skipped') out.skipped.push(slug);
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cone-alias-map.json';
  a.click();
  const total = Object.keys(out.aliases).length + Object.keys(out.own).length;
  document.getElementById('export-status').textContent = 'Exported ' + total + ' assigned, ' + out.skipped.length + ' skipped';
}
</script>
</body>
</html>`;

fs.writeFileSync('docs/alias-review.html', html);
console.log('Built docs/alias-review.html');
console.log('Total non-Culvers rows:', rows.length);
console.log('With own candidates:', rows.filter(r => r.ownCandidates.length > 0).length);
console.log('Alias-only:', rows.filter(r => r.ownCandidates.length === 0).length);
