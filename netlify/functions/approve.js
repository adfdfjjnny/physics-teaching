/**
 * 审批通过 — 将文件从 _pending/ 移到分类文件夹
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h(), body: '' };
  if (event.httpMethod !== 'POST') return j(405, { ok: false, error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body); } catch { return j(400, { ok: false }); }

  // 管理员密码验证
  const adminPw = process.env.ADMIN_PASSWORD;
  if (adminPw && (body.password || '') !== adminPw) {
    return j(403, { ok: false, error: '管理员密码错误' });
  }

  const { category, filename } = body;
  if (!category || !filename) return j(400, { ok: false, error: '缺少参数' });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return j(500, { ok: false, error: '未配置 GitHub' });

  const pendingPath = `_pending/${category}/${filename}`;
  const targetPath = `${category}/${filename}`;
  const enc = (p) => p.split('/').map(s => encodeURIComponent(s)).join('/');

  const base = `https://api.github.com/repos/${repo}/contents`;
  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'physics-teaching'
  };

  try {
    // 1. 获取待审批文件内容
    const getResp = await fetch(`${base}/${enc(pendingPath)}?ref=main`, { headers });
    if (!getResp.ok) return j(404, { ok: false, error: '待审批文件不存在' });
    const fileInfo = await getResp.json();
    const content = fileInfo.content;

    // 2. 检查目标位置是否已有同名文件
    let targetSha = null;
    try {
      const tResp = await fetch(`${base}/${enc(targetPath)}?ref=main`, { headers });
      if (tResp.ok) { const t = await tResp.json(); targetSha = t.sha; }
    } catch {}

    // 3. 在目标位置创建文件
    const createBody = { message: `✅ 审批通过: ${filename}`, content, branch: 'main' };
    if (targetSha) createBody.sha = targetSha;

    const createResp = await fetch(`${base}/${enc(targetPath)}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(createBody)
    });
    if (!createResp.ok) {
      const e = await createResp.json().catch(() => ({}));
      return j(500, { ok: false, error: e.message || '创建文件失败' });
    }

    // 4. 删除待审批文件
    await fetch(`${base}/${enc(pendingPath)}`, {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `✅ 已审批: ${filename}`, sha: fileInfo.sha, branch: 'main' })
    });

    return j(200, { ok: true, message: `「${filename}」已审批通过，即将上线` });

  } catch (err) {
    return j(500, { ok: false, error: err.message });
  }
};

function j(code, body) {
  return { statusCode: code, headers: h(), body: JSON.stringify(body) };
}
function h() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}
