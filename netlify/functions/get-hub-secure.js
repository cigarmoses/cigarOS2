// netlify/functions/get-hub-secure.js
// Serves hub.csv ONLY if the request has a valid hub_session cookie.

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
  // 1) Check auth cookie
  const { HUB_JWT_SECRET } = process.env;
  const cookies = parseCookies(event.headers || {});
  const token = cookies.hub_session || "";
  if (!HUB_JWT_SECRET || !verifyJWT(token, HUB_JWT_SECRET)) {
    return { statusCode: 401, headers: { "Access-Control-Allow-Origin":"*" }, body: "Unauthorized" };
    }

  // 2) Try Blobs "hub/hub.csv", else fallback to static /img/hub.csv
  try {
    const opts = (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN)
      ? { siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN }
      : undefined;
    const store = getStore("hub", opts);
    const stream = await store.get("hub.csv", { type: "stream" });
    if (stream) {
      const text = await streamToString(stream);
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8", "Access-Control-Allow-Origin":"*" },
        body: text
      };
    }
  } catch {
    // ignore, fallback below
  }

  // Static fallback to /img/hub.csv
  try {
    const siteURL = process.env.URL || "";
    const res = await fetch(`${siteURL}/img/hub.csv`);
    if (res.ok) {
      const text = await res.text();
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8", "Access-Control-Allow-Origin":"*" },
        body: text
      };
    }
  } catch {}

  return { statusCode: 404, headers: { "Access-Control-Allow-Origin":"*" }, body: "No hub data found" };
}

function streamToString(stream){
  return new Promise((resolve,reject)=>{
    const chunks=[]; stream.on("data",c=>chunks.push(c));
    stream.on("end",()=>resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error",reject);
  });
}
