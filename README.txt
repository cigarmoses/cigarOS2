Smoke POS – Starter (SVG-ready)

What’s included
- index.html: POS UI with clickable SVG logo modal
- admin.html: Import/export CSV/JSON + Save to server
- netlify/functions: get-data.js, save-data.js, verify-token.js (ESM)
- netlify.toml + package.json
- img/: put your SVG logos here (one per brand)

Deploy (GitHub → Netlify)
1) Create a new GitHub repo and upload ALL files/folders (keep structure).
2) In Netlify → New site from Git → pick this repo.
3) Site settings → Environment variables → add:
   ADMIN_TOKEN = your-secret
4) Deploy (or Trigger deploy → Deploy project without cache).
5) Visit /admin.html → enter ADMIN_TOKEN → import your CSV and Save to server.

Data format (CSV/JSON)
Columns (case-insensitive): brand, item, vitola, price, inventory, icon
- icon: full URL to your logo (e.g., https://<yoursite>.netlify.app/img/acid.svg)
- If icon is blank, app tries /img/<brand>.svg automatically.

SVG prep (Illustrator)
- RGB, 500x500 artboard, one logo per file.
- Export SVG (Presentation Attributes, Outlines, Responsive).
- Optional: optimize with SVGOMG.