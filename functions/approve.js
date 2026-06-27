// Cloudflare Pages Function — 审批通过 + 自动更新目录 + 触发部署
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

  const enc = p => p.split('/').map(s => encodeURIComponent(s)).join('/');
  const h = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'cf-pages' };

  try {
    // 1. 获取待审批文件
    const gr = await fetch(`https://api.github.com/repos/${repo}/contents/${enc(`_pending/${category}/${filename}`)}?ref=main`, { headers: h });
    if (!gr.ok) return json(404, { ok: false, error: '待审批文件不存在' });
    const info = await gr.json();

    // 2. 在目标分类文件夹创建文件
    let targetSha = null;
    try {
      const tr = await fetch(`https://api.github.com/repos/${repo}/contents/${enc(`${category}/${filename}`)}?ref=main`, { headers: h });
      if (tr.ok) targetSha = (await tr.json()).sha;
    } catch {}

    const cb = { message: `✅ 审批通过: ${filename}`, content: info.content, branch: 'main' };
    if (targetSha) cb.sha = targetSha;
    const cr = await fetch(`https://api.github.com/repos/${repo}/contents/${enc(`${category}/${filename}`)}`, {
      method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(cb)
    });
    if (!cr.ok) { const e = await cr.json().catch(()=>({})); return json(500, { ok: false, error: e.message }); }

    // 3. 删除待审批文件
    await fetch(`https://api.github.com/repos/${repo}/contents/${enc(`_pending/${category}/${filename}`)}`, {
      method: 'DELETE', headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `✅ 已审批: ${filename}`, sha: info.sha, branch: 'main' })
    });

    // 4. 重新生成 catalog.json 并上传到 GitHub
    try {
      await rebuildCatalog(token, repo);
    } catch (e) { console.log('catalog rebuild error:', e); }

    // 5. 触发 Cloudflare 重新部署
    try {
      await triggerDeploy(env);
    } catch (e) { console.log('deploy trigger error:', e); }

    return json(200, { ok: true, message: `「${filename}」已审批通过，正在自动部署...`, detail: '约1-2分钟后首页可见' });
  } catch (e) { return json(500, { ok: false, error: e.message }); }
}

// 扫描 GitHub 仓库重建 catalog.json
async function rebuildCatalog(token, repo) {
  const h = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'cf-pages' };
  const CATS = [
    { id:'1-li', name:'力', fullName:'力学', emoji:'🍎', color:'#2563eb', desc:'牛顿定律、运动学、万有引力等' },
    { id:'2-re', name:'热', fullName:'热学', emoji:'🔥', color:'#dc2626', desc:'热力学定律、分子动理论等' },
    { id:'3-dianlu', name:'电路', fullName:'电路', emoji:'⚡', color:'#f59e0b', desc:'欧姆定律、串并联电路、基尔霍夫等' },
    { id:'4-dianci', name:'电磁感应', fullName:'电磁感应', emoji:'🧲', color:'#10b981', desc:'法拉第定律、楞次定律、互感自感等' },
    { id:'5-lizi', name:'带电粒子', fullName:'带电粒子在磁场中运动', emoji:'⚛️', color:'#8b5cf6', desc:'洛伦兹力、圆周运动、质谱仪等' },
    { id:'6-guang', name:'光', fullName:'光学', emoji:'💡', color:'#f97316', desc:'几何光学、波动光学、干涉衍射等' },
    { id:'7-yuan', name:'原', fullName:'原子物理', emoji:'🔬', color:'#6b7280', desc:'玻尔模型、能级跃迁、原子核等' }
  ];

  const categories = [];
  for (const cat of CATS) {
    const programs = [];
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/contents/${cat.id}?ref=main`, { headers: h });
      if (r.ok) {
        const files = await r.json();
        if (Array.isArray(files)) {
          for (const f of files) {
            if (/\.html?$/i.test(f.name) && !f.name.startsWith('.')) {
              programs.push({ file: f.name, title: f.name.replace(/\.html?$/i,'').replace(/[-_.]/g,' ').replace(/\s+/g,' ').trim(), path: `${cat.id}/${f.name}` });
            }
          }
        }
      }
    } catch {}
    categories.push({ ...cat, programs, description: cat.desc });
  }

  const total = categories.reduce((s,c) => s + c.programs.length, 0);
  const catalog = { categories, totalPrograms: total, updatedAt: new Date().toISOString() };
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(catalog, null, 2))));

  let sha = null;
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/contents/catalog.json?ref=main`, { headers: h });
    if (r.ok) sha = (await r.json()).sha;
  } catch {}

  const payload = { message: '🔄 审批后更新目录', content, branch: 'main' };
  if (sha) payload.sha = sha;

  await fetch(`https://api.github.com/repos/${repo}/contents/catalog.json`, {
    method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
}

// 触发 Cloudflare Pages 重新部署
async function triggerDeploy(env) {
  const token = env.CF_API_TOKEN;
  const acctId = env.CF_ACCOUNT_ID;
  if (!token || !acctId) return;

  await fetch(`https://api.cloudflare.com/client/v4/accounts/${acctId}/pages/projects/physics-teaching/deployments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch: 'main' })
  });
}

function json(s, b) { return new Response(JSON.stringify(b), { status: s, headers: ct() }); }
function ct() { return { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }; }
function corsRes(s) { return new Response('', { status: s, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } }); }
