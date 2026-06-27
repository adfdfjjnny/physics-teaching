var fs = require('fs');
var https = require('https');
var TOKEN = fs.readFileSync('.ghtoken', 'utf-8').trim();

var files = [
  '1-li/牛顿第一定律-惯性演示.html',
  '2-re/布朗运动模拟.html',
  '3-dianlu/欧姆定律-电路模拟.html',
  '4-dianci/法拉第电磁感应.html',
  '5-lizi/带电粒子在磁场中的圆周运动.html',
  '6-guang/光的折射与反射.html',
  '7-yuan/玻尔模型-能级跃迁.html'
];

function api(method, path, body) {
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : null;
    var opts = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': 'token ' + TOKEN,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'cleanup',
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0
      }
    };
    var req = https.request(opts, function(res) {
      var b = '';
      res.on('data', function(c) { b += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(b)); } catch(e) { resolve({}); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function del(f) {
  var enc = encodeURIComponent(f);
  var r = await api('GET', '/repos/adfdfjjnny/physics-teaching/contents/' + enc + '?ref=main');
  if (!r.sha) { console.log('  - ' + f + ' 不存在'); return; }
  await api('DELETE', '/repos/adfdfjjnny/physics-teaching/contents/' + enc, {
    message: '清理示例文件',
    sha: r.sha,
    branch: 'main'
  });
  console.log('  ✅ ' + f);
}

async function main() {
  console.log('删除7个示例文件...\n');
  for (var i = 0; i < files.length; i++) {
    await del(files[i]);
  }
  console.log('\n完成！请运行部署命令更新网站。');
}
main().catch(function(e) { console.error('Error:', e.message); });
