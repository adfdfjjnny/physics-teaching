/**
 * Netlify Function — 删除HTML教学程序
 * 通过 GitHub API 删除仓库中的文件，触发重新部署
 */

const VALID_CATEGORIES = [
  '1-li', '2-re', '3-dianlu', '4-dianci', '5-lizi', '6-guang', '7-yuan'
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: '请使用 POST 请求' });
  }

  let body;
  try { body = JSON.parse(event.body); } catch {
    return json(400, { ok: false, error: '请求格式错误' });
  }

  const { category, filename } = body;

  // 密码保护
  if (process.env.UPLOAD_PASSWORD) {
    if ((body.password || '') !== process.env.UPLOAD_PASSWORD) {
      return json(403, { ok: false, error: '密码错误' });
    }
  }

  // 参数验证
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return json(400, { ok: false, error: '无效分类' });
  }
  if (!filename || filename.includes('/') || filename.includes('\\') || !/\.html?$/i.test(filename)) {
    return json(400, { ok: false, error: '文件名不合法' });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return json(500, { ok: false, error: '服务器未配置 GitHub' });
  }

  const filePath = `${category}/${filename}`;
  const encPath = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const url = `https://api.github.com/repos/${repo}/contents/${encPath}`;

  try {
    // 获取文件 SHA
    const getResp = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'physics-teaching'
      }
    });

    if (!getResp.ok) {
      if (getResp.status === 404) {
        return json(404, { ok: false, error: '文件不存在' });
      }
      return json(getResp.status, { ok: false, error: '获取文件信息失败' });
    }

    const fileInfo = await getResp.json();

    // 删除文件
    const delResp = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'physics-teaching'
      },
      body: JSON.stringify({
        message: `🗑 删除: ${filename}`,
        sha: fileInfo.sha,
        branch: 'main'
      })
    });

    if (!delResp.ok) {
      const err = await delResp.json().catch(() => ({}));
      return json(delResp.status, { ok: false, error: err.message || '删除失败' });
    }

    console.log(`🗑 已删除: ${filePath}`);
    return json(200, {
      ok: true,
      message: `「${filename}」已删除`,
      detail: '文件已从 GitHub 移除，Netlify 正在重新部署，约1-2分钟后生效。'
    });

  } catch (err) {
    return json(500, { ok: false, error: '服务器错误: ' + (err.message || '') });
  }
};

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}
function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}
