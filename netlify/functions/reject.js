/**
 * 拒绝 — 删除 _pending/ 中的待审批文件
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h(), body: '' };
  if (event.httpMethod !== 'POST') return j(405, { ok: false });

  let body;
  try { body = JSON.parse(event.body); } catch { return j(400, { ok: false }); }

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
  const enc = (p) => p.split('/').map(s => encodeURIComponent(s)).join('/');

  try {
    const getResp = await fetch(
      `https://api.github.com/repos/${repo}/contents/${enc(pendingPath)}?ref=main`,
      { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'physics-teaching' } }
    );
    if (!getResp.ok) return j(404, { ok: false, error: '文件不存在' });

    const info = await getResp.json();
    await fetch(`https://api.github.com/repos/${repo}/contents/${enc(pendingPath)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'physics-teaching' },
      body: JSON.stringify({ message: `❌ 已拒绝: ${filename}`, sha: info.sha, branch: 'main' })
    });

    return j(200, { ok: true, message: `「${filename}」已拒绝` });
  } catch (err) {
    return j(500, { ok: false, error: err.message });
  }
};

function j(code, body) { return { statusCode: code, headers: h(), body: JSON.stringify(body) }; }
function h() { return { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }; }
