/**
 * 验证下载密码 — 仅用于下载前密码校验
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false });
  }

  let body;
  try { body = JSON.parse(event.body); } catch {
    return json(400, { ok: false });
  }

  const downloadPassword = process.env.DOWNLOAD_PASSWORD;
  if (!downloadPassword) {
    return json(200, { ok: true, needPassword: false });
  }

  if ((body.password || '') !== downloadPassword) {
    return json(403, { ok: false, error: '下载密码错误' });
  }

  return json(200, { ok: true });
};

function json(code, body) {
  return {
    statusCode: code,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}
function corsHeaders() { return {}; }
