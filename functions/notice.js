// Cloudflare Pages Function — 通知公告（GET 读取 / POST 发布需 ADMIN_PASSWORD）
export async function onRequest(context) {
  const { request, env } = context;
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO;
  if (!token || !repo) return json(500, { ok: false });

  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'cf-notice'
  };

  // GET — 读取公告
  if (request.method === 'GET') {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/contents/notice.json?ref=main`, { headers });
      if (r.status === 404) return json(200, { ok: true, notice: { text: '', updatedAt: '', author: '' } });
      if (!r.ok) return json(500, { ok: false });
      const data = await r.json();
      const notice = JSON.parse(decodeURIComponent(escape(atob(data.content))));
      return json(200, { ok: true, notice });
    } catch (e) {
      return json(200, { ok: true, notice: { text: '', updatedAt: '', author: '' } });
    }
  }

  // POST — 发布公告（需 ADMIN_PASSWORD）
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json(400, {}); }

    const adminPw = env.ADMIN_PASSWORD;
    if (adminPw && (body.password || '') !== adminPw) {
      return json(403, { ok: false, error: '管理员密码错误' });
    }

    try {
      const notice = {
        text: (body.text || '').trim(),
        updatedAt: new Date().toISOString(),
        author: (body.author || '管理员').trim()
      };

      const content = btoa(unescape(encodeURIComponent(JSON.stringify(notice, null, 2))));
      let sha = null;
      try {
        const r = await fetch(`https://api.github.com/repos/${repo}/contents/notice.json?ref=main`, { headers });
        if (r.ok) sha = (await r.json()).sha;
      } catch {}

      const payload = { message: `📢 更新公告`, content, branch: 'main' };
      if (sha) payload.sha = sha;

      const r = await fetch(`https://api.github.com/repos/${repo}/contents/notice.json`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) { const e = await r.json().catch(()=>({})); return json(r.status, { ok: false, error: e.message }); }

      return json(200, { ok: true, message: '公告已发布', notice });
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
