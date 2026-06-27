// Cloudflare Pages Function — 删除
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsRes(204);
  if (request.method !== 'POST') return json(405, { ok: false });

  let body;
  try { body = await request.json(); } catch { return json(400, {}); }

  const adminPw = env.ADMIN_PASSWORD;
  if (adminPw && (body.password || '') !== adminPw) return json(403, { ok: false, error: '管理员密码错误' });

  const { category, filename } = body;
  if (!category || !filename || !/\.html?$/i.test(filename)) return json(400, { ok: false, error: '参数不合法' });

  const token = env.GITHUB_TOKEN, repo = env.GITHUB_REPO;
  if (!token || !repo) return json(500, { ok: false, error: '未配置' });

  const fp = `${category}/${filename}`;
  const enc = fp.split('/').map(s => encodeURIComponent(s)).join('/');
  const h = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'cf-pages' };

  try {
    const gr = await fetch(`https://api.github.com/repos/${repo}/contents/${enc}?ref=main`, { headers: h });
    if (!gr.ok) return json(404, { ok: false, error: '文件不存在' });
    const info = await gr.json();

    const dr = await fetch(`https://api.github.com/repos/${repo}/contents/${enc}`, {
      method: 'DELETE', headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `🗑 删除: ${filename}`, sha: info.sha, branch: 'main' })
    });
    if (!dr.ok) { const e = await dr.json().catch(()=>({})); return json(dr.status, { ok: false, error: e.message }); }

    // 更新目录 & 触发部署
    try { await rebuildCat(token, repo); } catch {}
    try { await triggerDeploy(env); } catch {}

    return json(200, { ok: true, message: `「${filename}」已删除`, detail: '1-2分钟后生效' });
  } catch (e) { return json(500, { ok: false, error: e.message }); }
}

async function rebuildCat(token, repo) {
  const h = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'cf-pages' };
  const CATS = [
    { id:'1-li' },{ id:'2-re' },{ id:'3-dianlu' },{ id:'4-dianci' },{ id:'5-lizi' },{ id:'6-guang' },{ id:'7-yuan' }
  ];
  const cats = [];
  for (const c of CATS) {
    const progs = [];
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/contents/${c.id}?ref=main`, { headers: h });
      if (r.ok) {
        const fs = await r.json();
        if (Array.isArray(fs)) for (const f of fs) {
          if (/\.html?$/i.test(f.name)) {
          let author = '';
          try {
            const ar = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(c.id + '/' + f.name + '.author')}?ref=main`, { headers: h });
            if (ar.ok) { const aj = await ar.json(); author = decodeURIComponent(escape(atob(aj.content))); }
          } catch {}
          progs.push({ file: f.name, title: f.name.replace(/\.html?$/i,'').replace(/[-_.]/g,' ').trim(), path: `${c.id}/${f.name}`, author });
        }
        }
      }
    } catch {}
    cats.push({ ...c, programs: progs });
  }
  const total = cats.reduce((s,c) => s + c.programs.length, 0);
  const catalog = JSON.stringify({ categories: cats, totalPrograms: total, updatedAt: new Date().toISOString() });
  const content = btoa(unescape(encodeURIComponent(catalog)));
  let sha = null;
  try { const r = await fetch(`https://api.github.com/repos/${repo}/contents/catalog.json?ref=main`, { headers: h }); if (r.ok) sha = (await r.json()).sha; } catch {}
  const payload = { message: '🔄 更新目录', content, branch: 'main' };
  if (sha) payload.sha = sha;
  await fetch(`https://api.github.com/repos/${repo}/contents/catalog.json`, { method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

async function triggerDeploy(env) {
  const t = env.CF_API_TOKEN, a = env.CF_ACCOUNT_ID;
  if (!t || !a) return;
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${a}/pages/projects/physics-teaching/deployments`, {
    method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ branch: 'main' })
  });
}

function json(s, b) { return new Response(JSON.stringify(b), { status: s, headers: ct() }); }
function ct() { return { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }; }
function corsRes(s) { return new Response('', { status: s, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } }); }
