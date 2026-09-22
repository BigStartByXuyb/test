'use strict';

// apply-container-containment.js 回归：完全包含 / 最小面积 / 冲突（并列面积、压边、环）/
// 宿主壳排除 / 幂等。

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', 'adapters/mtslg-iocontrol', 'apply-container-containment.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'containment-'));

const templateMap = path.join(dir, 'map.json');
fs.writeFileSync(templateMap, JSON.stringify({
  infoGroupTemplates: {
    match: { componentSet: true },
    variants: {
      '信息分组-模块化': { componentSet: '信息分组-模块化', controlType: 'GroupBox', childPolicy: 'nested-page-templates' },
      '信息模块-手动控制弹层': { componentSet: '信息模块-手动控制弹层', controlType: 'GroupBox', childPolicy: 'nested-page-templates' },
      '普通组件': { componentSet: '普通组件', controlType: 'GroupBox' }
    }
  }
}, null, 2), 'utf8');

function source(ref, parentRef, name, x, y, w, h) {
  return {
    ref, parentRef, name, pageAbsX: x, pageAbsY: y, width: w, height: h,
    relativeX: x, relativeY: y
  };
}

function node(ref, xmlId, controlType, contentInset) {
  return {
    ref, xmlId, sourceRef: ref, sourceParent: null, controlType, parent: null, layoutParent: null,
    absX: 0, absY: 0, w: 1, h: 1,
    expectedLeft: 0, expectedTop: 0, expectedWidth: 1, expectedHeight: 1, attrs: {},
    ...(contentInset ? { contentInset } : {})
  };
}

// 容器内容区原点（边框 + 标题条高）：与映射表 infoGroupTemplates.styleInsets 同口径。
const SECONDARY_INSET = { left: 1, top: 35 };

function runContainment(mappingPath, outPath, reportPath) {
  return spawnSync(process.execPath, [script,
    '--mapping', mappingPath, '--template-map', templateMap,
    '--out', outPath, '--report', reportPath], { encoding: 'utf8' });
}

// ---- 场景 A：完全包含 / 最小面积 / 宿主壳 / 越界 / 容器套容器 / 幂等 ----
const mappingA = path.join(dir, 'mapping-a.json');
const outA = path.join(dir, 'out-a.json');
const reportA = path.join(dir, 'report-a.json');
fs.writeFileSync(mappingA, JSON.stringify({
  rootRef: 'root',
  contentOriginY: 192,
  componentInstances: [
    { template: 'infoGroupTemplates', componentSet: '信息分组-模块化', instanceRef: 'group' },
    { template: 'infoGroupTemplates', componentSet: '信息模块-手动控制弹层', instanceRef: 'popup' },
    { template: 'infoGroupTemplates', componentSet: '普通组件', instanceRef: 'plain' }
  ],
  sourceNodes: [
    source('root', null, '页面', 0, 0, 1280, 1024),
    source('popup', 'root', '信息模块-手动控制弹层', 50, 150, 400, 300),
    source('group', 'root', '信息分组-模块化', 100, 200, 200, 150),
    source('inside-a', 'root', '输入框', 120, 300, 60, 30),
    source('inside-b', 'root', '标签', 130, 300, 40, 16),
    source('edge', 'root', '压边文本', 440, 340, 20, 16),
    source('outside', 'root', '说明', 500, 300, 60, 20),
    source('bg', 'root', '背景常驻信息', 0, 0, 1280, 1024)
  ],
  nodes: [
    node('popup', 'MG_POPUP', 'GroupBox', SECONDARY_INSET),
    node('group', 'MG_GROUP', 'GroupBox', SECONDARY_INSET),
    node('inside-a', 'MG_A', 'NumberBox'),
    node('inside-b', 'MG_B', 'TextBlock'),
    node('edge', 'MG_EDGE', 'TextBlock'),
    node('outside', 'MG_OUT', 'TextBlock'),
    node('bg', 'MG_BG', 'Border')
  ]
}, null, 2), 'utf8');

let result = runContainment(mappingA, outA, reportA);
assert.strictEqual(result.status, 0, result.stderr);
const out = JSON.parse(fs.readFileSync(outA, 'utf8'));
const report = JSON.parse(fs.readFileSync(reportA, 'utf8'));
const byRef = ref => out.nodes.find(item => item.ref === ref);

assert.strictEqual(report.containers.length, 2, '只有 childPolicy=nested-page-templates 的变体算容器');
assert.strictEqual(byRef('inside-a').layoutParent, 'group', '多容器包含时挂到面积最小者');
assert.strictEqual(byRef('inside-b').layoutParent, 'group');
assert.strictEqual(byRef('inside-a').parent, 'group', 'parent 与 layoutParent 必须同时写');
// 子坐标从"内容区原点"量：abs − 容器左上角 − inset
// （容器 Style 恒为空串，原点由变体的 contentInsetStyle=IOGroupBoxSecondary 查表得 {1,35}）
assert.strictEqual(byRef('inside-a').expectedLeft, 19, '嵌套坐标按父容器内容区原点相对');
assert.strictEqual(byRef('inside-a').expectedTop, 65);
assert.strictEqual(byRef('group').layoutParent, 'popup', '内层容器应挂到外层容器');
assert.strictEqual(byRef('group').expectedLeft, 49);
assert.strictEqual(byRef('group').expectedTop, 15);
assert.strictEqual(byRef('popup').layoutParent, null, '最外层容器保持根级');
assert.strictEqual(byRef('popup').expectedTop, 0, '未重挂的节点保持原坐标不变');
assert.strictEqual(byRef('edge').layoutParent, null, '越界控件不得被重挂');
assert.ok(report.conflicts.some(item => item.ref === 'edge' && item.reason === 'partial-overlap'), '越界必须记冲突');
assert.ok(!report.conflicts.some(item => item.ref === 'popup'), '容器之间的正常重叠不得记冲突');
assert.ok(!report.conflicts.some(item => item.ref === 'group'), '内层容器不得记冲突');
assert.strictEqual(byRef('bg').layoutParent, null);
assert.ok(!report.conflicts.some(item => item.ref === 'bg'), '宿主壳节点不得记冲突');
assert.strictEqual(byRef('outside').layoutParent, null);
assert.strictEqual(byRef('outside').expectedTop, 0, '容器外节点不受影响（坐标保持原值）');
assert.strictEqual(byRef('inside-a').expectedWidth, 1, '尺寸字段不得被改写');

const outA2 = path.join(dir, 'out-a2.json');
const reportA2 = path.join(dir, 'report-a2.json');
result = runContainment(outA, outA2, reportA2);
assert.strictEqual(result.status, 0, result.stderr);
const report2 = JSON.parse(fs.readFileSync(reportA2, 'utf8'));
assert.strictEqual(report2.reparented.length, 0, '重复执行不应再次重挂');
assert.strictEqual(report2.unchanged, report.reparented.length, '已挂节点计入 unchanged');
assert.strictEqual(fs.readFileSync(outA2, 'utf8'), fs.readFileSync(outA, 'utf8'), '幂等：输出逐字节一致');

// ---- 场景 B：面积并列 → 冲突、保持原状 ----
const mappingB = path.join(dir, 'mapping-b.json');
const outB = path.join(dir, 'out-b.json');
const reportB = path.join(dir, 'report-b.json');
fs.writeFileSync(mappingB, JSON.stringify({
  rootRef: 'root',
  contentOriginY: 192,
  componentInstances: [
    { template: 'infoGroupTemplates', componentSet: '信息分组-模块化', instanceRef: 'c1' },
    { template: 'infoGroupTemplates', componentSet: '信息模块-手动控制弹层', instanceRef: 'c2' }
  ],
  sourceNodes: [
    source('root', null, '页面', 0, 0, 1280, 1024),
    source('c1', 'root', '信息分组-模块化', 100, 200, 200, 100),
    source('c2', 'root', '信息模块-手动控制弹层', 100, 200, 200, 100),
    source('target', 'root', '输入框', 150, 240, 40, 20)
  ],
  nodes: [node('c1', 'MG_C1', 'GroupBox', SECONDARY_INSET), node('c2', 'MG_C2', 'GroupBox', SECONDARY_INSET), node('target', 'MG_T', 'NumberBox')]
}, null, 2), 'utf8');
result = runContainment(mappingB, outB, reportB);
assert.strictEqual(result.status, 0, result.stderr);
const outBJson = JSON.parse(fs.readFileSync(outB, 'utf8'));
const reportBJson = JSON.parse(fs.readFileSync(reportB, 'utf8'));
assert.strictEqual(outBJson.nodes.find(item => item.ref === 'target').layoutParent, null, '面积并列时不得重挂');
assert.ok(reportBJson.conflicts.some(item => item.ref === 'target' && item.reason === 'ambiguous-smallest-container'),
  '面积并列必须记冲突');

// ---- 场景 C：容器是节点的 DSL 后代 → 会成环 → 冲突、不挂 ----
const mappingC = path.join(dir, 'mapping-c.json');
const outC = path.join(dir, 'out-c.json');
const reportC = path.join(dir, 'report-c.json');
fs.writeFileSync(mappingC, JSON.stringify({
  rootRef: 'root',
  contentOriginY: 192,
  componentInstances: [
    { template: 'infoGroupTemplates', componentSet: '信息分组-模块化', instanceRef: 'wrap/inner' }
  ],
  sourceNodes: [
    source('root', null, '页面', 0, 0, 1280, 1024),
    source('wrap', 'root', '外壳文本', 100, 200, 200, 150),
    source('wrap/inner', 'wrap', '信息分组-模块化', 100, 200, 200, 150)
  ],
  nodes: [node('wrap', 'MG_WRAP', 'Border'), node('wrap/inner', 'MG_INNER', 'GroupBox', SECONDARY_INSET)]
}, null, 2), 'utf8');
result = runContainment(mappingC, outC, reportC);
assert.strictEqual(result.status, 0, result.stderr);
const outCJson = JSON.parse(fs.readFileSync(outC, 'utf8'));
const reportCJson = JSON.parse(fs.readFileSync(reportC, 'utf8'));
  assert.strictEqual(outCJson.nodes.find(item => item.ref === 'wrap').layoutParent, null, '环场景不得重挂');
  assert.ok(reportCJson.conflicts.some(item => item.reason === 'container-is-descendant-of-node'), '环场景必须记冲突');

  // ---- 场景 D：表格落在信息分组里 —— DataGrid 收进容器，列定义留在 DataGrid 下不被抢走 ----
  // 列定义是表格模板按表头派生的结构节点（nodeKind=table-column），生成时已经挂在 DataGrid 下；
  // DataGrid 不是容器候选，只按坐标判断会把列从 DataGrid 抢到外层容器，导致 DataGrid 变空壳。
  const mappingD = path.join(dir, 'mapping-d.json');
  const outD = path.join(dir, 'out-d.json');
  const reportD = path.join(dir, 'report-d.json');
  fs.writeFileSync(mappingD, JSON.stringify({
    rootRef: 'root',
    contentOriginY: 192,
    componentInstances: [
      { template: 'infoGroupTemplates', componentSet: '信息分组-模块化', instanceRef: 'group' }
    ],
    sourceNodes: [
      source('root', null, '页面', 0, 0, 1280, 1024),
      source('group', 'root', '信息分组-模块化', 100, 200, 400, 300),
      source('grid', 'root', '步进数据界面表格', 120, 240, 300, 200),
      source('col1', 'grid', '1', 140, 250, 8, 16),
      source('col2', 'grid', '2', 200, 250, 8, 16)
    ],
    nodes: [
      node('group', 'MG_GROUP', 'GroupBox', SECONDARY_INSET),
      node('grid', 'MG_GRID', 'DataGrid'),
      Object.assign(node('col1', 'MGCOL_1', 'TextBlock'), { parent: 'grid', layoutParent: 'grid', nodeKind: 'table-column' }),
      Object.assign(node('col2', 'MGCOL_2', 'TextBlock'), { parent: 'grid', layoutParent: 'grid', nodeKind: 'table-column' })
    ]
  }, null, 2), 'utf8');
  result = runContainment(mappingD, outD, reportD);
  assert.strictEqual(result.status, 0, result.stderr);
  const outDJson = JSON.parse(fs.readFileSync(outD, 'utf8'));
  const reportDJson = JSON.parse(fs.readFileSync(reportD, 'utf8'));
  const dByRef = ref => outDJson.nodes.find(item => item.ref === ref);
  assert.strictEqual(dByRef('grid').layoutParent, 'group', 'DataGrid 应被收进信息分组');
  assert.strictEqual(dByRef('grid').expectedLeft, 19, 'DataGrid 坐标按容器内容区原点相对');
  assert.strictEqual(dByRef('grid').expectedTop, 5);
  assert.strictEqual(dByRef('col1').layoutParent, 'grid', '列定义必须留在 DataGrid 下，不得被容器抢走');
  assert.strictEqual(dByRef('col2').layoutParent, 'grid');
  assert.ok(!reportDJson.reparented.some(item => item.ref === 'col1'),
    '列定义不得出现在 reparented 里');
  assert.ok(reportDJson.skipped.some(item => item.ref === 'col1' && item.reason === 'already-owned-by-non-container-node'),
    '已有归属（父节点为非容器的已发射节点）的列必须被守卫拦下并记 skipped');

  // ---- 场景 E：Align=Right 的 TextBlock 收进容器时，Left 按"到容器外框右边缘的距离"重算 ----
  // 口径见映射表 textBlockAlign.distance*：Left = 容器外框右边缘 − (控件绝对X + 设计稿 bbox 宽)；
  // Top 不受影响（仍按内容区原点 inset.top）。容器外框右边缘 = 容器绝对X + 容器宽（不是内容区右边缘）。
  const mappingE = path.join(dir, 'mapping-e.json');
  const outE = path.join(dir, 'out-e.json');
  const reportE = path.join(dir, 'report-e.json');
  fs.writeFileSync(mappingE, JSON.stringify({
    rootRef: 'root',
    contentOriginY: 192,
    componentInstances: [
      { template: 'infoGroupTemplates', componentSet: '信息分组-模块化', instanceRef: 'group' }
    ],
    sourceNodes: [
      source('root', null, '页面', 0, 0, 1280, 1024),
      source('group', 'root', '信息分组-模块化', 658, 514, 200, 160),
      source('right-text', 'root', '右对齐标签', 682, 578, 10, 16),
      source('left-text', 'root', '左对齐标签', 682, 620, 30, 16)
    ],
    nodes: [
      node('group', 'MG_GROUP', 'GroupBox', SECONDARY_INSET),
      Object.assign(node('right-text', 'MG_RIGHT', 'TextBlock'),
        { attrs: { ControlType: 'TextBlock', Align: 'Right' }, dslWidth: 10 }),
      Object.assign(node('left-text', 'MG_LEFT', 'TextBlock'),
        { attrs: { ControlType: 'TextBlock', Align: 'Left' }, dslWidth: 30 })
    ]
  }, null, 2), 'utf8');
  result = runContainment(mappingE, outE, reportE);
  assert.strictEqual(result.status, 0, result.stderr);
  const outEJson = JSON.parse(fs.readFileSync(outE, 'utf8'));
  const eByRef = ref => outEJson.nodes.find(item => item.ref === ref);
  assert.strictEqual(eByRef('right-text').layoutParent, 'group');
  assert.strictEqual(eByRef('right-text').expectedLeft, (658 + 200) - (682 + 10),
    'Align=Right：Left 必须是「容器外框右边缘 − (控件X + bbox宽)」= 166');
  assert.strictEqual(eByRef('right-text').expectedTop, (578 - 514) - SECONDARY_INSET.top,
    'Align=Right 只改 Left 口径，Top 仍按内容区原点');
  assert.strictEqual(eByRef('left-text').expectedLeft, (682 - 658) - SECONDARY_INSET.left,
    'Align=Left 仍是「左边缘到内容区左边缘」');

  console.log('PASS container containment regression test');
