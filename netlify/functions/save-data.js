// netlify/functions/save-data.js
import { getStore } from '@netlify/blobs';

export default async (request) => {
  const token = request.headers.get('x-admin-token');
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  const body = await request.text();
  JSON.parse(body); // basic validation
  const store = getStore('smoke-pos');
  await store.set('data.json', body, { contentType: 'application/json' });
  return new Response('ok', { status: 200 });
};
