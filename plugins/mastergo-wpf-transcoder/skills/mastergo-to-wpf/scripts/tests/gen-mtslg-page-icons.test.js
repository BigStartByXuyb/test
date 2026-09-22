#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', 'adapters/mtslg-iocontrol', 'gen-mtslg-page-icons.js');
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
      }, {
        // 祖先链上没有任何 rotate/flip：不得被自动烘焙（用于验证兜底不会误伤普通图标）。
        type: 'GROUP', id: 'page/plain', name: '组 9999',
        layoutStyle: { width: 26, height: 14, relativeX: 40, relativeY: 0 },
        children: [{
          type: 'PATH', id: 'page/plain/path', name: '路径 1',
          layoutStyle: { width: 26, height: 14, relativeX: 0, relativeY: 0 },
          path: [{ data: 'M26,4 L18,4 L18,0 L8,0 L8,4 L0,4 L12.999999,14 L26,4 Z' }]
        }]
      }]
    }]
  }
}, null, 2), 'utf8');
fs.writeFileSync(dslMapFile, JSON.stringify({ icons: [
  { sourceId: 'page/up/path', sourceRef: 'page/up/path', name: 'AutoBakedDslGeometry', comment: '祖先带朝向·未声明 bake', fromDsl: true },
  { sourceId: 'page/up/path', sourceRef: 'page/up/path', name: 'BakedDslGeometry', comment: '显式烘焙', fromDsl: true, bakeAncestorTransform: true },
  { sourceId: 'page/up/path', sourceRef: 'page/up/path', name: 'AutoFromSvgGeometry', comment: 'extractSvg 有条目但祖先带朝向' },
  { sourceId: 'page/plain/path', sourceRef: 'page/plain/path', name: 'UnbakedDslGeometry', comment: '祖先无朝向', fromDsl: true }
]}), 'utf8');
result = spawnSync(process.execPath, [script, emptySvgFile, dslMapFile, dslOut, dslSnapshotFile], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
const dslXaml = fs.readFileSync(dslOut, 'utf8');
const dslBody = key => dslXaml.match(new RegExp('x:Key="' + key + '">([\\s\\S]*?)</Geometry>'))[1];
// 祖先朝向自动烘焙（机械兜底）：方向只存在于祖先 rotate/flip 上，「DSL 但不烘焙」与
// extractSvg 一样表达不了它；过去靠台账手写 bakeAncestorTransform，漏写就静默出方向错的几何。
assert.match(dslBody('AutoBakedDslGeometry'), /M26,10 L18,10 L18,14 L8,14 L8,10 L0,10 L12\.999999,0/,
  '祖先带 flipV 且未声明 bake 时必须自动烘焙');
assert.strictEqual(dslBody('AutoBakedDslGeometry'), dslBody('BakedDslGeometry'),
  '自动烘焙结果必须与显式 bakeAncestorTransform 逐字符相同');
assert.match(result.stdout, /自动烘焙祖先朝向（台账未声明 bakeAncestorTransform）: /, '自动烘焙必须报告');
assert.match(result.stdout, /自动烘焙祖先朝向（台账未声明 bakeAncestorTransform）: [^\n]*AutoBakedDslGeometry/,
  '被自动烘焙的图标必须逐条列出');
assert.doesNotMatch(result.stdout, /自动烘焙祖先朝向[^\n]*UnbakedDslGeometry/,
  '祖先链无朝向的图标不得被自动烘焙');
// 祖先链无朝向：行为不变，仍是「PATH 自身 transform + 平移到原点」（与 extractSvg 等价，仅去掉偏移）。
assert.match(dslBody('UnbakedDslGeometry'), /M26,4 L18,4 L18,0 L8,0 L8,4 L0,4 L12\.999999,14/,
  '祖先无朝向时必须保持不烘焙');
assert.doesNotMatch(dslXaml, /PathGeometry|MatrixTransform|GeometryGroup/);

// extractSvg 恰好也有该条目时，仍必须改用 DSL 烘焙：extractSvg 只给 PATH 自身的
// d + transform，用它就会丢掉组级朝向——这正是「方向按钮四个方向出同一图形」的成因。
const autoSvgFile = path.join(dir, 'auto-bake-extractSvg.json');
const autoSvgOut = path.join(dir, 'AutoBakeFromSvgIcons.xaml');
fs.writeFileSync(autoSvgFile, JSON.stringify({ svgs: [
  { id: 'page/up/path', name: '组 1521', svg: '<svg><path d="M0,0L1,1"/></svg>' }
]}), 'utf8');
result = spawnSync(process.execPath, [script, autoSvgFile, dslMapFile, autoSvgOut, dslSnapshotFile], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
const autoSvgBody = key => fs.readFileSync(autoSvgOut, 'utf8').match(new RegExp('x:Key="' + key + '">([\\s\\S]*?)</Geometry>'))[1];
assert.match(autoSvgBody('AutoFromSvgGeometry'), /12\.999999,0/,
  'extractSvg 有条目但祖先带朝向时必须改用 DSL 烘焙（不得用方向错误的 extractSvg 几何）');

const noDslOut = path.join(dir, 'NoDslIcons.xaml');
result = spawnSync(process.execPath, [script, emptySvgFile, dslMapFile, noDslOut], { encoding: 'utf8' });
assert.notStrictEqual(result.status, 0, '缺少 DSL 快照时 fromDsl 条目必须失败');
assert.match(result.stderr, /needs the DSL snapshot/);

// 组收集：sourceRef 指向图标组时，必须把组内全部 PATH 合成同一条 Geometry。
// 多路径图标（如「双侧箭头」由两条路径拼成）在 extractSvg 里是一个条目、多条 d；
// DSL 合成必须同口径，否则只取第一条会让图标缺一半。这里用 extractSvg 做基准对比。
const groupSnapshotFile = path.join(dir, 'dsl-group.snapshot.json');
const groupMapFile = path.join(dir, 'dsl-group-map.json');
const groupOut = path.join(dir, 'DslGroupIcons.xaml');
const groupSvgFile = path.join(dir, 'group-extractSvg.json');
const P1 = 'M0,36L8,36L8,40L18,40L18,36L26,36L13.000001,26L0,36Z';
const P2 = 'M38,36L46,36L46,40L56,40L56.203125,36L64,36L51.000001,26L38,36Z';
const T1 = 'matrix(0,-1,1,0,-26,26)';
const T2 = 'matrix(0,-1,-1,0,64,64)';
fs.writeFileSync(groupSvgFile, JSON.stringify({ svgs: [{
  id: 'page/both',
  svg: '<svg><path d="' + P1 + '" transform="' + T1 + '"/><path d="' + P2 + '" transform="' + T2 + '"/></svg>'
}] }), 'utf8');
fs.writeFileSync(groupSnapshotFile, JSON.stringify({
  dsl: {
    nodes: [{
      type: 'INSTANCE', id: 'page', name: '页面',
      layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
      children: [
        {
          type: 'GROUP', id: 'page/both', name: '组 1525',
          layoutStyle: { width: 38, height: 26, relativeX: 0, relativeY: 0 },
          children: [
            {
              type: 'PATH', id: 'page/both/p1', name: '路径 119',
              layoutStyle: { width: 26, height: 14, relativeX: 0, relativeY: 0 },
              path: [{ data: P1, transform: T1 }]
            },
            {
              type: 'PATH', id: 'page/both/p2', name: '路径 120',
              layoutStyle: { width: 26, height: 14, relativeX: 12, relativeY: 0 },
              path: [{ data: P2, transform: T2 }]
            }
          ]
        },
        {
          type: 'GROUP', id: 'page/nopath', name: '按钮-指向上',
          layoutStyle: { width: 84, height: 48, relativeX: 0, relativeY: 0 },
          children: [{
            type: 'LAYER', id: 'page/nopath/rect', name: '矩形 127',
            layoutStyle: { width: 4, height: 10, relativeX: 0, relativeY: 0 }
          }]
        }
      ]
    }]
  }
}, null, 2), 'utf8');

fs.writeFileSync(groupMapFile, JSON.stringify({ icons: [
  { sourceId: 'page/both', sourceRef: 'page/both', name: 'GroupFromDsl', comment: '组收集', fromDsl: true },
  { sourceId: 'page/both', sourceRef: 'page/both/p1', name: 'GroupFromSvg', comment: 'extractSvg 基准' }
]}), 'utf8');
result = spawnSync(process.execPath, [script, groupSvgFile, groupMapFile, groupOut, groupSnapshotFile], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
const groupXaml = fs.readFileSync(groupOut, 'utf8');
const groupBody = key => groupXaml.match(new RegExp('x:Key="' + key + '">([\\s\\S]*?)</Geometry>'))[1];
assert.strictEqual((groupBody('GroupFromDsl').match(/\bM/g) || []).length, 2,
  '图标组的全部 PATH 必须合成同一条 Geometry（不得只取第一条）');
assert.strictEqual(
  groupBody('GroupFromDsl').replace(/\s+/g, ' ').trim(),
  groupBody('GroupFromSvg').replace(/\s+/g, ' ').trim(),
  '组收集（不烘焙）必须与 extractSvg 输出等价'
);
assert.doesNotMatch(groupXaml, /PathGeometry|MatrixTransform|GeometryGroup/);

// 组内没有 PATH 时必须明确失败，不得静默产出空图标
const noPathMapFile = path.join(dir, 'dsl-nopath-map.json');
const noPathOut = path.join(dir, 'DslNoPathIcons.xaml');
fs.writeFileSync(noPathMapFile, JSON.stringify({ icons: [
  { sourceId: 'page/nopath', sourceRef: 'page/nopath', name: 'NoPathGeometry', comment: '组内无路径', fromDsl: true }
]}), 'utf8');
result = spawnSync(process.execPath, [script, emptySvgFile, noPathMapFile, noPathOut, groupSnapshotFile], { encoding: 'utf8' });
assert.notStrictEqual(result.status, 0, '组内没有 PATH 时必须失败');
assert.match(result.stderr, /has no PATH with path data/);

// 自动烘焙改用 sourceId 解析的节点：extractSvg 是按 sourceId 取几何的，`sourceRef` 常只指向
// 图标里的单个 PATH（用来取 iconSize 的 bbox）。若自动烘焙时改用 sourceRef 收集，含多条 PATH 的
// 图标（如「双侧箭头」两条路径）会静默丢掉其它子路径——这正是 2026-09-18 回归里发现的丢图形问题。
const bakeBothSnapshotFile = path.join(dir, 'dsl-bake-both.snapshot.json');
const bakeBothMapFile = path.join(dir, 'dsl-bake-both-map.json');
const bakeBothOut = path.join(dir, 'DslBakeBothIcons.xaml');
fs.writeFileSync(bakeBothSnapshotFile, JSON.stringify({
  dsl: {
    nodes: [{
      type: 'INSTANCE', id: 'page', name: '页面',
      layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
      children: [{
        type: 'GROUP', id: 'page/both', name: '组 1525',
        layoutStyle: { width: 38, height: 26, relativeX: 0, relativeY: 0, flipV: true },
        children: [
          { type: 'PATH', id: 'page/both/p1', name: '路径 119',
            layoutStyle: { width: 26, height: 14, relativeX: 0, relativeY: 0 },
            path: [{ data: 'M0,0 L8,0 L8,4 L18,4 L18,0 L26,0 L13,14 Z' }] },
          { type: 'PATH', id: 'page/both/p2', name: '路径 120',
            layoutStyle: { width: 26, height: 14, relativeX: 12, relativeY: 0 },
            path: [{ data: 'M38,0 L30,0 L30,4 L20,4 L20,0 L12,0 L25,14 Z' }] }
        ]
      }]
    }]
  }
}, null, 2), 'utf8');
fs.writeFileSync(bakeBothMapFile, JSON.stringify({ icons: [
  // sourceId 指组（两条 PATH）、sourceRef 只指第一条 PATH（用来取 iconSize）；祖先带 flipV → 自动烘焙
  { sourceId: 'page/both', sourceRef: 'page/both/p1', name: 'AutoBakeBothGeometry', comment: '双侧·自动烘焙' },
  // 同一条目显式声明 bakeAncestorTransform：节点解析口径必须与自动烘焙一致，否则「写不写字段」
  // 会改变几何（自动用 sourceId 收全两条、显式用 sourceRef 只收一条）。
  { sourceId: 'page/both', sourceRef: 'page/both/p1', name: 'ExplicitBakeBothGeometry', comment: '双侧·显式烘焙', bakeAncestorTransform: true },
  // 显式 fromDsl + 显式烘焙：同样必须收全两条。
  { sourceId: 'page/both', sourceRef: 'page/both/p1', name: 'ExplicitDslBakeBothGeometry', comment: '双侧·fromDsl+烘焙', fromDsl: true, bakeAncestorTransform: true }
]}), 'utf8');
result = spawnSync(process.execPath, [script, groupSvgFile, bakeBothMapFile, bakeBothOut, bakeBothSnapshotFile], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
const bakeBothXaml = fs.readFileSync(bakeBothOut, 'utf8');
const bakeBothBody = (key) => bakeBothXaml.match(new RegExp('x:Key="' + key + '">([\\s\\S]*?)</Geometry>'))[1];
for (const key of ['AutoBakeBothGeometry', 'ExplicitBakeBothGeometry', 'ExplicitDslBakeBothGeometry']) {
  assert.strictEqual((bakeBothBody(key).match(/\bM/g) || []).length, 2,
    key + '：sourceRef 比 sourceId 窄时也必须按 sourceId 收集全部子路径（不得丢图形）');
}
assert.strictEqual(
  bakeBothBody('AutoBakeBothGeometry').replace(/\s+/g, ' ').trim(),
  bakeBothBody('ExplicitBakeBothGeometry').replace(/\s+/g, ' ').trim(),
  '自动烘焙与显式 bakeAncestorTransform 必须逐字符相同（节点解析口径唯一）'
);
assert.strictEqual(
  bakeBothBody('AutoBakeBothGeometry').replace(/\s+/g, ' ').trim(),
  bakeBothBody('ExplicitDslBakeBothGeometry').replace(/\s+/g, ' ').trim(),
  '自动烘焙与 fromDsl + bakeAncestorTransform 必须逐字符相同（节点解析口径唯一）'
);

console.log('PASS semantic icon naming regression test');
