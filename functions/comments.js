// Cloudflare Pages Function — 评论（GET 读取 / POST 添加）
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsRes(204);

  const url = new URL(request.url);
  const category = url.searchParams.get('cat');
  const filename = url.searchParams.get('file');
  if (!category || !filename) return json(400, { ok: false, error: '缺少参数' });

  const token = env.GITHUB_TOKEN, repo = env.GITHUB_REPO;
  if (!token || !repo) return json(500, { ok: false });

  const enc = p => p.split('/').map(s => encodeURIComponent(s)).join('/');
  const path = `comments/${category}/${filename}.json`;
  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'cf-comments'
  };

  // GET — 读取评论
  if (request.method === 'GET') {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/contents/${enc(path)}?ref=main`, { headers });
      if (r.status === 404) return json(200, { ok: true, comments: [] });
      if (!r.ok) return json(500, { ok: false });
      const data = await r.json();
      const parsed = JSON.parse(decodeURIComponent(escape(atob(data.content))));
      return json(200, { ok: true, comments: parsed.comments || [], sha: data.sha });
    } catch (e) {
      return json(200, { ok: true, comments: [] });
    }
  }

  // POST — 添加评论
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json(400, {}); }
    const { name, message } = body;
    if (!message || !message.trim()) return json(400, { ok: false, error: '评论不能为空' });

    try {
      // 读取现有评论
      let comments = [];
      let sha = null;
      try {
        const r = await fetch(`https://api.github.com/repos/${repo}/contents/${enc(path)}?ref=main`, { headers });
        if (r.ok) {
          const data = await r.json();
          const parsed = JSON.parse(decodeURIComponent(escape(atob(data.content))));
          comments = parsed.comments || [];
          sha = data.sha;
        }
      } catch {}

      comments.push({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        name: (name || '匿名').trim(),
        message: message.trim(),
        time: new Date().toISOString()
      });

      const content = btoa(unescape(encodeURIComponent(JSON.stringify({ comments }, null, 2))));
      const payload = { message: `💬 评论: ${filename}`, content, branch: 'main' };
      if (sha) payload.sha = sha;

      const r = await fetch(`https://api.github.com/repos/${repo}/contents/${enc(path)}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) { const e = await r.json().catch(()=>({})); return json(r.status, { ok: false, error: e.message }); }

      return json(200, { ok: true, message: '评论已发布', comments });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }

  return json(405, { ok: false });
}

function json(s, b) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }
  });
}
function corsRes(s) { return new Response('', { status: s, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } }); }
