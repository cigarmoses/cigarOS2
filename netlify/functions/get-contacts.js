// netlify/functions/get-contacts.js
// Returns contacts from Netlify Blobs -> store "contacts", key "contacts.json"
// Falls back to /img/contacts.csv if the blob isn't there (handy for testing).

import { getStore } from "@netlify/blobs";

const json = (status, body) => ({
  statusCode: status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

export async function handler() {
  try {
    // If you’ve set env vars on cigarOS2 project, we’ll use them.
    const opts =
      process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN
        ? { siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN }
        : undefined;

    const store = getStore("contacts", opts);

    // Try the canonical blob first
    const blob = await store.get("contacts.json");
    if (blob) {
      const data = JSON.parse(blob);
      return json(200, { ok: true, source: "blobs", contacts: data });
    }
  } catch (e) {
    // fall through to CSV fallback below
  }

  // Fallback: CSV committed to repo at /img/contacts.csv
  try {
    // Static fetch to your own site asset
    const res = await fetch(`${process.env.URL || ""}/img/contacts.csv`);
    if (!res.ok) throw new Error("CSV not found");
    const csv = await res.text();

    const rows = csv
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean);

    const header = rows.shift()?.split(",").map((h) => h.trim()) || [];
    const contacts = rows.map((line) => {
      const cols = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQ = !inQ;
        else if (ch === "," && !inQ) {
          cols.push(cur);
          cur = "";
        } else cur += ch;
      }
      cols.push(cur);
      const obj = {};
      header.forEach((h, i) => (obj[h] = (cols[i] || "").replace(/^"|"$/g, "")));
      return obj;
    });

    return json(200, { ok: true, source: "csv", contacts });
  } catch (e) {
    return json(500, { ok: false, error: "No contacts found in blobs or /img/contacts.csv" });
  }
}
