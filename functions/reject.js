// Cloudflare Pages Function — 拒绝
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsRes(204);
  if (request.method !== 'POST') return json(405, {});

  let body;
  try { body = await request.json(); } catch { return json(400, {}); }

  const adminPw = env.ADMIN_PASSWORD;
  if (adminPw && (body.password || '') !== adminPw) return json(403, { ok: false, error: '管理员密码错误' });

  const { category, filename } = body;
  if (!category || !filename) return json(400, { ok: false, error: '缺少参数' });

  const token = env.GITHUB_TOKEN, repo = env.GITHUB_REPO;
  if (!token || !repo) return json(500, { ok: false, error: '未配置' });

  const fp = `_pending/${category}/${filename}`;
  const enc = fp.split('/').map(s => encodeURIComponent(s)).join('/');
  const h = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'cf-pages' };

  try {
    const gr = await fetch(`https://api.github.com/repos/${repo}/contents/${enc}?ref=main`, { headers: h });
    if (!gr.ok) return json(404, { ok: false, error: '文件不存在' });
    const info = await gr.json();

    await fetch(`https://api.github.com/repos/${repo}/contents/${enc}`, {
      method: 'DELETE', headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `❌ 已拒绝: ${filename}`, sha: info.sha, branch: 'main' })
    });

    return json(200, { ok: true, message: `「${filename}」已拒绝` });
  } catch (e) { return json(500, { ok: false, error: e.message }); }
}

function json(s, b) { return new Response(JSON.stringify(b), { status: s, headers: ct() }); }
function ct() { return { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }; }
function corsRes(s) { return new Response('', { status: s, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } }); }
