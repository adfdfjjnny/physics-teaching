// Cloudflare Pages Function — 下载密码验证
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  if (request.method !== 'POST') return json(405, {});

  let body;
  try { body = await request.json(); } catch { return json(400, {}); }

  const dp = env.DOWNLOAD_PASSWORD;
  if (!dp) return json(200, { ok: true, needPassword: false });
  if ((body.password || '') !== dp) return json(403, { ok: false, error: '下载密码错误' });

  return json(200, { ok: true });
}

function json(s, b) { return new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } }); }
