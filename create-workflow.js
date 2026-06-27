const fs = require('fs');
const https = require('https');

const TOKEN = fs.readFileSync('.ghtoken', 'utf-8').trim();
const OWNER = 'adfdfjjnny';
const REPO = 'physics-teaching';

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
        'User-Agent': 'setup-workflow',
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

async function main() {
  var ref = await api('GET', '/repos/' + OWNER + '/' + REPO + '/git/ref/heads/main');
  var baseSha = ref.object.sha;
  console.log('Base sha:', baseSha);

  var commit = await api('GET', '/repos/' + OWNER + '/' + REPO + '/git/commits/' + baseSha);
  console.log('Base tree:', commit.tree.sha);

  var content = fs.readFileSync('.github/workflows/deploy.yml').toString('base64');
  var blob = await api('POST', '/repos/' + OWNER + '/' + REPO + '/git/blobs', {
    content: content,
    encoding: 'base64'
  });
  console.log('Blob:', blob.sha);

  var tree = await api('POST', '/repos/' + OWNER + '/' + REPO + '/git/trees', {
    base_tree: commit.tree.sha,
    tree: [{
      path: '.github/workflows/deploy.yml',
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    }]
  });
  console.log('Tree:', tree.sha);

  var newCommit = await api('POST', '/repos/' + OWNER + '/' + REPO + '/git/commits', {
    message: 'Add auto-deploy workflow',
    tree: tree.sha,
    parents: [baseSha]
  });
  console.log('Commit:', newCommit.sha);

  await api('PATCH', '/repos/' + OWNER + '/' + REPO + '/git/refs/heads/main', {
    sha: newCommit.sha,
    force: true
  });

  console.log('✅ Done! GitHub Action will auto-deploy!');
}

main().catch(function(e) { console.error('Error:', e.message); });
