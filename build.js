/**
 * 物理教学网站构建脚本
 * 扫描分类文件夹中的所有HTML文件，自动生成catalog.json
 * Netlify部署时自动运行: node build.js
 */

const fs = require('fs');
const path = require('path');

// 七大类别的元数据定义
const CATEGORIES = [
  {
    id: '1-li',
    name: '力',
    fullName: '力学',
    emoji: '🍎',
    description: '牛顿定律、运动学、万有引力等',
    color: '#2563eb'
  },
  {
    id: '2-re',
    name: '热',
    fullName: '热学',
    emoji: '🔥',
    description: '热力学定律、分子动理论等',
    color: '#dc2626'
  },
  {
    id: '3-dianlu',
    name: '电路',
    fullName: '电路',
    emoji: '⚡',
    description: '欧姆定律、串并联电路、基尔霍夫等',
    color: '#f59e0b'
  },
  {
    id: '8-dianchang',
    name: '电场',
    fullName: '电场',
    emoji: '🔵',
    description: '电场强度、电场线、电势、电容器等',
    color: '#0891b2'
  },
  {
    id: '4-dianci',
    name: '电磁感应',
    fullName: '电磁感应',
    emoji: '🧲',
    description: '法拉第定律、楞次定律、互感自感等',
    color: '#10b981'
  },
  {
    id: '5-lizi',
    name: '带电粒子',
    fullName: '带电粒子在磁场中运动',
    emoji: '⚛️',
    description: '洛伦兹力、圆周运动、质谱仪等',
    color: '#8b5cf6'
  },
  {
    id: '6-guang',
    name: '光',
    fullName: '光学',
    emoji: '💡',
    description: '几何光学、波动光学、干涉衍射等',
    color: '#f97316'
  },
  {
    id: '7-yuan',
    name: '原',
    fullName: '原子物理',
    emoji: '🔬',
    description: '玻尔模型、能级跃迁、原子核等',
    color: '#6b7280'
  }
];

/**
 * 从文件名生成可读标题
 * 支持中英文文件名，自动转换分隔符
 */
function filenameToTitle(filename) {
  // 去掉.html后缀
  let name = filename.replace(/\.html?$/i, '');
  // 将连字符、下划线、点替换为空格
  name = name.replace(/[-_.]+/g, ' ');
  // 多个空格合并为一个
  name = name.replace(/\s+/g, ' ').trim();
  // 如果转换后为空或很短，使用原始文件名
  return name || filename;
}

/**
 * 扫描单个分类文件夹，返回该分类下的程序列表
 */
function scanCategory(cat) {
  const dirPath = path.join(__dirname, cat.id);
  const programs = [];

  if (!fs.existsSync(dirPath)) {
    console.log(`  ⚠ 文件夹不存在: ${cat.id}/`);
    return { ...cat, programs };
  }

  const files = fs.readdirSync(dirPath);

  // 筛选HTML文件，排除隐藏文件和 _pending 目录
  const htmlFiles = files.filter(f => {
    return /\.html?$/i.test(f) && !f.startsWith('.');
  });
  // 额外：确保 _pending 中的文件不会被扫描到
  // （_pending 目录本身不在 category 子目录中，所以不会进入扫描范围）

  // 按文件名排序（数字前缀优先）
  htmlFiles.sort((a, b) => a.localeCompare(b, 'zh-CN'));

  for (const file of htmlFiles) {
    // 尝试读取作者信息
    let author = '';
    const authorFile = path.join(dirPath, file + '.author');
    if (fs.existsSync(authorFile)) {
      try {
        author = fs.readFileSync(authorFile, 'utf-8').trim();
      } catch {}
    }
    programs.push({
      file: file,
      title: filenameToTitle(file),
      path: `${cat.id}/${file}`,
      author: author || ''
    });
  }

  console.log(`  📂 ${cat.name} (${cat.fullName}): ${programs.length} 个程序`);
  return { ...cat, programs };
}

/**
 * 主函数：扫描所有类别并生成catalog.json
 */
function main() {
  console.log('🔍 扫描物理教学程序目录...\n');

  const categories = CATEGORIES.map(scanCategory);

  const totalPrograms = categories.reduce((sum, c) => sum + c.programs.length, 0);

  const catalog = {
    categories: categories,
    totalPrograms: totalPrograms,
    updatedAt: new Date().toISOString()
  };

  // 写入catalog.json
  const outputPath = path.join(__dirname, 'catalog.json');
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2), 'utf-8');

  console.log(`\n✅ 目录生成完成！共 ${totalPrograms} 个教学程序`);
  console.log(`📄 输出文件: catalog.json\n`);
}

main();
