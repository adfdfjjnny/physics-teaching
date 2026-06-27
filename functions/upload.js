// Cloudflare Pages Function — 上传（待审批）
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsRes(204);

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON格式错误' }); }

  const { category, filename, content, author } = body;
  const VALID = ['1-li','2-re','3-dianlu','4-dianci','5-lizi','6-guang','7-yuan'];

  if (!category || !VALID.includes(category)) return json(400, { ok: false, error: '无效分类' });
  if (!filename || filename.includes('/') || !/\.html?$/i.test(filename)) return json(400, { ok: false, error: '文件名不合法' });
  if (!content || typeof content !== 'string') return json(400, { ok: false, error: '缺少文件内容' });

  const buf = Uint8Array.from(atob(content), c => c.charCodeAt(0));
  if (buf.length > 5*1024*1024) return json(400, { ok: false, error: '文件过大' });

  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO;
  if (!token || !repo) return json(500, { ok: false, error: '未配置 GitHub' });

  const filePath = `_pending/${category}/${filename}`;
  const enc = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const h = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'cf-pages' };

  try {
    let sha = null;
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/contents/${enc}?ref=main`, { headers: h });
      if (r.ok) sha = (await r.json()).sha;
    } catch {}

    const payload = { message: `📤 上传: ${filename} (待审批)`, content, branch: 'main' };
    if (sha) payload.sha = sha;

    const r = await fetch(`https://api.github.com/repos/${repo}/contents/${enc}`, {
      method: 'PUT',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) { const e = await r.json().catch(()=>({})); return json(r.status, { ok: false, error: e.message }); }

    // 同时保存作者信息到 .author 文件
    if (author) {
      const authorPath = `_pending/${category}/${filename}.author`;
      const authorEnc = authorPath.split('/').map(s => encodeURIComponent(s)).join('/');
      const authorContent = btoa(unescape(encodeURIComponent(author)));
      let authorSha = null;
      try {
        const ar = await fetch(`https://api.github.com/repos/${repo}/contents/${authorEnc}?ref=main`, { headers: h });
        if (ar.ok) authorSha = (await ar.json()).sha;
      } catch {}
      const ap = { message: `📝 作者: ${author}`, content: authorContent, branch: 'main' };
      if (authorSha) ap.sha = authorSha;
      await fetch(`https://api.github.com/repos/${repo}/contents/${authorEnc}`, {
        method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(ap)
      });
    }

    return json(200, { ok: true, message: `「${filename}」上传成功！`, detail: '已提交到待审批区，等待管理员审批。', pending: true });
  } catch (e) { return json(500, { ok: false, error: e.message }); }
}

function json(s, b) { return new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } }); }
function corsRes(s) { return new Response('', { status: s, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } }); }
