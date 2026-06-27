// Cloudflare Pages Function — 移动程序到其他板块（需 ADMIN_PASSWORD）
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsRes(204);
  if (request.method !== 'POST') return json(405, {});

  let body;
  try { body = await request.json(); } catch { return json(400, {}); }

  const adminPw = env.ADMIN_PASSWORD;
  if (adminPw && (body.password || '') !== adminPw) return json(403, { ok: false, error: '管理员密码错误' });

  const { fromCategory, toCategory, filename } = body;
  const VALID = ['1-li','2-re','3-dianlu','8-dianchang','4-dianci','5-lizi','6-guang','7-yuan'];
  if (!VALID.includes(fromCategory) || !VALID.includes(toCategory)) return json(400, { ok: false, error: '无效分类' });
  if (fromCategory === toCategory) return json(400, { ok: false, error: '目标与源相同' });
  if (!filename || !/\.html?$/i.test(filename)) return json(400, { ok: false, error: '文件名不合法' });

  const token = env.GITHUB_TOKEN, repo = env.GITHUB_REPO;
  if (!token || !repo) return json(500, { ok: false, error: '未配置' });

  const enc = p => p.split('/').map(s => encodeURIComponent(s)).join('/');
  const h = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'cf-pages' };

  try {
    // 1. 获取源文件
    const gr = await fetch(`https://api.github.com/repos/${repo}/contents/${enc(`${fromCategory}/${filename}`)}?ref=main`, { headers: h });
    if (!gr.ok) return json(404, { ok: false, error: '源文件不存在' });
    const info = await gr.json();

    // 2. 在目标位置创建
    let targetSha = null;
    try {
      const tr = await fetch(`https://api.github.com/repos/${repo}/contents/${enc(`${toCategory}/${filename}`)}?ref=main`, { headers: h });
      if (tr.ok) targetSha = (await tr.json()).sha;
    } catch {}

    const createBody = { message: `📦 移动: ${filename} → ${toCategory}`, content: info.content, branch: 'main' };
    if (targetSha) createBody.sha = targetSha;
    const cr = await fetch(`https://api.github.com/repos/${repo}/contents/${enc(`${toCategory}/${filename}`)}`, {
      method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(createBody)
    });
    if (!cr.ok) { const e = await cr.json().catch(()=>({})); return json(500, { ok: false, error: e.message }); }

    // 3. 删除源文件
    await fetch(`https://api.github.com/repos/${repo}/contents/${enc(`${fromCategory}/${filename}`)}`, {
      method: 'DELETE', headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `📦 已移动: ${filename} → ${toCategory}`, sha: info.sha, branch: 'main' })
    });

    // 4. 移动 .author 文件（如果存在）
    try {
      const ar = await fetch(`https://api.github.com/repos/${repo}/contents/${enc(`${fromCategory}/${filename}.author`)}?ref=main`, { headers: h });
      if (ar.ok) {
        const ai = await ar.json();
        await fetch(`https://api.github.com/repos/${repo}/contents/${enc(`${toCategory}/${filename}.author`)}`, {
          method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `📦 移动作者信息`, content: ai.content, branch: 'main' })
        });
        await fetch(`https://api.github.com/repos/${repo}/contents/${enc(`${fromCategory}/${filename}.author`)}`, {
          method: 'DELETE', headers: { ...h, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `📦 已移动`, sha: ai.sha, branch: 'main' })
        });
      }
    } catch {}

    // 5. 重建目录
    try { await rebuildCatalog(token, repo); } catch {}

    return json(200, { ok: true, message: `「${filename}」已移动到目标板块` });
  } catch (e) { return json(500, { ok: false, error: e.message }); }
}

async function rebuildCatalog(token, repo) {
  const h = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'cf-pages' };
  const CATS = [{ id:'1-li',name:'力',fullName:'力学',emoji:'🍎',color:'#2563eb',desc:'牛顿定律、运动学、万有引力等' },{ id:'2-re',name:'热',fullName:'热学',emoji:'🔥',color:'#dc2626',desc:'热力学定律、分子动理论等' },{ id:'3-dianlu',name:'电路',fullName:'电路',emoji:'⚡',color:'#f59e0b',desc:'欧姆定律、串并联电路、基尔霍夫等' },{ id:'8-dianchang',name:'电场',fullName:'电场',emoji:'🔵',color:'#0891b2',desc:'电场强度、电场线、电势、电容器等' },{ id:'4-dianci',name:'电磁感应',fullName:'电磁感应',emoji:'🧲',color:'#10b981',desc:'法拉第定律、楞次定律、互感自感等' },{ id:'5-lizi',name:'带电粒子',fullName:'带电粒子在磁场中运动',emoji:'⚛️',color:'#8b5cf6',desc:'洛伦兹力、圆周运动、质谱仪等' },{ id:'6-guang',name:'光',fullName:'光学',emoji:'💡',color:'#f97316',desc:'几何光学、波动光学、干涉衍射等' },{ id:'7-yuan',name:'原',fullName:'原子物理',emoji:'🔬',color:'#6b7280',desc:'玻尔模型、能级跃迁、原子核等' }];
  const cats = [];
  for (const c of CATS) {
    const progs = [];
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/contents/${c.id}?ref=main`, { headers: h });
      if (r.ok && Array.isArray(await r.json())) {
        const fs = await r.json();
        for (const f of fs) {
          if (/\.html?$/i.test(f.name)) {
            let author = '';
            try {
              const ar = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(c.id+'/'+f.name+'.author')}?ref=main`,{headers:h});
              if (ar.ok) { const aj = await ar.json(); author = decodeURIComponent(escape(atob(aj.content))); }
            } catch {}
            progs.push({ file: f.name, title: f.name.replace(/\.html?$/i,'').replace(/[-_.]/g,' ').replace(/\s+/g,' ').trim(), path: `${c.id}/${f.name}`, author });
          }
        }
      }
    } catch {}
    cats.push({ ...c, programs: progs, description: c.desc });
  }
  const total = cats.reduce((s,c) => s + c.programs.length, 0);
  const catalog = { categories: cats, totalPrograms: total, updatedAt: new Date().toISOString() };
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(catalog, null, 2))));
  let sha = null;
  try { const r = await fetch(`https://api.github.com/repos/${repo}/contents/catalog.json?ref=main`,{headers:h}); if (r.ok) sha = (await r.json()).sha; } catch {}
  const payload = { message: '🔄 移动后更新目录', content, branch: 'main' };
  if (sha) payload.sha = sha;
  await fetch(`https://api.github.com/repos/${repo}/contents/catalog.json`, { method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

function json(s, b) { return new Response(JSON.stringify(b), { status: s, headers: ct() }); }
function ct() { return { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }; }
function corsRes(s) { return new Response('', { status: s, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } }); }
