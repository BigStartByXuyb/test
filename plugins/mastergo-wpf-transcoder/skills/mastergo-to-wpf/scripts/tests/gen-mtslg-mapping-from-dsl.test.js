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

// 带字体样式的 TEXT：font 指向 dsl.styles 里的 font_* 条目
// （size → FontSize；style.fontStyle → FontWeight，样式名取不到时才回退 weight 数值）。
function styledTextNode(id, parentRef, value, rx, ry, fontRef) {
  const node = textNode(id, parentRef, value, rx, ry);
  node.text = [{ text: value, font: fontRef }];
  return node;
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

// ---- 图标归属的「树判据」回归：图标组 id 不是其子 PATH id 的字符串前缀时，
//      台账按「图标组」登记也必须绑定成功。
//      部分设计稿里同一实例内的节点 id 只共享外层实例前缀（如 …/1066:329570 的
//      子 PATH 是 …/1066:329573），只按 id 字符串前缀匹配会静默匹配不到、按钮
//      Icon 留空且不报错。----
function nestedIconSidebarDsl() {
  const sidebarRef = 'nested:root';
  const innerRef = sidebarRef + '/inner';
  const iconGroupRef = innerRef + '/1066:329570';
  const iconPathRef = innerRef + '/1066:329573';
  return {
    styles: {},
    nodes: [{
      type: 'INSTANCE',
      id: sidebarRef,
      name: '右侧栏',
      layoutStyle: { width: 170, height: 80, relativeX: 0, relativeY: 0 },
      componentInfo: { properties: { '按钮类型': '左右结构-icon+文案' } },
      children: [{
        type: 'INSTANCE',
        id: innerRef,
        name: '右侧栏-左右结构-icon+文案',
        layoutStyle: { width: 170, height: 80, relativeX: 0, relativeY: 0 },
        componentInfo: {},
        children: [
          {
            type: 'GROUP',
            id: iconGroupRef,
            name: '图标组',
            layoutStyle: { width: 32, height: 24, relativeX: 36, relativeY: 18 },
            children: [{
              type: 'PATH',
              id: iconPathRef,
              name: '路径 203',
              layoutStyle: { width: 16, height: 24, relativeX: 0, relativeY: 0 },
              children: []
            }]
          },
          {
            type: 'TEXT',
            id: innerRef + '/text',
            name: '固定文本框',
            layoutStyle: { width: 75, height: 44, relativeX: 79, relativeY: 18 },
            text: [{ text: '保存' }],
            children: []
          }
        ]
      }]
    }],
    components: []
  };
}

const nestedIcon = runMappingCase(
  'sidebar-icon-group-not-id-prefix',
  nestedIconSidebarDsl(),
  [{
    sourceId: 'nested:root/inner/1066:329570',
    sourceRef: 'nested:root/inner/1066:329570',
    name: 'SaveGeometry',
    comment: '保存'
  }]
);
const nestedIconButton = nestedIcon.nodes.find(node => node.controlType === 'IconButton');
assert.strictEqual(nestedIconButton.attrs.Icon, 'SaveGeometry',
  '图标组 id 不是其子 PATH id 的字符串前缀时，必须按 DSL 树归属绑定（否则 Icon 会静默留空）');
assert.deepStrictEqual(nestedIconButton.iconSize,
  { width: 32, height: 24, sourceRef: 'nested:root/inner/1066:329570' },
  'iconSize 取命中条目节点的 bbox（本用例为图标组）');

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

// ---- 容器类组件（infoGroupTemplates）：组件集命中 → 发射 GroupBox + Header，标题文本被消费 ----
const infoGroupDsl = {
  styles: {},
  nodes: [{
    type: 'INSTANCE',
    id: 'page:root',
    name: '校准参数（3.1.3）',
    layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
    componentInfo: {},
    children: [
      {
        type: 'INSTANCE',
        id: 'page:root/group',
        name: '信息分组-模块化',
        layoutStyle: { width: 252, height: 534, relativeX: 790, relativeY: 204 },
        componentId: '1066:429122',
        componentInfo: {},
        children: [{
          type: 'TEXT',
          id: 'page:root/group/title',
          name: '固定文本框',
          layoutStyle: { width: 79, height: 20, relativeX: 24, relativeY: 16 },
          text: [{ text: '周期名称' }]
        }]
      },
      {
        type: 'INSTANCE',
        id: 'page:root/popup',
        name: '信息模块-手动控制弹层',
        layoutStyle: { width: 564, height: 105, relativeX: 300, relativeY: 700 },
        componentId: '236:8757',
        componentInfo: {},
        children: [{
          type: 'TEXT',
          id: 'page:root/popup/title',
          name: '固定文本框',
          layoutStyle: { width: 79, height: 20, relativeX: 12, relativeY: 8 },
          text: [{ text: '单轴控制' }]
        }]
      }
    ]
  }]
};
const infoGroup = runMappingCase('info-group-containers', infoGroupDsl, []);
const groupNode = infoGroup.nodes.find(item => item.sourceRef === 'page:root/group');
const popupNode = infoGroup.nodes.find(item => item.sourceRef === 'page:root/popup');
assert.ok(groupNode, '信息分组-模块化 必须命中模板并发射控件');
assert.ok(popupNode, '信息模块-手动控制弹层 必须命中模板并发射控件');
for (const [label, target] of [['信息分组-模块化', groupNode], ['信息模块-手动控制弹层', popupNode]]) {
  assert.strictEqual(target.controlType, 'GroupBox', label + ' 应发射 GroupBox');
  assert.strictEqual(target.attrs.Header !== undefined, true, label + ' 必须挂 Header');
  assert.strictEqual(target.valueSource, 'dsl.text', label + ' 的 Header 文案必须记为 dsl.text 来源');
  assert.strictEqual(target.sourceText, label === '信息分组-模块化' ? '周期名称' : '单轴控制');
  assert.strictEqual(target.expectedWidth, label === '信息分组-模块化' ? 252 : 564, 'Width 取实例 bbox');
  assert.strictEqual(target.expectedTop, (label === '信息分组-模块化' ? 204 : 700) - 192, '根级 Top 仍扣 192');
  // Style 是必写字段，按当前框架口径恒发射空串；内容区原点另由 contentInsetStyle 查表携带，
  // 子控件相对坐标靠 contentInset 换算。
  assert.strictEqual(target.attrs.Style, '', label + ' 的 Style 必须发射空串');
  assert.deepStrictEqual(target.contentInset, { left: 1, top: 35 },
    label + ' 必须按 contentInsetStyle=IOGroupBoxSecondary 携带内容区原点 {left:1, top:35}');
}
assert.ok(!infoGroup.nodes.some(item => item.sourceRef === 'page:root/group/title'),
  '组内标题文本不得再作为独立 TextBlock 发射');
const headerAudit = infoGroup.textAudit.find(item => item.sourceRef === 'page:root/group/title');
assert.strictEqual(headerAudit.decision, 'emit');
assert.strictEqual(headerAudit.role, 'component-value');
assert.deepStrictEqual(
  infoGroup.componentInstances.map(item => item.template),
  ['infoGroupTemplates', 'infoGroupTemplates'],
  '两个容器都必须登记为 infoGroupTemplates 实例'
);
assert.deepStrictEqual(
  infoGroup.componentInstances.map(item => (item.requiredSlots[0] || {}).slot),
  ['header', 'header']
);
assert.deepStrictEqual(
  infoGroup.pending.map(item => item.sourceRef),
  [],
  '容器命中模板后不得再进入 pending'
);

console.log('PASS MTSLG DSL-to-mapping container (infoGroupTemplates) regression test');

// ---- TextBlock FontWeight：设计稿字重非 normal 才发射，值取设计稿的字体样式名 ----
const fontWeightDsl = {
  styles: {
    'font_bold': { value: { family: 'DIN Alternate', size: 16, weight: '700', style: '{"fontStyle":"Bold","opsz":"auto"}' } },
    'font_semibold': { value: { family: 'Alibaba PuHuiTi 2.0', size: 18, weight: '600', style: '{"fontStyle":"75 SemiBold","opsz":"auto"}' } },
    'font_normal': { value: { family: 'Alibaba PuHuiTi 2.0', size: 16, weight: '400', style: '{"fontStyle":"55 Regular","opsz":"auto"}' } },
    'font_cn_regular': { value: { family: 'PingFang SC', size: 16, weight: '400', style: '{"fontStyle":"常规体","opsz":"auto"}' } },
    // style 是合法 JSON 但没有 fontStyle → 不得把整段 JSON 当字重值，必须回退 weight 数值
    'font_no_fontstyle': { value: { family: 'DIN Alternate', size: 20, weight: '700', style: '{"opsz":"auto"}' } },
    // style 是坏 JSON → 同样回退 weight 数值（且不得抛错中断整次生成）
    'font_bad_json': { value: { family: 'DIN Alternate', size: 20, weight: '600', style: '{not-json' } },
  },
  nodes: [{
    type: 'INSTANCE', id: 'fw:root', name: '字体页',
    layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
    componentInfo: {},
    children: [
      styledTextNode('fw:root/bold', 'fw:root', '加粗标题', 20, 300, 'font_bold'),
      styledTextNode('fw:root/semibold', 'fw:root', '半粗标签', 20, 340, 'font_semibold'),
      styledTextNode('fw:root/normal', 'fw:root', '普通正文', 20, 380, 'font_normal'),
      styledTextNode('fw:root/cn-regular', 'fw:root', '中文常规', 20, 420, 'font_cn_regular'),
      styledTextNode('fw:root/no-fontstyle', 'fw:root', '缺样式名', 20, 460, 'font_no_fontstyle'),
      styledTextNode('fw:root/bad-json', 'fw:root', '坏JSON', 20, 500, 'font_bad_json'),
    ],
  }],
};
const fontWeightMapping = runMappingCase('textblock-font-weight', fontWeightDsl, []);
const byText = new Map(fontWeightMapping.nodes
  .filter(node => node.controlType === 'TextBlock')
  .map(node => [node.sourceRef, node]));
assert.strictEqual(byText.get('fw:root/bold').attrs.FontWeight, 'Bold',
  '必须写设计稿自己的字体样式名（fontStyle="Bold"），不是数值 700');
assert.strictEqual(byText.get('fw:root/semibold').attrs.FontWeight, 'SemiBold',
  '带字体族档位的样式名要去掉前缀数字（"75 SemiBold" → "SemiBold"）');
assert.strictEqual(byText.get('fw:root/normal').attrs.FontWeight, undefined,
  '"55 Regular" 视为 normal，不得发射 FontWeight');
assert.strictEqual(byText.get('fw:root/cn-regular').attrs.FontWeight, undefined,
  '中文"常规体"同样视为 normal，不得发射 FontWeight');
assert.strictEqual(byText.get('fw:root/no-fontstyle').attrs.FontWeight, '700',
  'style 是合法 JSON 但没有 fontStyle 时必须回退 weight 数值，不能把整段 JSON 当字重值');
assert.strictEqual(byText.get('fw:root/bad-json').attrs.FontWeight, '600',
  'style 是坏 JSON 时同样回退 weight 数值，且不得中断生成');
assert.strictEqual(byText.get('fw:root/normal').attrs.FontSize, '16',
  'FontSize 仍按字体事实恒写（与 FontWeight 规则互不影响）');
assert.strictEqual(byText.get('fw:root/bold').attrs.FontSize, '16');

console.log('PASS MTSLG DSL-to-mapping TextBlock FontWeight regression test');

// ---- TextBlock Align：恒写、二元取值（真值源 = 设计稿 TEXT 节点级 textAlign；非 right 一律 Left）----
// 规则登记在映射表 textBlockAlign；目标框架只认 Left / Right，因此 center / 未知取值 / 字段缺失
// 都必须落到默认值 Left（默认左对齐），不允许出现第三种值，也不允许漏写该属性。
// 该属性**只有 TextBlock 有**：下面同时断言其它 ControlType 不会拿到 Align。
const withAlign = (node, textAlign) => Object.assign(node, { textAlign });
const alignDsl = {
  styles: {},
  nodes: [{
    type: 'INSTANCE', id: 'al:root', name: '对齐页',
    layoutStyle: { width: 800, height: 600, relativeX: 0, relativeY: 0 },
    componentInfo: {},
    children: [
      withAlign(textNode('al:root/left', 'al:root', '左对齐', 20, 300), 'left'),
      withAlign(textNode('al:root/upper', 'al:root', '大写右', 20, 330), ' RIGHT '),
      withAlign(textNode('al:root/right', 'al:root', '右对齐', 20, 360), 'right'),
      withAlign(textNode('al:root/center', 'al:root', '居中', 20, 390), 'center'),
      withAlign(textNode('al:root/justify', 'al:root', '两端对齐', 20, 420), 'justify'),
      textNode('al:root/missing', 'al:root', '无对齐字段', 20, 450),
    ],
  }],
};
const alignMapping = runMappingCase('textblock-align', alignDsl, []);
const alignByRef = new Map(alignMapping.nodes
  .filter(node => node.controlType === 'TextBlock')
  .map(node => [node.sourceRef, node.attrs.Align]));
assert.strictEqual(alignByRef.get('al:root/left'), 'Left', 'textAlign=left 必须发射 Align="Left"');
assert.strictEqual(alignByRef.get('al:root/upper'), 'Right',
  'textAlign 的取值先归一（去空白 + 转小写）再判定，大小写不能影响结果（" RIGHT " 仍判右对齐）');
assert.strictEqual(alignByRef.get('al:root/right'), 'Right', 'textAlign=right 必须发射 Align="Right"');
assert.strictEqual(alignByRef.get('al:root/center'), 'Left',
  '设计稿居中对齐按二元口径落到默认值 Left——目标框架只有 Left / Right，不发射第三种值');
assert.strictEqual(alignByRef.get('al:root/justify'), 'Left',
  '未知对齐取值同样按默认左对齐，不得凭空造值');
assert.strictEqual(alignByRef.get('al:root/missing'), 'Left',
  '设计稿没有 textAlign 时按默认左对齐；Align 是恒写字段，不允许漏写');
for (const node of alignMapping.nodes.filter(item => item.controlType === 'TextBlock')) {
  assert.ok(node.attrs.Align === 'Left' || node.attrs.Align === 'Right',
    '每个 TextBlock 都必须恒写 Align 且取值只能是 Left / Right: ' + JSON.stringify(node.attrs));
}
for (const node of alignMapping.nodes.filter(item => item.controlType !== 'TextBlock')) {
  assert.strictEqual(node.attrs.Align, undefined,
    'Align 只有 TextBlock 有：' + node.controlType + ' 不得发射该属性');
}

console.log('PASS MTSLG DSL-to-mapping TextBlock Align regression test');

// ---- 相机视口（cameraTemplates）：ControlType=Camera、不写 Style、DesignPanelID/Value 空串占位 ----
const cameraDsl = {
  styles: {},
  nodes: [{
    type: 'INSTANCE', id: 'cam:root', name: '激光精准对焦',
    layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
    componentInfo: {},
    children: [{
      type: 'INSTANCE', id: 'cam:root/view', name: '集成图像',
      layoutStyle: { width: 600, height: 600, relativeX: 20, relativeY: 202 },
      componentId: '197:200415', componentInfo: {},
      children: [
        { type: 'LAYER', id: 'cam:root/view/bg', name: '矩形 2034', layoutStyle: { width: 600, height: 600, relativeX: 0, relativeY: 0 } },
        // 视口内部绘制文本（真实相机组件里存在：JOG mode / 通道名 / 坐标读数）——整体不处理
        textNode('cam:root/view/inner-text', 'cam:root/view', 'JOG mode', 12, 12),
      ],
    }],
  }],
};
const cameraMapping = runMappingCase('camera-viewport', cameraDsl, []);
const cameraNode = cameraMapping.nodes.find(node => node.controlType === 'Camera');
assert.ok(cameraNode, '集成图像 实例必须命中 cameraTemplates 并发 Camera 控件');
assert.strictEqual(cameraNode.attrs.DesignPanelID, '', 'DesignPanelID 无设计来源时必须空串占位');
assert.strictEqual(cameraNode.attrs.Value, '', 'Value（相机名）无设计来源时必须空串占位');
assert.strictEqual(cameraNode.attrs.Style, undefined, 'Camera 不得发射 Style（用运行时默认控件外观）');
assert.strictEqual(cameraNode.expectedWidth, 600, 'Width 取实例 bbox');
assert.strictEqual(cameraNode.expectedHeight, 600, 'Height 取实例 bbox');
assert.strictEqual(cameraNode.expectedTop, 202 - 192, '根级 Top 仍扣 192');
assert.strictEqual(cameraMapping.pending.filter(item => item.sourceRef === 'cam:root/view').length, 0,
  '相机实例不得再进入 pending（未映射组件）');
assert.ok(!cameraMapping.nodes.some(node => node.sourceRef === 'cam:root/view/inner-text'),
  '相机视口内部文本不得被发射成 TextBlock（相机是一个整体）');
const innerAudit = cameraMapping.textAudit.find(item => item.sourceRef === 'cam:root/view/inner-text');
assert.ok(innerAudit, '相机视口内部文本必须进入 textAudit（显式登记处置）');
assert.strictEqual(innerAudit.decision, 'omit', '相机内部文本必须 decision=omit');
assert.strictEqual(innerAudit.role, 'camera-viewport-internal', '相机内部文本必须用专用 omit 角色');

console.log('PASS MTSLG DSL-to-mapping camera viewport regression test');

// ---- 表格（tableTemplates 结构签名命中）：GROUP → DataGrid + 表头派生的列定义 ----
// 表格在组件库里没有组件集（设计稿里只是 GROUP），命中口径是结构身份
// （GROUP + 表头群组 + item 行群组 + 表头可见文本），**图层名不参与匹配**；
// 列 = 表头可见文本；行 = 数据（不发射控件，只登记进 tableAudits）。
function tableFixture(rootName, options) {
  const tableRef = 'tbl:root/table';
  const headerRef = tableRef + '/header';
  const cell = (id, props, rx) => ({
    type: 'INSTANCE', id, name: '输入框',
    layoutStyle: { width: 80, height: 32, relativeX: rx, relativeY: 4 },
    componentInfo: { properties: props }, children: []
  });
  const rowOne = {
    type: 'GROUP', id: tableRef + '/item1', name: 'item',
    layoutStyle: { width: 609, height: 40, relativeX: 14, relativeY: 32 },
    children: [
      {
        type: 'GROUP', id: tableRef + '/item1/content', name: '表格内容',
        layoutStyle: { width: 480, height: 40, relativeX: 111, relativeY: 0 },
        children: [
          cell(tableRef + '/item1/content/c1', { '属性 1': '输入框-整数-32' }, 16),
          cell(tableRef + '/item1/content/c2', { '属性 1': '输入框-整数-32' }, 108)
        ]
      },
      textNode(tableRef + '/item1/unit', tableRef + '/item1', '%', 595, 12),
      textNode(tableRef + '/item1/title', tableRef + '/item1', '图像识别阈值', 0, 12)
    ]
  };
  const rowTwo = {
    type: 'GROUP', id: tableRef + '/item2', name: 'item',
    layoutStyle: { width: 609, height: 40, relativeX: 14, relativeY: 71 },
    children: [
      {
        type: 'GROUP', id: tableRef + '/item2/content', name: '表格内容',
        layoutStyle: { width: 480, height: 40, relativeX: 111, relativeY: 0 },
        children: [
          cell(tableRef + '/item2/content/c1', { '属性 1': '输入框-整数-32' }, 16),
          textNode(tableRef + '/item2/content/c2', tableRef + '/item2/content', '64', 108, 11)
        ]
      },
      textNode(tableRef + '/item2/unit', tableRef + '/item2', 'pixel', 609, 12),
      textNode(tableRef + '/item2/title', tableRef + '/item2', 'X 方向窗口大小', 0, 12)
    ]
  };
  return {
    styles: {},
    nodes: [{
      type: 'INSTANCE', id: 'tbl:root', name: '校准参数（3.1.3）',
      layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
      componentInfo: {}, children: [{
        type: 'GROUP', id: tableRef, name: rootName,
        layoutStyle: { width: 646, height: 189, relativeX: 50, relativeY: 507 },
        children: [
          {
            type: 'GROUP', id: headerRef, name: '表头',
            layoutStyle: { width: 504, height: 32, relativeX: 125, relativeY: 0 },
            children: options && options.emptyHeader ? [] : [
              textNode(headerRef + '/macro', headerRef, 'Macro', 28, 8),
              textNode(headerRef + '/ch1', headerRef, 'CH1', 120, 8),
              textNode(headerRef + '/ch2', headerRef, 'CH2', 212, 8)
            ]
          },
          rowOne,
          rowTwo
        ]
      }]
    }]
  };
}

const tableMapping = runMappingCase('table-structural', tableFixture('校准参数（3.1.3）表格'), []);
const dataGrid = tableMapping.nodes.find(node => node.controlType === 'DataGrid');
assert.ok(dataGrid, '结构签名命中的表格必须发射 DataGrid 根节点');
assert.strictEqual(dataGrid.sourceRef, 'tbl:root/table', 'DataGrid 的来源必须是表格那个 GROUP 自己');
assert.strictEqual(dataGrid.attrs.Value, '', 'Value 当前阶段固定空串（数据源由工程师后续绑定）');
assert.strictEqual(dataGrid.expectedLeft, 50, 'DataGrid 的 Left 取表格图层 bbox');
assert.strictEqual(dataGrid.expectedTop, 507 - 192, '根级 DataGrid 的 Top 仍扣 192');
assert.strictEqual(dataGrid.expectedWidth, 646);
assert.strictEqual(dataGrid.expectedHeight, 189);

const columns = tableMapping.nodes.filter(node => node.nodeKind === 'table-column');
assert.deepStrictEqual(columns.map(column => column.attrs.Value), ['Macro', 'CH1', 'CH2'],
  '列定义必须按表头文本从左到右展开');
for (const column of columns) {
  assert.strictEqual(column.parent, dataGrid.ref, '列定义必须挂在 DataGrid 下');
  assert.strictEqual(column.expectedLeft, 0, '列定义几何固定 Left=0（映射表 columnTemplate）');
  assert.strictEqual(column.expectedTop, 0, '列定义几何固定 Top=0');
  assert.strictEqual(column.expectedHeight, 45, '列定义几何固定 Height=45');
  assert.strictEqual(column.expectedWidth, 'NaN', '列定义不写 Width');
  assert.strictEqual(column.omitWidth, true);
  assert.strictEqual(column.attrs.IOName, '', '列定义恒写 IOName 空占位');
  assert.strictEqual(column.valueSource, 'dsl.text', '列标题必须回溯到表头文本');
  const source = tableMapping.sourceNodes.find(item => item.ref === column.sourceRef);
  assert.ok(source, '列定义的 sourceRef 必须存在');
  assert.strictEqual(column.dslLeft, source.pageAbsX - 50, '真实表头 bbox 必须留在 dslLeft 溯源');
  assert.strictEqual(column.dslWidth, source.width);
}
// 列 ControlType：严格多数胜出，没有多数退化为 TextBlock。
// 夹具：Macro 列两行都是整数框 → IntNumberBox；CH1 列一行整数框一行纯文本 → 平票 → TextBlock；
// CH2 列没有单元格 → TextBlock。
assert.deepStrictEqual(columns.map(column => column.controlType), ['IntNumberBox', 'TextBlock', 'TextBlock'],
  '列 ControlType 按该列单元格的严格多数判定，没有多数时退化为 TextBlock');

// 行是数据不是控件：行内文本一律 omit，且不得泄漏成 TextBlock。
for (const ref of ['tbl:root/table/item1/title', 'tbl:root/table/item1/unit',
  'tbl:root/table/item2/title', 'tbl:root/table/item2/unit',
  'tbl:root/table/item2/content/c2']) {
  const audit = tableMapping.textAudit.find(item => item.sourceRef === ref);
  assert.ok(audit, '表格内文本必须进入 textAudit: ' + ref);
  assert.strictEqual(audit.decision, 'omit', '表格内行数据文本必须 omit: ' + ref);
  assert.strictEqual(audit.omitReason, 'table-data-cell', '表格内文本必须用专用 omit 角色: ' + ref);
  assert.ok(!tableMapping.nodes.some(node => node.sourceRef === ref), '表格内文本不得发射成控件: ' + ref);
}
// 表格里的输入框实例属于行数据，不得再按 inputTemplates 发射成控件。
assert.ok(!tableMapping.nodes.some(node => node.sourceRef.startsWith('tbl:root/table/item1/content/c') ||
  node.sourceRef.startsWith('tbl:root/table/item2/content/c')),
  '表格单元格实例不得单独发射成控件');
assert.strictEqual(tableMapping.tableAudits.length, 1, '必须登记一条表格审计');
const tableAudit = tableMapping.tableAudits[0];
assert.strictEqual(tableAudit.xmlId, dataGrid.xmlId);
assert.strictEqual(tableAudit.valuePending, true, 'Value 固定空串时必须显式登记 valuePending 待绑定提示');
assert.strictEqual(tableAudit.columns.length, 3);
assert.deepStrictEqual(tableAudit.columns.map(column => column.cellKinds),
  [['IntNumberBox', 'IntNumberBox'], ['IntNumberBox', 'TextBlock'], []],
  '每列的单元格类型分布必须留档，便于复核列类型判定');
assert.strictEqual(tableAudit.rows.length, 2);
assert.deepStrictEqual(tableAudit.rows[0].labels.map(label => label.position),
  ['left', 'right'], '行内直接文本按 x 登记 left/right（左标题 / 单位）');
assert.strictEqual(tableAudit.rows[0].labels[0].text, '图像识别阈值');
assert.strictEqual(tableAudit.rows[0].cells.length, 2, '行只登记值块里的单元格');
assert.strictEqual(tableAudit.rows[0].cells[0].controlType, 'IntNumberBox');
assert.strictEqual(tableAudit.geometry.declaredBoxCoversContent, false,
  '图层声明尺寸覆盖不了内容范围时必须在审计里报出来（设计侧待修正）');
assert.strictEqual(tableMapping.pending.filter(item => item.sourceRef === 'tbl:root/table').length, 0,
  '命中的表格不得再进入 pending');
// 实例登记：表格（GROUP）也要登记进 componentInstances，供 resolver 校验 DataGrid 节点。
const tableInstance = tableMapping.componentInstances.find(item => item.template === 'tableTemplates');
assert.ok(tableInstance, '表格必须登记进 componentInstances');
assert.strictEqual(tableInstance.variant, 'Table');
assert.strictEqual(tableInstance.requiredSlots[0].sourceRef, 'tbl:root/table');

// 图层名不带「表格」后缀也照样命中：表格的身份是结构（表头 + item 行 + 表头文本），不是图层名。
const tableNameFree = runMappingCase('table-name-free', tableFixture('校准参数（3.1.3）'), []);
const nameFreeGrid = tableNameFree.nodes.find(node => node.controlType === 'DataGrid');
assert.ok(nameFreeGrid, '图层名不含「表格」时仍必须按结构身份发射 DataGrid');
assert.strictEqual(nameFreeGrid.attrs.Value, '', 'Value 固定空串口径不受图层名影响');
assert.deepStrictEqual(
  tableNameFree.nodes.filter(node => node.nodeKind === 'table-column').map(node => node.attrs.Value),
  ['Macro', 'CH1', 'CH2'],
  '图层名不同也不影响列定义按表头文本从左到右展开');
assert.strictEqual(tableNameFree.pending.filter(item => item.sourceRef === 'tbl:root/table').length, 0,
  '按结构身份命中的表格不得再进入 pending');

// 结构身份成立（表头群组 + item 行）但表头没有可见文本：列标题无处取值 → pending，不发射控件。
const tableHeaderless = runMappingCase(
  'table-header-without-text',
  tableFixture('校准参数（3.1.3）表格', { emptyHeader: true }),
  []
);
assert.strictEqual(tableHeaderless.nodes.filter(node => node.controlType === 'DataGrid').length, 0,
  '表头没有可见文本时不得发射 DataGrid');
assert.ok(tableHeaderless.pending.some(item => item.sourceRef === 'tbl:root/table' &&
  /表头可见文本/.test(item.reason)),
  '表头没有可见文本时必须登记 pending 说明原因');

// ---- 同一页两张表：列定义 xmlId 必须**全页唯一** ----
// 背景（2026-09-20 实测）：列 ID 原先按「每张表内从 1 开始」编号，同页第二张表会撞出同名 MGCol_0001，
// 发射器在 validateFreshMapping 直接失败（映射门禁失败: XML ID 必须唯一: MGCol_0001）。
function twoTableFixture() {
  const table = (prefix) => ({
    type: 'GROUP', id: prefix, name: '切缝检测数据表格',
    layoutStyle: { width: 412, height: 208, relativeX: 72, relativeY: 598 },
    children: [
      {
        type: 'GROUP', id: prefix + '/header', name: '表头',
        layoutStyle: { width: 312, height: 32, relativeX: 100, relativeY: 0 },
        children: [textNode(prefix + '/header/ch1', prefix + '/header', 'Ch1', 36, 6)]
      },
      {
        type: 'GROUP', id: prefix + '/item1', name: 'item',
        layoutStyle: { width: 412, height: 36, relativeX: 0, relativeY: 28 },
        children: [textNode(prefix + '/item1/title', prefix + '/item1', 'Q-等级 (%)', 0, 9)]
      }
    ]
  });
  return {
    styles: {},
    nodes: [{
      type: 'INSTANCE', id: 'multi:root', name: '连续运行数据（3.1.8.NS）',
      layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
      componentInfo: {},
      children: [table('multi:root/t1'), table('multi:root/t2')]
    }]
  };
}
const multiTable = runMappingCase('table-multi', twoTableFixture(), []);
assert.strictEqual(multiTable.nodes.filter(node => node.controlType === 'DataGrid').length, 2,
  '同页两张表都要发射 DataGrid');
const multiColumns = multiTable.nodes.filter(node => node.nodeKind === 'table-column');
const multiColumnIds = multiColumns.map(node => node.xmlId);
assert.strictEqual(new Set(multiColumnIds).size, multiColumnIds.length,
  '同页多张表的列定义 xmlId 必须全页唯一');
for (const id of multiColumnIds) {
  assert.match(id, /^MX_[0-9a-f]{32}$/, '列定义 ID 必须是 MX_ + 32 位小写十六进制: ' + id);
}
// 幂等：同一份 DSL 再跑一次，必须得到完全一样的 ID 集合（否则 merge 与工程师代码引用都会失效）
const multiTableAgain = runMappingCase('table-multi-again', twoTableFixture(), []);
assert.deepStrictEqual(multiTableAgain.nodes.map(node => node.xmlId), multiTable.nodes.map(node => node.xmlId),
  '同一份 DSL 两次推导必须得到同一套页面节点 ID');
assert.strictEqual(multiTable.tableAudits.length, 2, '两张表各自登记一条表审计');

console.log('PASS MTSLG DSL-to-mapping table (tableTemplates structural) regression test');

// ---- 选择框（selectBoxTemplates）：Value 是「默认选中的名称」（运行时由 IOName 数据决定），
//      映射表槽位登记 langRefPolicy=none → 必须机械透传到节点，后续不产语言键、不挂 LangName。
const selectBoxDsl = {
  styles: {},
  nodes: [{
    type: 'INSTANCE', id: 'sel:root', name: '参数设置',
    layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
    componentInfo: {},
    children: [{
      type: 'INSTANCE', id: 'sel:root/select', name: '选择框',
      layoutStyle: { width: 120, height: 40, relativeX: 40, relativeY: 300 },
      componentInfo: { properties: { '属性 1': '选择框-40' } },
      children: [textNode('sel:root/select/value', 'sel:root/select', '后向', 12, 10)]
    }]
  }]
};
const selectBox = runMappingCase('select-box-value-slot', selectBoxDsl, []);
const selectNode = selectBox.nodes.find(node => node.controlType === 'ComboBox');
assert.ok(selectNode, '选择框实例必须命中 selectBoxTemplates 并发 ComboBox');
assert.strictEqual(selectNode.sourceRef, 'sel:root/select');
assert.strictEqual(selectNode.attrs.Value, '后向', 'Value 取设计稿的选择框文字');
assert.strictEqual(selectNode.valueSource, 'dsl.text');
assert.strictEqual(selectNode.langRefPolicy, 'none',
  '映射表槽位的 langRefPolicy=none 必须透传到映射节点（否则 Value 会被当成待翻译文案产键）');
assert.ok(!selectBox.nodes.some(node => node.sourceRef === 'sel:root/select/value'),
  '选择框文字作为槽位值被消费，不得再发射成独立 TextBlock');
const selectValueAudit = selectBox.textAudit.find(item => item.sourceRef === 'sel:root/select/value');
assert.ok(selectValueAudit, '选择框文字必须进入 textAudit（provenance 要求）');
assert.strictEqual(selectValueAudit.role, 'component-value');
assert.strictEqual(selectBox.pending.length, 0, '命中模板的选择框不得进入 pending');

console.log('PASS MTSLG DSL-to-mapping select-box langRefPolicy regression test');

// ---- 槽位级多语言策略的登记点必须 fail-closed：登记在没有消费方的族、挂在非值槽位、或取值非法，
//      都必须当场失败，而不是"登记了却不生效、也不报错"。----
function runMappingCaseExpectFailure(name, templateMapDoc) {
  const caseDir = path.join(dir, name);
  fs.mkdirSync(caseDir, { recursive: true });
  const caseDsl = path.join(caseDir, 'dsl.snapshot.json');
  const caseVisibility = path.join(caseDir, 'visibility.json');
  const caseIconMap = path.join(caseDir, 'icon-map.json');
  const caseMap = path.join(caseDir, 'template-map.json');
  fs.writeFileSync(caseDsl, JSON.stringify({
    schemaVersion: 'mastergo-dsl-capture/1', fileId: 'test-file', layerId: 'sel:root',
    pageName: name, ui: 'test', dsl: selectBoxDsl, componentDocumentLinks: [], rules: []
  }, null, 2));
  fs.writeFileSync(caseVisibility, JSON.stringify({ nodes: [] }, null, 2));
  fs.writeFileSync(caseIconMap, JSON.stringify({ icons: [] }, null, 2));
  fs.writeFileSync(caseMap, JSON.stringify(templateMapDoc, null, 2));
  return spawnSync(process.execPath, [script,
    '--dsl', caseDsl, '--visibility', caseVisibility, '--template-map', caseMap,
    '--icon-map', caseIconMap, '--out', path.join(caseDir, 'mapping.json')
  ], { encoding: 'utf8' });
}

const templateMapDoc = JSON.parse(fs.readFileSync(templateMap, 'utf8'));
const unsupportedFamily = JSON.parse(JSON.stringify(templateMapDoc));
unsupportedFamily.componentTemplates.variants[Object.keys(unsupportedFamily.componentTemplates.variants)[0]]
  .slots[0].langRefPolicy = 'none';
const unsupportedResult = runMappingCaseExpectFailure('langref-unsupported-family', unsupportedFamily);
assert.notStrictEqual(unsupportedResult.status, 0,
  '在没有消费方的族上登记 langRefPolicy 必须失败，不得静默忽略');
assert.match(unsupportedResult.stderr + unsupportedResult.stdout, /该族的生成分支不消费该字段/);

const nonValueSlot = JSON.parse(JSON.stringify(templateMapDoc));
nonValueSlot.selectBoxTemplates.variants['选择框-40'].slots
  .push({ slot: 'extra', controlType: 'TextBlock', valueSource: 'dsl.text', langRefPolicy: 'none' });
const nonValueResult = runMappingCaseExpectFailure('langref-non-value-slot', nonValueSlot);
assert.notStrictEqual(nonValueResult.status, 0, '非值槽位上的 langRefPolicy 必须失败，不得静默忽略');
assert.match(nonValueResult.stderr + nonValueResult.stdout, /只支持值槽位 slots\[0\]/);

// 按钮族的值槽位（右栏/主菜单等）不开放槽位豁免：按钮文案一律产键挂 LangName，登记必须失败。
const buttonFamilySlot = JSON.parse(JSON.stringify(templateMapDoc));
const rightSidebarVariant = buttonFamilySlot.rightSidebarTemplates.variants['F+文案'];
assert.strictEqual(rightSidebarVariant.slots[0].controlType, 'IconButton',
  '右栏族的值槽位就是 IconButton —— 正是这条边界要挡住的情况');
rightSidebarVariant.slots[0].langRefPolicy = 'none';
const buttonFamilyResult = runMappingCaseExpectFailure('langref-button-family', buttonFamilySlot);
assert.notStrictEqual(buttonFamilyResult.status, 0, '按钮族值槽位不得登记槽位豁免');
assert.match(buttonFamilyResult.stderr + buttonFamilyResult.stdout, /按钮族带文案一律产键挂 LangName，不开放槽位豁免/);

const badPolicyValue = JSON.parse(JSON.stringify(templateMapDoc));
badPolicyValue.selectBoxTemplates.variants['选择框-40'].slots[0].langRefPolicy = 'optional';
const badPolicyResult = runMappingCaseExpectFailure('langref-bad-value', badPolicyValue);
assert.notStrictEqual(badPolicyResult.status, 0, 'langRefPolicy 取值非法时必须失败');
assert.match(badPolicyResult.stderr + badPolicyResult.stdout, /langRefPolicy 取值非法/);

console.log('PASS MTSLG DSL-to-mapping langRefPolicy placement fail-closed regression test');
