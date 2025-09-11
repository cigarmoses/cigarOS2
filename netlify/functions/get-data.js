// netlify/functions/get-data.js
import { getStore } from '@netlify/blobs';

export default async () => {
  const store = getStore('smoke-pos');
  const txt = await store.get('data.json', { type: 'text' });
  const json = txt ? JSON.parse(txt) : [];
  return new Response(JSON.stringify(json), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
};
