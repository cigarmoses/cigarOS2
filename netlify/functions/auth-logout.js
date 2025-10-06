// netlify/functions/auth-logout.js
export async function handler() {
  const cookie = [
    "hub_session=deleted",
    "Max-Age=0",
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
