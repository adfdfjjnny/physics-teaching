// Cloudflare Pages Function — 列出待审批文件
export async function onRequest(context) {
  const { env } = context;
  const token = env.GITHUB_TOKEN, repo = env.GITHUB_REPO;
  if (!token || !repo) return json(500, { ok: false, error: '未配置' });

  const h = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'cf-pages' };

  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/contents/_pending?ref=main`, { headers: h });
    if (r.status === 404) return json(200, { ok: true, items: [], total: 0 });

    const dirs = await r.json();
    if (!Array.isArray(dirs)) return json(200, { ok: true, items: [], total: 0 });

    const items = [];
    for (const dir of dirs) {
      if (dir.type !== 'dir') continue;
      const sr = await fetch(`https://api.github.com/repos/${repo}/contents/_pending/${dir.name}?ref=main`, { headers: h });
      if (!sr.ok) continue;
      const files = await sr.json();
      if (!Array.isArray(files)) continue;
      for (const f of files) {
        if (!/\.html?$/i.test(f.name)) continue;
        items.push({ category: dir.name, filename: f.name, title: f.name.replace(/\.html?$/i,'').replace(/[-_]/g,' '), size: f.size });
      }
    }

    return json(200, { ok: true, items, total: items.length });
  } catch (e) { return json(500, { ok: false, error: e.message }); }
}

function json(s, b) { return new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } }); }
