'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mastergo-mtslg-mapping-'));
const dslPath = path.join(dir, 'dsl.snapshot.json');
const visibilityPath = path.join(dir, 'visibility.json');
const iconMapPath = path.join(dir, 'icon-map.json');
const outputPath = path.join(dir, 'mapping.json');
const rootRef = 'test:root';

function textNode(id, parentRef, value, rx, ry) {
  return {
    type: 'TEXT',
    id,
    name: value,
    layoutStyle: { width: 40, height: 22, relativeX: rx, relativeY: ry },
    text: [{ text: value }],
    parentRef
  };
}

function buttonGroup(id, rx, value) {
  return {
    type: 'GROUP',
    id,
    name: '按钮',
    layoutStyle: { width: 60, height: 60, relativeX: rx, relativeY: 0 },
    children: [textNode(id + '/text', id, value, 10, 19)]
  };
}

const innerRef = rootRef + '/inner';
const dsl = {
  styles: {},
  nodes: [{
    type: 'INSTANCE',
    id: rootRef,
    name: '界面内操作组',
    layoutStyle: { width: 342, height: 60, relativeX: 0, relativeY: 0 },
    componentInfo: { properties: { '属性 1': '加减快捷键-无标题' } },
    children: [{
      type: 'INSTANCE',
      id: innerRef,
      name: '加减快捷键-无标题',
      layoutStyle: { width: 342, height: 60, relativeX: 0, relativeY: 0 },
      componentInfo: {},
      children: [
        buttonGroup(innerRef + '/plus5', 0, '+5'),
        buttonGroup(innerRef + '/minus5', 72, '-5'),
        buttonGroup(innerRef + '/plus1', 144, '+1'),
        buttonGroup(innerRef + '/minus1', 216, '-1'),
        {
          type: 'GROUP',
          id: innerRef + '/value-group',
          name: '组 2525',
          layoutStyle: { width: 50, height: 48, relativeX: 0, relativeY: 0 },
          children: [
            textNode(innerRef + '/value-group/value', innerRef + '/value-group', '9.0%', 0, 26),
            textNode(innerRef + '/value-group/direction', innerRef + '/value-group', 'Dir', 29, 0)
          ]
        }
      ]
    }]
  }],
  components: []
};

fs.writeFileSync(dslPath, JSON.stringify({
  schemaVersion: 'mastergo-dsl-capture/1',
  fileId: 'test-file',
  layerId: rootRef,
  pageName: 'mapping-test',
  ui: 'test',
  dsl,
  componentDocumentLinks: [],
  rules: []
}, null, 2));
fs.writeFileSync(visibilityPath, JSON.stringify({ nodes: [] }, null, 2));
fs.writeFileSync(iconMapPath, JSON.stringify({ icons: [] }, null, 2));

const script = path.join(__dirname, '..', 'gen-mtslg-mapping-from-dsl.js');
const templateMap = path.join(__dirname, '..', '..', 'references', 'adapters', 'mtslg-iocontrol', 'mtslg-iocontrol-map.json');
const result = spawnSync(process.execPath, [script,
  '--dsl', dslPath,
  '--visibility', visibilityPath,
  '--template-map', templateMap,
  '--icon-map', iconMapPath,
  '--out', outputPath
], { encoding: 'utf8' });

assert.strictEqual(result.status, 0, result.stderr || result.stdout);
const mapping = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
assert.strictEqual(mapping.mappingTag, '新页面完整DSL映射');
assert.strictEqual(mapping.componentInstances.length, 1);
assert.strictEqual(mapping.nodes.filter(node => node.controlType === 'IconButton').length, 4);
assert.deepStrictEqual(
  mapping.nodes.filter(node => node.controlType === 'IconButton').map(node => node.attrs.Value),
  ['+5', '-5', '+1', '-1']
);
assert.deepStrictEqual(
  mapping.nodes.filter(node => node.controlType === 'TextBlock').map(node => node.attrs.Value),
  ['9.0%', 'Dir']
);
assert.deepStrictEqual(mapping.pending, []);
for (const textNode of mapping.nodes.filter(node => node.controlType === 'TextBlock')) {
  assert.strictEqual(textNode.expectedWidth, 'NaN', 'TextBlock 的 expectedWidth 必须固定为 NaN');
  assert.strictEqual(textNode.widthSource, 'mtslg.textblock.fixed-nan', 'TextBlock 必须记录 widthSource');
  const source = mapping.sourceNodes.find(item => item.ref === textNode.sourceRef);
  assert.ok(source && textNode.dslWidth === source.width, 'TextBlock 必须保留 dslWidth 作为 bbox 来源');
}

// ---- 右栏族：componentSet 命中、iconSize 机械取值 ----
function rightSidebarDsl(rootName, properties, innerName, buttonType) {
  const sidebarRef = 'side:root';
  const innerRef = sidebarRef + '/inner';
  const iconRef = innerRef + '/icon';
  const textRef = innerRef + '/text';
  return {
    styles: {},
    nodes: [{
      type: 'INSTANCE',
      id: sidebarRef,
      name: rootName,
      layoutStyle: { width: 170, height: 80, relativeX: 0, relativeY: 0 },
      componentInfo: { properties: Object.assign({}, buttonType ? { '按钮类型': buttonType } : {}, properties || {}) },
      children: [{
        type: 'INSTANCE',
        id: innerRef,
        name: innerName,
        layoutStyle: { width: 170, height: 80, relativeX: 0, relativeY: 0 },
        componentInfo: {},
        children: [
          {
            type: 'PATH',
            id: iconRef,
            name: 'icon区域',
            layoutStyle: { width: 97.0352783203125, height: 65.99, relativeX: 12, relativeY: 14 },
            children: []
          },
          {
            type: 'TEXT',
            id: textRef,
            name: '固定文本框',
            layoutStyle: { width: 75, height: 44, relativeX: 79, relativeY: 18 },
            text: [{ text: '保存 激光- JF' }],
            children: []
          }
        ]
      }]
    }],
    components: []
  };
}

function runMappingCase(name, dsl, icons, extraArgs) {
  const caseDir = path.join(dir, name);
  fs.mkdirSync(caseDir, { recursive: true });
  const caseDsl = path.join(caseDir, 'dsl.snapshot.json');
  const caseVisibility = path.join(caseDir, 'visibility.json');
  const caseIconMap = path.join(caseDir, 'icon-map.json');
  const caseOutput = path.join(caseDir, 'mapping.json');
  fs.writeFileSync(caseDsl, JSON.stringify({
    schemaVersion: 'mastergo-dsl-capture/1', fileId: 'test-file', layerId: dsl.nodes[0].id,
    pageName: name, ui: 'test', dsl, componentDocumentLinks: [], rules: []
  }, null, 2));
  fs.writeFileSync(caseVisibility, JSON.stringify({ nodes: [] }, null, 2));
  fs.writeFileSync(caseIconMap, JSON.stringify({ icons }, null, 2));
  const caseResult = spawnSync(process.execPath, [script,
    '--dsl', caseDsl, '--visibility', caseVisibility, '--template-map', templateMap,
    '--icon-map', caseIconMap, '--out', caseOutput
  ].concat(extraArgs || []), { encoding: 'utf8' });
  assert.strictEqual(caseResult.status, 0, caseResult.stderr || caseResult.stdout);
  return JSON.parse(fs.readFileSync(caseOutput, 'utf8'));
}

const aggregate = runMappingCase(
  'sidebar-aggregate',
  rightSidebarDsl('右侧栏', {}, '右侧栏-左右结构-icon+文案', '左右结构-icon+文案'),
  [{ sourceId: 'side:root/inner/icon', name: 'SaveGeometry', comment: '保存', sourceRef: 'side:root/inner/icon' }]
);
assert.strictEqual(aggregate.componentInstances.length, 1);
assert.strictEqual(aggregate.componentInstances[0].template, 'rightSidebarTemplates');
assert.strictEqual(aggregate.componentInstances[0].componentSet, '右侧栏-左右结构-icon+文案');
const aggregateButton = aggregate.nodes.find(node => node.controlType === 'IconButton');
assert.strictEqual(aggregateButton.attrs.Style, 'RightButtonStyle');
assert.strictEqual(aggregateButton.attrs.Icon, 'SaveGeometry');
assert.deepStrictEqual(aggregateButton.iconSize, { width: 97.0352783203125, height: 65.99, sourceRef: 'side:root/inner/icon' });
assert.strictEqual(aggregate.templateConflicts, undefined, '一致的数据不应产生模板冲突');

const standalone = runMappingCase(
  'sidebar-standalone',
  rightSidebarDsl('右侧栏-左右结构-icon+文案', { '显示icon': true, '显示文案': true }, '背景区域', null),
  [{ sourceId: 'side:root/inner/icon', name: 'SaveGeometry', comment: '保存', sourceRef: 'side:root/inner/icon' }]
);
assert.strictEqual(standalone.componentInstances[0].template, 'rightSidebarComponentTemplates');
assert.strictEqual(standalone.componentInstances[0].componentSet, '右侧栏-左右结构-icon+文案');
assert.strictEqual(standalone.nodes.find(node => node.controlType === 'IconButton').attrs.Style, 'RightButtonStyle');

const conflicted = runMappingCase(
  'sidebar-conflict',
  rightSidebarDsl('右侧栏', {}, 'exit', 'start'),
  []
);
assert.strictEqual(conflicted.componentInstances[0].componentSet, 'exit');
assert.ok(Array.isArray(conflicted.templateConflicts) && conflicted.templateConflicts.length === 1,
  '组件名与属性值冲突时必须记录模板冲突');
assert.match(conflicted.templateConflicts[0].reason, /按内部组件名/);

// --exclude-instances：模板与设计结构不匹配的组件按 SKILL 规则只隔离该组件，其余照常生成。
const isolated = runMappingCase(
  'sidebar-isolated',
  rightSidebarDsl('右侧栏', {}, 'exit', 'start'),
  [],
  ['--exclude-instances', 'side:root']
);
assert.strictEqual(isolated.nodes.length, 0, '被隔离的组件不得产生页面节点');
assert.deepStrictEqual(isolated.excludedInstances, ['side:root']);
assert.ok(isolated.pending.some(item => item.sourceRef === 'side:root'), '被隔离的组件必须进入 pending');
assert.ok(isolated.unmappedComponents.includes('side:root'));
assert.strictEqual(isolated.pending.filter(item => item.sourceRef === 'side:root').length, 1,
  'pending 不得重复登记同一组件');
const isolatedText = isolated.textAudit.find(item => item.sourceRef === 'side:root/inner/text');
assert.ok(isolatedText, '被隔离组件内的文本仍必须写入 textAudit（provenance 要求）');
assert.strictEqual(isolatedText.decision, 'omit');
assert.strictEqual(isolatedText.omitReason, 'excluded-component');
assert.ok(!isolated.nodes.some(node => node.sourceRef === 'side:root/inner/text'),
  '被隔离组件内的文本不得泄漏成独立 TextBlock');

// 轴操作-快慢：8 个方向键按「方向 × 内外圈」自动绑定到模板槽位（与设计稿真实坐标一致）。
function axisDsl(rootX, rootY) {
  const buttons = [
    ['up_outer', 152, 0, 100, 60],
    ['up_inner', 152, 68, 100, 60],
    ['down_inner', 152, 148, 100, 60],
    ['down_outer', 152, 216, 100, 60],
    ['left_outer', 0, 104, 68, 80],
    ['left_inner', 76, 104, 68, 80],
    ['right_inner', 260, 102, 68, 80],
    ['right_outer', 336, 102, 68, 80]
  ].map(([name, rx, ry, w, h]) => ({
    type: 'GROUP',
    id: 'axis:root/' + name,
    name: '按钮',
    layoutStyle: { width: w, height: h, relativeX: rx, relativeY: ry },
    children: [{
      type: 'PATH',
      id: 'axis:root/' + name + '/path',
      name: '路径 119',
      layoutStyle: { width: 26, height: 14, relativeX: 0, relativeY: 0 },
      children: []
    }]
  }));
  return {
    styles: {},
    nodes: [{
      type: 'INSTANCE',
      id: 'axis:root',
      name: '界面内操作组',
      layoutStyle: { width: 404, height: 276, relativeX: rootX, relativeY: rootY },
      componentInfo: { properties: { '属性 1': '轴操作-快慢' } },
      children: buttons
    }]
  };
}

const axis = runMappingCase('axis-eight-way', axisDsl(643, 518), []);
const axisInstance = axis.componentInstances[0];
assert.strictEqual(axisInstance.requiredSlots.length, 8, '轴操作-快慢 必须生成 8 个方向键槽位');
assert.deepStrictEqual(
  axisInstance.requiredSlots.map(item => item.slot),
  ['up_inner', 'up_outer', 'down_inner', 'down_outer', 'left_inner', 'left_outer', 'right_inner', 'right_outer']
);
assert.deepStrictEqual(
  axisInstance.requiredSlots.map(item => item.sourceRef),
  ['axis:root/up_inner', 'axis:root/up_outer', 'axis:root/down_inner', 'axis:root/down_outer',
    'axis:root/left_inner', 'axis:root/left_outer', 'axis:root/right_inner', 'axis:root/right_outer'],
  '槽位必须按几何位置绑定，而不是按设计稿层级顺序'
);
assert.strictEqual(axis.nodes.length, 8, '8 个方向键都必须发射为 IconButton');
assert.ok(axis.nodes.every(node => node.controlType === 'IconButton' && node.attrs && node.attrs.Style === undefined),
  '轴操作按钮使用默认 IconButton 且省略 Style');

console.log('PASS MTSLG DSL-to-mapping text-slot regression test');
console.log('PASS MTSLG DSL-to-mapping button-family regression test');
