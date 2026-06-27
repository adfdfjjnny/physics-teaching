// Cloudflare Pages Function — 网站访问计数器
export async function onRequest(context) {
  const { request, env } = context;
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO;
  if (!token || !repo) return json(200, { count: 0 });

  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'cf-counter'
  };

  try {
    // 读取当前计数
    let count = 0;
    let sha = null;
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/contents/counter.json?ref=main`, { headers });
      if (r.ok) {
        const data = await r.json();
        count = parseInt(atob(data.content)) || 0;
        sha = data.sha;
      }
    } catch {}

    // 只统计 GET 请求（页面浏览）
    if (request.method === 'GET') {
      count++;
      const content = btoa(String(count));
      const body = { message: `📊 访问量: ${count}`, content, branch: 'main' };
      if (sha) body.sha = sha;

      await fetch(`https://api.github.com/repos/${repo}/contents/counter.json`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }

    return json(200, { count });
  } catch (e) {
    return json(200, { count: -1 });
  }
}

function json(s, b) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    }
  });
}
