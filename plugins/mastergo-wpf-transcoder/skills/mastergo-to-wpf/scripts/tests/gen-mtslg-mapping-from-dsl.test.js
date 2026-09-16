'use strict';

const assert = require('assert');
const crypto = require('crypto');
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

// 模拟 mastergo-dsl-pipeline.ps1 的 Capture 产物：快照记录它回指的原始 capture（哈希/字节数/出网链路）。
// 哈希由测试按字节独立算出，用来验证 mapping 里搬运的是真事实，而不是脚本自报的值。
const capturePath = path.join(dir, 'getDsl.json');
fs.writeFileSync(capturePath, JSON.stringify({ dsl, componentDocumentLinks: [], rules: [] }, null, 2), 'utf8');
const captureSha256 = crypto.createHash('sha256').update(fs.readFileSync(capturePath)).digest('hex');
const captureBytes = fs.statSync(capturePath).size;

fs.writeFileSync(dslPath, JSON.stringify({
  schemaVersion: 'mastergo-dsl-snapshot/2',
  fileId: 'test-file',
  layerId: rootRef,
  pageName: 'mapping-test',
  ui: 'test',
  captureSha256,
  captureBytes,
  egress: 'test-direct',
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
// provenance：source 必须同时带「原始 capture」与「本次消费的快照」两层事实——只记一层就断了链。
assert.strictEqual(mapping.source.sourceSha256, captureSha256, 'source 必须回指原始 capture 的 sha256');
assert.strictEqual(mapping.source.sourceBytes, captureBytes, 'source 必须记录原始 capture 的字节数');
assert.strictEqual(mapping.source.egress, 'test-direct', 'source 必须记录出网链路标签');
assert.strictEqual(mapping.source.snapshotSha256, crypto.createHash('sha256').update(fs.readFileSync(dslPath)).digest('hex'),
  'source 必须记录本次实际消费的快照自身哈希（脚本直接复算，不取快照里的自报值）');
assert.strictEqual(mapping.source.snapshotBytes, fs.statSync(dslPath).size, 'source 必须记录快照字节数');
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
  const parsed = JSON.parse(fs.readFileSync(caseOutput, 'utf8'));
  // 这些用例的快照是手写的、没有 capture provenance：字段照样要在，但值必须如实记 null，
  // 不得为了「看起来齐全」编造哈希；快照自身哈希则永远可算（直接复算消费到的字节）。
  assert.deepStrictEqual(
    [parsed.source.sourceSha256, parsed.source.sourceBytes, parsed.source.egress],
    [null, null, null],
    name + '：快照没有 capture provenance 时必须如实记 null，不得编造'
  );
  assert.match(parsed.source.snapshotSha256, /^[0-9a-f]{64}$/, name + ' 必须记录快照自身哈希');
  assert.strictEqual(parsed.source.snapshotBytes, fs.statSync(caseDsl).size, name + ' 必须记录快照字节数');
  return parsed;
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
  // 容器必须显式登记 Style，并携带内容区原点（边框 + 标题条高）：子控件相对坐标靠它换算。
  assert.strictEqual(target.attrs.Style, 'IOGroupBoxSecondary',
    label + ' 必须显式登记 Style（空 Style 会落到不可换算的隐式模板）');
  assert.deepStrictEqual(target.contentInset, { left: 1, top: 35 },
    label + ' 必须携带 IOGroupBoxSecondary 的内容区原点 {left:1, top:35}');
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
