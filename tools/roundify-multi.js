// tools/roundify-multi.js
// Batch-clip SVGs in multiple folders to rounded corners (default radius=124).
// Default targets (your repo): img/icons/{brands,foodandbevs,categories}
//
// Usage:
//   node tools/roundify-multi.js              -> write rounded copies to ./out subfolders
//   node tools/roundify-multi.js --inplace    -> backup originals then overwrite in place
//   node tools/roundify-multi.js --radius 124 -> change radius (defaults to 124)
//   node tools/roundify-multi.js pathA pathB  -> process custom folders
//
// Notes:
// - No backgrounds added; only a clipPath is applied.
// - Backup folder example: ./img/icons/brands/__backup_2025-10-31_1530/

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const INPLACE = argv.includes('--inplace');
const rIdx = argv.indexOf('--radius');
const RADIUS = rIdx >= 0 ? Number(argv[rIdx + 1]) : 124;

// default search roots
const defaultRoots = [
  'img/icons/brands',
  'img/icons/foodandbevs',
  'img/icons/categories'
];

const roots = argv.filter(a => !a.startsWith('--'));
const targetDirs = roots.length ? roots : defaultRoots;

// ------------------------

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function roundOne(svgText, radiusFallback = 124) {
  const svgOpenMatch = svgText.match(/<svg[^>]*>/i);
  const endIdx = svgText.lastIndexOf('</svg>');
  if (!svgOpenMatch || endIdx === -1) throw new Error('Invalid SVG');

  const svgOpen = svgOpenMatch[0];
  const inner = svgText.slice(svgOpen.length, endIdx);

  let vb = null;
  const vbMatch = svgOpen.match(/viewBox\s*=\s*["']([\d.\-\s]+)["']/i);
  const wMatch  = svgOpen.match(/width\s*=\s*["']([\d.]+)["']/i);
  const hMatch  = svgOpen.match(/height\s*=\s*["']([\d.]+)["']/i);

  if (vbMatch) {
    const [minX, minY, w, h] = vbMatch[1].trim().split(/\s+/).map(Number);
    vb = { minX, minY, w, h };
  } else if (wMatch && hMatch) {
    vb = { minX: 0, minY: 0, w: Number(wMatch[1]), h: Number(hMatch[1]) };
  } else {
    // Fallback if none present
    vb = { minX: 0, minY: 0, w: 1024, h: 1024 };
  }

  const rEff = Math.min(RADIUS || radiusFallback, vb.w / 2, vb.h / 2);
  const clipId = 'clipR';

  const newHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.minX} ${vb.minY} ${vb.w} ${vb.h}">`;
  return `${newHeader}
  <defs>
    <clipPath id="${clipId}">
      <rect x="${vb.minX}" y="${vb.minY}" width="${vb.w}" height="${vb.h}" rx="${rEff}" ry="${rEff}" />
    </clipPath>
  </defs>
  <g clip-path="url(#${clipId})">
${inner}
  </g>
</svg>`;
}

function processDir(dir) {
  if (!fs.existsSync(dir)) {
    console.warn('⟨skip⟩', dir, '(missing)');
    return;
  }

  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.svg'));
  if (!files.length) {
    console.log('⟨empty⟩', dir);
    return;
  }

  let outDir, backupDir;
  if (INPLACE) {
    backupDir = path.join(dir, `__backup_${timestamp()}`);
    ensureDir(backupDir);
  } else {
    outDir = path.join(dir, 'out');
    ensureDir(outDir);
  }

  console.log(`\n▶ Processing ${dir}  (files: ${files.length})  radius=${RADIUS}  mode=${INPLACE ? 'INPLACE' : 'OUT'}`);

  files.forEach(file => {
    const inPath = path.join(dir, file);
    const raw = fs.readFileSync(inPath, 'utf8');
    let out;
    try {
      out = roundOne(raw, 124);
    } catch (e) {
      console.error('✖', file, '-', e.message);
      return;
    }

    if (INPLACE) {
      // backup original
      const bPath = path.join(backupDir, file);
      fs.writeFileSync(bPath, raw, 'utf8');
      // overwrite original
      fs.writeFileSync(inPath, out, 'utf8');
      console.log('✔ inplace', file);
    } else {
      // write to out
      const oPath = path.join(outDir, file);
      fs.writeFileSync(oPath, out, 'utf8');
      console.log('✔ out', path.join('out', file));
    }
  });
}

// run
targetDirs.forEach(processDir);
console.log('\nDone.\n');
