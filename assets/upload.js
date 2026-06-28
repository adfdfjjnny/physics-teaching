// 上传功能（多组一对一配对）
var uploadModal__ = document.getElementById('uploadModal');
var uploadPairs__ = document.getElementById('uploadPairs');
var btnSubmit__ = document.getElementById('btnSubmitUpload');
var btnSubmitText__ = document.getElementById('btnSubmitText');
var uploadSpinner__ = document.getElementById('uploadSpinner');
var uploadStatus__ = document.getElementById('uploadStatus');
var pairIdCounter__ = 0;
var pairs__ = [];

document.getElementById('btnOpenUpload').onclick = function() {
  resetUploadForm__();
  uploadModal__.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  addPair__();
};

document.getElementById('btnCloseUpload').onclick = closeModal__;
uploadModal__.onclick = function(e) { if (e.target === uploadModal__) closeModal__(); };

function closeModal__() {
  uploadModal__.style.display = 'none'; document.body.style.overflow = '';
  resetUploadForm__();
}

function resetUploadForm__() {
  pairs__ = []; pairIdCounter__ = 0; uploadPairs__.innerHTML = '';
  btnSubmit__.disabled = true;
  uploadStatus__.style.display = 'none'; uploadStatus__.className = 'upload-status'; uploadStatus__.textContent = '';
  btnSubmitText__.textContent = '上传到服务器'; uploadSpinner__.style.display = 'none';
}

function addPair__() {
  var id = ++pairIdCounter__;
  pairs__.push({ id: id, htmlFile: null, questionFile: null });
  var div = document.createElement('div');
  div.className = 'upload-pair';
  div.id = 'pair' + id;
  div.innerHTML =
    '<div class="pair-header"><strong>#' + id + '</strong> <button class="pair-remove" data-pid="' + id + '" style="display:none">✕</button></div>' +
    '<label class="form-label-sm">HTML 程序</label>' +
    '<div class="file-drop-zone file-drop-zone-sm" id="htmlZone' + id + '">' +
    '<input type="file" id="htmlFile' + id + '" accept=".html,.htm" class="file-input-hidden">' +
    '<div class="file-drop-content"><span class="file-drop-icon">📁</span><span id="htmlText' + id + '">点击选择 .html 文件</span></div></div>' +
    '<div class="file-preview" id="htmlPreview' + id + '" style="display:none">' +
    '<span class="file-preview-icon">📄</span><span class="file-preview-name" id="htmlName' + id + '"></span></div>' +
    '<label class="form-label-sm">📝 题目附件（可选）</label>' +
    '<div class="file-drop-zone file-drop-zone-sm" id="qZone' + id + '">' +
    '<input type="file" id="qFile' + id + '" accept=".doc,.docx,.jpg,.jpeg,.png,.pdf" class="file-input-hidden">' +
    '<div class="file-drop-content"><span class="file-drop-icon">📎</span><span id="qText' + id + '">点击选择题目文件</span></div></div>' +
    '<div class="file-preview" id="qPreview' + id + '" style="display:none">' +
    '<span class="file-preview-icon">📝</span><span class="file-preview-name" id="qName' + id + '"></span></div>';
  uploadPairs__.appendChild(div);

  var htmlInput = document.getElementById('htmlFile' + id);
  var qInput = document.getElementById('qFile' + id);
  var removeBtn = div.querySelector('.pair-remove');

  document.getElementById('htmlZone' + id).onclick = function() { htmlInput.click(); };
  document.getElementById('qZone' + id).onclick = function() { qInput.click(); };

  htmlInput.onchange = function() {
    if (htmlInput.files.length > 0) {
      var f = htmlInput.files[0];
      if (f.size > 5*1024*1024) { alert('文件不能超过 5MB'); return; }
      var p = pairs__.find(function(x) { return x.id === id; }); if (p) p.htmlFile = f;
      document.getElementById('htmlPreview' + id).style.display = 'flex';
      document.getElementById('htmlName' + id).textContent = f.name + ' (' + formatSize__(f.size) + ')';
      document.getElementById('htmlText' + id).textContent = '✅ ' + f.name;
      removeBtn.style.display = 'inline-block'; updateSubmitBtn__();
    }
  };

  qInput.onchange = function() {
    if (qInput.files.length > 0) {
      var f = qInput.files[0];
      if (f.size > 10*1024*1024) { alert('题目不能超过 10MB'); return; }
      var p = pairs__.find(function(x) { return x.id === id; }); if (p) p.questionFile = f;
      document.getElementById('qPreview' + id).style.display = 'flex';
      document.getElementById('qName' + id).textContent = f.name + ' (' + formatSize__(f.size) + ')';
      document.getElementById('qText' + id).textContent = '✅ ' + f.name;
    }
  };

  removeBtn.onclick = function(e) {
    e.stopPropagation(); e.preventDefault();
    document.getElementById('pair' + id).remove();
    pairs__ = pairs__.filter(function(x) { return x.id !== id; });
    updateSubmitBtn__();
    if (pairs__.length === 0) addPair__();
  };

  if (pairs__.length > 1) {
    document.querySelectorAll('.pair-remove').forEach(function(b) { b.style.display = 'inline-block'; });
  }
}

function updateSubmitBtn__() { btnSubmit__.disabled = !pairs__.some(function(p) { return p.htmlFile !== null; }); }

document.getElementById('btnAddPair').onclick = function(e) { e.preventDefault(); addPair__(); };

btnSubmit__.onclick = async function() {
  var validPairs = pairs__.filter(function(p) { return p.htmlFile !== null; });
  if (validPairs.length === 0) return;

  var category = document.getElementById('uploadCategory').value;
  btnSubmit__.disabled = true;
  uploadSpinner__.style.display = 'inline-block';
  uploadStatus__.style.display = 'block';
  uploadStatus__.className = 'upload-status status-info';

  var okCount = 0, failCount = 0;
  for (var i = 0; i < validPairs.length; i++) {
    var p = validPairs[i];
    btnSubmitText__.textContent = '上传中 (' + (i+1) + '/' + validPairs.length + ')...';
    uploadStatus__.textContent = '⏳ ' + p.htmlFile.name;

    try {
      var base64 = await readFileAsBase64__(p.htmlFile);
      var body = { category: category, filename: p.htmlFile.name, content: base64 };
      if (p.questionFile) {
        body.questionContent = await readFileAsBase64__(p.questionFile);
        body.questionFile = p.questionFile.name;
      }
      var resp = await fetch('/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      var data = await resp.json();
      if (data.ok) okCount++; else failCount++;
    } catch (e) { failCount++; }
  }

  uploadStatus__.className = 'upload-status ' + (failCount === 0 ? 'status-success' : 'status-info');
  uploadStatus__.innerHTML = '✅ ' + okCount + ' 成功' + (failCount > 0 ? ' ❌ ' + failCount + ' 失败' : '');
  btnSubmitText__.textContent = '完成！';
  uploadSpinner__.style.display = 'none';
  if (failCount === 0) {
    setTimeout(function() { closeModal__(); showToast(okCount + ' 组文件已提交'); }, 3000);
  } else {
    btnSubmit__.disabled = false; btnSubmitText__.textContent = '重试';
  }
};

function formatSize__(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(2) + ' MB';
}

function readFileAsBase64__(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result.split(',')[1]); };
    reader.onerror = function() { reject(new Error('读取失败')); };
    reader.readAsDataURL(file);
  });
}
