/**
 * Netlify Serverless Function — 上传HTML教学程序
 *
 * 接收前端上传的HTML文件，通过 GitHub Contents API 提交到仓库对应分类文件夹。
 * GitHub push 会自动触发 Netlify 重新部署，1-2分钟内新程序上线。
 *
 * 需要的环境变量（在 Netlify 面板中设置）:
 *   GITHUB_TOKEN    — GitHub Personal Access Token（需要 repo 权限）
 *   GITHUB_REPO     — 仓库名，格式 "用户名/仓库名"（如 "physics-teacher/physics-teaching"）
 *   UPLOAD_PASSWORD — （可选）上传密码，设为空字符串则无需密码
 */

// 合法的分类 ID 列表（对应 build.js 中的定义）
const VALID_CATEGORIES = [
  '1-li', '2-re', '3-dianlu', '4-dianci', '5-lizi', '6-guang', '7-yuan'
];

// 最大文件大小：5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * 验证文件名是否安全
 */
function isValidFilename(name) {
  // 不允许路径穿越、不允许空名、必须以 .html/.htm 结尾
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) {
    return false;
  }
  return /\.html?$/i.test(name);
}

/**
 * Netlify Function 入口
 */
exports.handler = async (event) => {
  // ----- CORS 预检 -----
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: ''
    };
  }

  // ----- 只接受 POST -----
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: '请使用 POST 请求' });
  }

  // ----- 解析请求体 -----
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return json(400, { ok: false, error: '请求数据格式错误，需要 JSON' });
  }

  const { category, filename, content } = body;

  // 上传无需密码

  // ----- 参数验证 -----
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return json(400, {
      ok: false,
      error: `无效的分类。可选值: ${VALID_CATEGORIES.join(', ')}`
    });
  }

  if (!filename || !isValidFilename(filename)) {
    return json(400, {
      ok: false,
      error: '文件名不合法。请使用以 .html 结尾的文件名，不要包含路径符号。'
    });
  }

  if (!content || typeof content !== 'string') {
    return json(400, { ok: false, error: '缺少文件内容' });
  }

  // 检查 base64 解码后的大小
  const buffer = Buffer.from(content, 'base64');
  if (buffer.length > MAX_FILE_SIZE) {
    return json(400, {
      ok: false,
      error: `文件过大（${(buffer.length / 1024 / 1024).toFixed(1)}MB），最大允许 5MB`
    });
  }

  // 检查是否为HTML文件
  const head = buffer.toString('utf-8', 0, Math.min(buffer.length, 200)).toLowerCase();
  if (!head.includes('<html') && !head.includes('<!doctype')) {
    console.log('⚠ 警告：文件可能不是有效的HTML，但仍会继续上传');
  }

  // ----- 读取 GitHub 配置 -----
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    return json(500, {
      ok: false,
      error: '服务器未配置 GitHub Token 或仓库名。请在 Netlify 环境变量中设置 GITHUB_TOKEN 和 GITHUB_REPO。'
    });
  }

  // ----- 调用 GitHub API -----
  const filePath = `${category}/${filename}`;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  try {
    // 先检查文件是否已存在（获取 SHA，更新时需要）
    let existingSha = null;
    try {
      const checkResp = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'physics-teaching-uploader'
        }
      });
      if (checkResp.ok) {
        const existing = await checkResp.json();
        existingSha = existing.sha;
      }
    } catch {
      // 文件不存在，忽略
    }

    // 创建或更新文件
    const payload = {
      message: existingSha
        ? `📤 更新: ${filename} (网页上传)`
        : `📤 上传: ${filename} (网页上传)`,
      content: content,
      branch: 'main'
    };
    if (existingSha) {
      payload.sha = existingSha;
    }

    const putResp = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'physics-teaching-uploader'
      },
      body: JSON.stringify(payload)
    });

    if (!putResp.ok) {
      const errBody = await putResp.json().catch(() => ({}));
      console.error('GitHub API 错误:', putResp.status, errBody.message);
      return json(putResp.status, {
        ok: false,
        error: `GitHub API 错误 (${putResp.status}): ${errBody.message || '未知错误'}`
      });
    }

    const result = await putResp.json();
    console.log(`✅ 文件已提交: ${filePath} (${result.content?.name})`);

    return json(200, {
      ok: true,
      message: existingSha ? `已更新「${filename}」` : `「${filename}」上传成功！`,
      detail: existingSha
        ? '文件已更新，GitHub 正在触发重新部署，约1-2分钟后在新页面可见。'
        : '文件已提交到 GitHub，Netlify 正在自动部署，约1-2分钟后即可在首页看到新程序。',
      url: result.content?.html_url || ''
    });

  } catch (err) {
    console.error('上传异常:', err);
    return json(500, {
      ok: false,
      error: '服务器内部错误，请稍后重试。' + (err.message || '')
    });
  }
};

// ----- 工具函数 -----

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body)
  };
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}
