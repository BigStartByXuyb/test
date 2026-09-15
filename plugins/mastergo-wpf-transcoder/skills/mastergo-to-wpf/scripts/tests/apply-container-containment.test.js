'use strict';

// apply-container-containment.js 回归：完全包含 / 最小面积 / 冲突（并列面积、压边、环）/
// 宿主壳排除 / 幂等。

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', 'apply-container-containment.js');
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

function node(ref, xmlId, controlType) {
  return {
    ref, xmlId, sourceRef: ref, sourceParent: null, controlType, parent: null, layoutParent: null,
    absX: 0, absY: 0, w: 1, h: 1,
    expectedLeft: 0, expectedTop: 0, expectedWidth: 1, expectedHeight: 1, attrs: {}
  };
}

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
    node('popup', 'MG_POPUP', 'GroupBox'),
    node('group', 'MG_GROUP', 'GroupBox'),
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
assert.strictEqual(byRef('inside-a').expectedLeft, 20, '嵌套坐标按父容器相对');
assert.strictEqual(byRef('inside-a').expectedTop, 100);
assert.strictEqual(byRef('group').layoutParent, 'popup', '内层容器应挂到外层容器');
assert.strictEqual(byRef('group').expectedLeft, 50);
assert.strictEqual(byRef('group').expectedTop, 50);
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
  nodes: [node('c1', 'MG_C1', 'GroupBox'), node('c2', 'MG_C2', 'GroupBox'), node('target', 'MG_T', 'NumberBox')]
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
  nodes: [node('wrap', 'MG_WRAP', 'Border'), node('wrap/inner', 'MG_INNER', 'GroupBox')]
}, null, 2), 'utf8');
result = runContainment(mappingC, outC, reportC);
assert.strictEqual(result.status, 0, result.stderr);
const outCJson = JSON.parse(fs.readFileSync(outC, 'utf8'));
const reportCJson = JSON.parse(fs.readFileSync(reportC, 'utf8'));
assert.strictEqual(outCJson.nodes.find(item => item.ref === 'wrap').layoutParent, null, '环场景不得重挂');
assert.ok(reportCJson.conflicts.some(item => item.reason === 'container-is-descendant-of-node'), '环场景必须记冲突');

console.log('PASS container containment regression test');
