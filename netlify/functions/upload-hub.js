// netlify/functions/upload-hub.js
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

function parseCookies(h) {
  const raw = h.cookie || h.Cookie || "";
  const out = {};
  raw.split(";").forEach(p => {
    const i = p.indexOf("=");
    if (i > -1) out[p.slice(0,i).trim()] = decodeURIComponent(p.slice(i+1).trim());
  });
  return out;
}

function verifyJWT(token, secret) {
  try {
    const [seg1, seg2, sig] = token.split(".");
    if (!seg1 || !seg2 || !sig) return null;
    const data = `${seg1}.${seg2}`;
    const expSig = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64")
      .replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
    if (expSig !== sig) return null;
    const payload = JSON.parse(Buffer.from(seg2.replace(/-/g,"+").replace(/_/g,"/"), "base64").toString("utf8"));
    if (payload.exp && Math.floor(Date.now()/1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function handler(event) {
  const { HUB_JWT_SECRET } = process.env;
  const cookies = parseCookies(event.headers || {});
  const token = cookies.hub_session || "";
  if (!HUB_JWT_SECRET || !verifyJWT(token, HUB_JWT_SECRET)) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Use POST" };
  }

  try {
    const store = getStore("hub");
    const csv = event.body;
    if (!csv || csv.length < 10) {
      return { statusCode: 400, body: "Empty or invalid CSV" };
    }

    await store.set("hub.csv", csv, { metadata: { updated: new Date().toISOString() } });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, msg: "Hub updated" })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
}
