// netlify/functions/verify-token.js
export default async (request) => {
  const token = request.headers.get('x-admin-token');
  if (token && token === process.env.ADMIN_TOKEN) return new Response('ok', { status: 200 });
  return new Response('nope', { status: 401 });
};