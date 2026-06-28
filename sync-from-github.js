var fs = require('fs');
var https = require('https');
var path = require('path');
var TOKEN = fs.readFileSync('.ghtoken', 'utf-8').trim();

var CATS = ['1-li','2-re','3-dianlu','4-dianci','5-lizi','6-guang','7-yuan'];

function get(url) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'api.github.com',
      path: url + '?ref=main',
      headers: {
        'Authorization': 'token ' + TOKEN,
        'Accept': 'application/vnd.github.raw+json',
        'User-Agent': 'sync'
      }
    };
    https.get(opts, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('从 GitHub 同步文件...\n');

  for (var i = 0; i < CATS.length; i++) {
    var cat = CATS[i];
    var dirUrl = '/repos/adfdfjjnny/physics-teaching/contents/' + cat;

    await new Promise(function(resolve) {
      https.get({
        hostname: 'api.github.com',
        path: dirUrl + '?ref=main',
        headers: {
          'Authorization': 'token ' + TOKEN,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'sync'
        }
      }, function(res) {
        var b = '';
        res.on('data', function(c) { b += c; });
        res.on('end', function() {
          try {
            var files = JSON.parse(b);
            if (!Array.isArray(files)) { resolve(); return; }
            Promise.all(files.map(function(f) {
              if (!/\.html?$/i.test(f.name)) return Promise.resolve();
              var localPath = path.join(cat, f.name);
              var authorPath = localPath + '.author';
              return get('/repos/adfdfjjnny/physics-teaching/contents/' + encodeURIComponent(cat + '/' + f.name)).then(function(data) {
                fs.writeFileSync(localPath, data);
                console.log('  ✅ ' + localPath);
                // 尝试下载 .author .question 和题目文件
                return Promise.all([
                  get('/repos/adfdfjjnny/physics-teaching/contents/' + encodeURIComponent(cat + '/' + f.name + '.author')).then(function(d) { fs.writeFileSync(authorPath, d); }).catch(function(){}),
                  get('/repos/adfdfjjnny/physics-teaching/contents/' + encodeURIComponent(cat + '/' + f.name + '.question')).then(function(d) {
                    fs.writeFileSync(localPath + '.question', d);
                    var qName = d.toString('utf-8').trim();
                    return get('/repos/adfdfjjnny/physics-teaching/contents/' + encodeURIComponent(cat + '/' + qName)).then(function(qd) {
                      fs.writeFileSync(path.join(cat, qName), qd);
                    }).catch(function(){});
                  }).catch(function(){})
                ]);
              });
            })).then(resolve);
          } catch(e) { resolve(); }
        });
      }).on('error', function() { resolve(); });
    });
  }

  // Also sync catalog.json
  try {
    var catData = await get('/repos/adfdfjjnny/physics-teaching/contents/catalog.json');
    fs.writeFileSync('catalog.json', catData);
    console.log('  ✅ catalog.json');
  } catch(e) {}

  console.log('\n同步完成！现在可以部署了。');
}
main().catch(function(e) { console.error('Error:', e.message); });
