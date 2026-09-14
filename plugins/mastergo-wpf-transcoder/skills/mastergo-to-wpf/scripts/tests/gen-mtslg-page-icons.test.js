#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', 'gen-mtslg-page-icons.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mastergo-icons-'));
const svgFile = path.join(dir, 'extractSvg.json');
const mapFile = path.join(dir, 'icon-map.json');
const outFile = path.join(dir, 'nested', 'PageIcon.xaml');

fs.writeFileSync(svgFile, JSON.stringify({ svgs: [
  { id: 'page/icon-a', svg: '<svg><path d="M0,0 L1,1"/></svg>' },
  { id: 'page/icon-b', svg: '<svg><path d="M1,1\nL2,2"/></svg>' },
  { id: 'page/icon-evenodd', svg: '<svg><path fill-rule="evenodd" d="M0,0 L1,0 Z"/></svg>' },
  { id: 'page/icon-nonzero', svg: '<svg><path fill-rule="nonzero" d="M0,0 L1,0 Z"/></svg>' }
] }), 'utf8');
fs.writeFileSync(mapFile, JSON.stringify({ icons: [
  { sourceId: 'page/icon-a', name: 'LoadGeometry', comment: '上料', sourceRef: 'dsl/a' },
  { sourceId: 'page/icon-b', name: 'LoadGeometry', comment: '上料重复', sourceRef: 'dsl/b' }
] }), 'utf8');

let result = spawnSync(process.execPath, [script, svgFile, mapFile, outFile], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
const xaml = fs.readFileSync(outFile, 'utf8');
assert.match(xaml, /<Geometry o:Freeze="True" x:Key="LoadGeometry">/);
assert.match(xaml, /<Geometry o:Freeze="True" x:Key="LoadGeometry2">/);
assert.doesNotMatch(xaml, /GeometryGroup|PathGeometry/);
assert.match(xaml, /<!-- 上料 -->/);
assert.doesNotMatch(xaml, /sourceId=|sourceRef=|key=LoadGeometry/);
assert.match(xaml, /    M1,1\r?\n    L2,2/);
assert.doesNotMatch(xaml, /MGIcon_/);

result = spawnSync(process.execPath, [script, svgFile, mapFile, outFile], { encoding: 'utf8' });
assert.notStrictEqual(result.status, 0);
assert.match(result.stderr, /页面 Icon 文件已存在|禁止覆盖/);

fs.writeFileSync(mapFile, JSON.stringify({ icons: [
  { sourceId: 'page/icon-a', name: 'MGIcon_123', comment: '测试', sourceRef: 'dsl/a' }
] }), 'utf8');
if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
result = spawnSync(process.execPath, [script, svgFile, mapFile, outFile], { encoding: 'utf8' });
assert.notStrictEqual(result.status, 0);
assert.match(result.stderr, /must not use the layer-id prefix/);

fs.writeFileSync(svgFile, JSON.stringify({ svgs: [
  { id: 'page/icon-transform', svg: '<svg><path d="M0,0 L1,0 L1,1 Z" transform="matrix(1,0,0,-1,0,10)"/></svg>' }
] }), 'utf8');
fs.writeFileSync(mapFile, JSON.stringify({ icons: [
  { sourceId: 'page/icon-transform', name: 'DownGeometry', comment: '向下', sourceRef: 'dsl/transform' }
] }), 'utf8');
if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
result = spawnSync(process.execPath, [script, svgFile, mapFile, outFile], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
const transformedXaml = fs.readFileSync(outFile, 'utf8');
assert.match(transformedXaml, /<Geometry o:Freeze="True" x:Key="DownGeometry">/);
assert.match(transformedXaml, /M0,10 L1,10 L1,9 Z/);
assert.doesNotMatch(transformedXaml, /PathGeometry|MatrixTransform/);

fs.writeFileSync(svgFile, JSON.stringify({ svgs: [
  { id: 'page/icon-evenodd', svg: '<svg><path fill-rule="evenodd" d="M0,0 L1,0 Z"/></svg>' },
  { id: 'page/icon-nonzero', svg: '<svg><path fill-rule="nonzero" d="M0,0 L1,0 Z"/></svg>' }
] }), 'utf8');
fs.writeFileSync(mapFile, JSON.stringify({ icons: [
  { sourceId: 'page/icon-evenodd', name: 'EvenOddGeometry', comment: '奇偶', sourceRef: 'dsl/evenodd' },
  { sourceId: 'page/icon-nonzero', name: 'NonzeroGeometry', comment: '非零', sourceRef: 'dsl/nonzero' }
] }), 'utf8');
if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
result = spawnSync(process.execPath, [script, svgFile, mapFile, outFile], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
const fillRuleXaml = fs.readFileSync(outFile, 'utf8');
// 框架不使用 F0/F1 填充规则标记，固定不输出：Geometry 首行必须直接是路径数据
assert.match(fillRuleXaml, /x:Key="EvenOddGeometry">\r?\n\s+M0,0 L1,0 Z/);
assert.match(fillRuleXaml, /x:Key="NonzeroGeometry">\r?\n\s+M0,0 L1,0 Z/);
assert.doesNotMatch(fillRuleXaml, /<Geometry[^>]*>\r?\n\s+F[01]\s/);

fs.writeFileSync(mapFile, JSON.stringify({ icons: [] }), 'utf8');
const emptyOut = path.join(dir, 'EmptyIcons.xaml');
result = spawnSync(process.execPath, [script, svgFile, mapFile, emptyOut], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
assert.doesNotMatch(fs.readFileSync(emptyOut, 'utf8'), /<Geometry\b/);

// 填充规则策略：重复子路径去重；只有真正依赖 Nonzero 的图标才补回 F1
const policySvg = { svgs: [
  { id: 'page/icon-dup', svg: '<svg><path fill-rule="nonzero" d="M0,0 L10,0 L10,10 L0,10 Z M0,0 L10,0 L10,10 L0,10 Z"/></svg>' },
  { id: 'page/icon-overlap-nonzero', svg: '<svg><path fill-rule="nonzero" d="M0,0 L100,0 L100,100 L0,100 Z M30,30 L70,30 L70,70 L30,70 Z"/></svg>' },
  { id: 'page/icon-overlap-evenodd', svg: '<svg><path fill-rule="evenodd" d="M0,0 L100,0 L100,100 L0,100 Z M30,30 L70,30 L70,70 L30,70 Z"/></svg>' }
] };
const policyMap = { icons: [
  { sourceId: 'page/icon-dup', name: 'DupGeometry', comment: '重复', sourceRef: 'dsl/dup' },
  { sourceId: 'page/icon-overlap-nonzero', name: 'OverlapNonzeroGeometry', comment: '重叠非零', sourceRef: 'dsl/ovn' },
  { sourceId: 'page/icon-overlap-evenodd', name: 'OverlapEvenOddGeometry', comment: '重叠奇偶', sourceRef: 'dsl/ove' }
] };
const policySvgFile = path.join(dir, 'policy-svg.json');
const policyMapFile = path.join(dir, 'policy-map.json');
const policyOut = path.join(dir, 'PolicyIcons.xaml');
fs.writeFileSync(policySvgFile, JSON.stringify(policySvg), 'utf8');
fs.writeFileSync(policyMapFile, JSON.stringify(policyMap), 'utf8');
result = spawnSync(process.execPath, [script, policySvgFile, policyMapFile, policyOut], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
const policyXaml = fs.readFileSync(policyOut, 'utf8');
const bodyOf = key => policyXaml.match(new RegExp('x:Key="' + key + '">([\\s\\S]*?)</Geometry>'))[1];
assert.strictEqual((bodyOf('DupGeometry').match(/\bM/g) || []).length, 1, '重复子路径必须去重');
assert.doesNotMatch(bodyOf('DupGeometry'), /^\s*F[01]\s*$/m, '去重后不需要填充规则标记');
assert.match(bodyOf('OverlapNonzeroGeometry'), /^\s*F1\s*$/m, '依赖 Nonzero 的图标必须补回 F1');
assert.doesNotMatch(bodyOf('OverlapEvenOddGeometry'), /^\s*F[01]\s*$/m, '原规则为 EvenOdd 的图标不得写标记');
assert.match(result.stdout, /保留 F1（渲染依赖 Nonzero）: OverlapNonzeroGeometry/);
assert.match(result.stdout, /去重重复子路径: DupGeometry\(-1\)/);

// DSL 补充来源：extractSvg 因几何完全相同的复用而缺条目时，从 DSL 合成；
// bakeAncestorTransform 额外把组级 rotate/flip 烘焙进坐标（用于方向图标）。
const dslSnapshotFile = path.join(dir, 'dsl.snapshot.json');
const dslMapFile = path.join(dir, 'dsl-icon-map.json');
const dslOut = path.join(dir, 'DslIcons.xaml');
const emptySvgFile = path.join(dir, 'empty-extractSvg.json');
fs.writeFileSync(emptySvgFile, JSON.stringify({ svgs: [] }), 'utf8');
fs.writeFileSync(dslSnapshotFile, JSON.stringify({
  dsl: {
    nodes: [{
      type: 'INSTANCE', id: 'page', name: '页面',
      layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
      children: [{
        type: 'GROUP', id: 'page/up', name: '组 1521',
        layoutStyle: { width: 26, height: 28, relativeX: 0, relativeY: 0, flipV: true },
        children: [{
          type: 'PATH', id: 'page/up/path', name: '路径 119',
          layoutStyle: { width: 26, height: 14, relativeX: 0, relativeY: 10 },
          path: [{ data: 'M26,38L34,38L34,42L44,42L44,38L52,38L39.000001,28L26,38Z', transform: 'matrix(-1,0,0,-1,52,56)' }]
        }]
      }]
    }]
  }
}, null, 2), 'utf8');
fs.writeFileSync(dslMapFile, JSON.stringify({ icons: [
  { sourceId: 'page/up/path', sourceRef: 'page/up/path', name: 'PlainDslGeometry', comment: '未烘焙', fromDsl: true },
  { sourceId: 'page/up/path', sourceRef: 'page/up/path', name: 'BakedDslGeometry', comment: '已烘焙', fromDsl: true, bakeAncestorTransform: true }
]}), 'utf8');
result = spawnSync(process.execPath, [script, emptySvgFile, dslMapFile, dslOut, dslSnapshotFile], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
const dslXaml = fs.readFileSync(dslOut, 'utf8');
const dslBody = key => dslXaml.match(new RegExp('x:Key="' + key + '">([\\s\\S]*?)</Geometry>'))[1];
// 默认合成 = 「PATH 自身 transform」的结果并平移到原点（与 extractSvg 的原始几何等价，仅去掉偏移）
assert.match(dslBody('PlainDslGeometry'), /M26,4 L18,4 L18,0 L8,0 L8,4 L0,4 L12\.999999,14/, '默认合成必须与 extractSvg 输出等价（不烘焙祖先变换）');
assert.match(dslBody('PlainDslGeometry'), /12\.999999,14/, '默认合成的尖端在下方（未翻转）');
assert.match(dslBody('BakedDslGeometry'), /M26,10 L18,10 L18,14 L8,14 L8,10 L0,10 L12\.999999,0/, '组级 flipV 必须烘焙进坐标');
assert.match(dslBody('BakedDslGeometry'), /12\.999999,0/, '烘焙后尖端翻到上方');
assert.doesNotMatch(dslXaml, /PathGeometry|MatrixTransform|GeometryGroup/);

const noDslOut = path.join(dir, 'NoDslIcons.xaml');
result = spawnSync(process.execPath, [script, emptySvgFile, dslMapFile, noDslOut], { encoding: 'utf8' });
assert.notStrictEqual(result.status, 0, '缺少 DSL 快照时 fromDsl 条目必须失败');
assert.match(result.stderr, /needs the DSL snapshot/);

console.log('PASS semantic icon naming regression test');
