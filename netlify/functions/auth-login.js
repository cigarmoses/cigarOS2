// netlify/functions/auth-login.js
import crypto from "node:crypto";

const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

const json = (code, body, extraHeaders = {}) => ({
  statusCode: code,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
}

function signJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const seg1 = b64url(JSON.stringify(header));
  const seg2 = b64url(JSON.stringify(payload));
  const data = `${seg1}.${seg2}`;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
  return `${data}.${sig}`;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true }, {
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
  }
  if (event.httpMethod !== "POST") {
    return json(405, { ok:false, error:"Use POST" });
  }

  const { HUB_ADMIN_PASS, HUB_JWT_SECRET } = process.env;
  if (!HUB_ADMIN_PASS || !HUB_JWT_SECRET) {
    return json(500, { ok:false, error:"Server not configured (env vars missing)." });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {}

  const password = (body.password || "").trim();
  if (password !== HUB_ADMIN_PASS) {
    return json(401, { ok:false, error:"Invalid credentials." });
  }

  const now = Math.floor(Date.now()/1000);
  const token = signJWT({ sub:"hub-user", iat: now, exp: now + TOKEN_TTL_SECONDS }, HUB_JWT_SECRET);

  const cookie = [
    `hub_session=${token}`,
    `Max-Age=${TOKEN_TTL_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure"
  ].join("; ");

  return {
    statusCode: 200,
    headers: {
      "Content-Type":"application/json",
      "Set-Cookie": cookie,
      "Access-Control-Allow-Origin":"*"
    },
    body: JSON.stringify({ ok:true })
  };
}
