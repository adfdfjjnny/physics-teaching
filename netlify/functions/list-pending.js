/**
 * 列出所有待审批文件（_pending/ 目录下的 HTML 文件）
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h(), body: '' };

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return j(500, { ok: false, error: '未配置' });

  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'physics-teaching'
  };

  try {
    // 获取 _pending 目录内容
    const resp = await fetch(
      `https://api.github.com/repos/${repo}/contents/_pending?ref=main`,
      { headers }
    );

    if (resp.status === 404) return j(200, { ok: true, items: [] });

    const dirs = await resp.json();
    if (!Array.isArray(dirs)) return j(200, { ok: true, items: [] });

    const items = [];

    // 遍历每个分类子目录
    for (const dir of dirs) {
      if (dir.type !== 'dir') continue;
      const category = dir.name;

      const subResp = await fetch(
        `https://api.github.com/repos/${repo}/contents/_pending/${category}?ref=main`,
        { headers }
      );
      if (!subResp.ok) continue;

      const files = await subResp.json();
      if (!Array.isArray(files)) continue;

      for (const file of files) {
        if (!/\.html?$/i.test(file.name)) continue;
        items.push({
          category,
          filename: file.name,
          title: file.name.replace(/\.html?$/i, '').replace(/[-_]/g, ' '),
          path: `_pending/${category}/${file.name}`,
          size: file.size,
          uploadedAt: file.git_url // approximate
        });
      }
    }

    return j(200, { ok: true, items, total: items.length });
  } catch (err) {
    return j(500, { ok: false, error: err.message });
  }
};

function j(code, body) { return { statusCode: code, headers: h(), body: JSON.stringify(body) }; }
function h() { return { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }; }
