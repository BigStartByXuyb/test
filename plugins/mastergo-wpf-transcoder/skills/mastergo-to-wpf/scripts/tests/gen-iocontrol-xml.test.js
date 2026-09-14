'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iocontrol-xml-'));
const mapping = path.join(dir, 'mapping.json');
const output = path.join(dir, 'page.xml');
fs.writeFileSync(mapping, JSON.stringify({
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'untyped', parentRef: 'root', pageAbsX: 10, pageAbsY: 202, relativeX: 10, relativeY: 202, width: 50, height: 40 }
  ],
  nodes: [{
    ref: 'untyped', sourceRef: 'untyped', sourceParent: 'root',
    absX: 10, absY: 202, w: 50, h: 40, attrs: {}
  }]
}, null, 2));

const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'), '--fresh', mapping, '--out', output], { encoding: 'utf8' });
assert.notStrictEqual(result.status, 0, '无 ControlType 的非根节点必须被拒绝');
assert.match(result.stderr + result.stdout, /缺少 ControlType/);

const duplicateMapping = path.join(dir, 'duplicate-id-mapping.json');
const duplicateOutput = path.join(dir, 'duplicate-id-page.xml');
fs.writeFileSync(duplicateMapping, JSON.stringify({
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'a', parentRef: 'root', pageAbsX: 10, pageAbsY: 202, relativeX: 10, relativeY: 202, width: 20, height: 20 },
    { ref: 'b', parentRef: 'root', pageAbsX: 40, pageAbsY: 202, relativeX: 40, relativeY: 202, width: 20, height: 20 }
  ],
  nodes: [
    { ref: 'a', sourceRef: 'a', sourceParent: 'root', id: 'DUPLICATE', xmlId: 'DUPLICATE', controlType: 'IconButton', absX: 10, absY: 202, w: 20, h: 20 },
    { ref: 'b', sourceRef: 'b', sourceParent: 'root', id: 'DUPLICATE', xmlId: 'DUPLICATE', controlType: 'IconButton', absX: 40, absY: 202, w: 20, h: 20 }
  ]
}, null, 2));
const duplicateResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'), '--fresh', duplicateMapping, '--out', duplicateOutput], { encoding: 'utf8' });
assert.notStrictEqual(duplicateResult.status, 0, '重复 XML ID 必须被拒绝');
assert.match(duplicateResult.stderr + duplicateResult.stdout, /XML ID 必须唯一/);

// ---- 按钮族（IconButton / Button / StatusButton）固定参数 ----
const buttonMapping = path.join(dir, 'button-mapping.json');
const buttonOutput = path.join(dir, 'button-page.xml');
fs.writeFileSync(buttonMapping, JSON.stringify({
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'btn', parentRef: 'root', pageAbsX: 100, pageAbsY: 292, relativeX: 100, relativeY: 292, width: 60, height: 44 },
    { ref: 'btnIcon', parentRef: 'root', pageAbsX: 300, pageAbsY: 292, relativeX: 300, relativeY: 292, width: 170, height: 80 },
    { ref: 'btnIcon/icon', parentRef: 'btnIcon', pageAbsX: 312, pageAbsY: 306, relativeX: 12, relativeY: 14, width: 97.0352783203125, height: 65.99 },
    { ref: 'status', parentRef: 'root', pageAbsX: 500, pageAbsY: 292, relativeX: 500, relativeY: 292, width: 140, height: 75 },
    { ref: 'label', parentRef: 'root', pageAbsX: 200, pageAbsY: 292, relativeX: 200, relativeY: 292, width: 80, height: 22, type: 'TEXT', text: '速度' }
  ],
  textAudit: [{ sourceRef: 'label', sourceText: '速度', visibility: true, role: 'content', decision: 'emit', outputRefs: ['TXT_1'] }],
  nodes: [
    {
      ref: 'btn', sourceRef: 'btn', sourceParent: 'root', id: 'BTN_1', xmlId: 'BTN_1',
      controlType: 'IconButton', absX: 100, absY: 292, w: 60, h: 44,
      attrs: { Style: 'SmallButton', Value: '+5', IconWidth: '999', IconHeight: '999' }
    },
    {
      ref: 'btnIcon', sourceRef: 'btnIcon', sourceParent: 'root', id: 'BTN_2', xmlId: 'BTN_2',
      controlType: 'IconButton', absX: 300, absY: 292, w: 170, h: 80,
      attrs: { Style: 'RightButtonStyle', Icon: 'ExitGeometry', Value: '退出', PageName: 'Jump:Home' },
      iconSize: { width: 97.0352783203125, height: 65.99, sourceRef: 'btnIcon/icon' }
    },
    {
      ref: 'status', sourceRef: 'status', sourceParent: 'root', id: 'STA_1', xmlId: 'STA_1',
      controlType: 'StatusButton', absX: 500, absY: 292, w: 140, h: 75, attrs: {}
    },
    {
      ref: 'label', sourceRef: 'label', sourceParent: 'root', id: 'TXT_1', xmlId: 'TXT_1',
      controlType: 'TextBlock', absX: 200, absY: 292, w: 80, h: 22,
      sourceText: '速度', valueSource: 'dsl.text', attrs: { Value: '速度' }
    }
  ]
}, null, 2));
const fresh = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'), '--fresh', buttonMapping, '--out', buttonOutput], { encoding: 'utf8' });
assert.strictEqual(fresh.status, 0, '按钮族映射必须能正常渲染: ' + fresh.stderr);
const buttonXml = fs.readFileSync(buttonOutput, 'utf8');
const buttonTag = (buttonXml.match(/<IOContorl[^>]*ID="BTN_1"[\s\S]*?\/>/) || [''])[0];
assert.ok(buttonTag, 'fresh 输出必须包含无图标按钮节点');
assert.match(buttonTag, /PageName=""/, '无图标按钮缺少空 PageName 占位');
assert.match(buttonTag, /IOVisible=""/, '无图标按钮缺少空 IOVisible 占位');
assert.match(buttonTag, /IOCommand=""/, '无图标按钮缺少空 IOCommand 占位');
assert.match(buttonTag, /IOEnable=""/, '无图标按钮缺少空 IOEnable 占位');
assert.match(buttonTag, /Icon=""/, '无图标按钮必须发射空 Icon 占位');
assert.match(buttonTag, /IconWidth=""/, '无图标按钮必须发射空 IconWidth 占位');
assert.match(buttonTag, /IconHeight=""/, '无图标按钮必须发射空 IconHeight 占位');
assert.match(buttonTag, /TopLeftContent=""/, '无图标按钮必须发射空 TopLeftContent 占位');
const iconButtonTag = (buttonXml.match(/<IOContorl[^>]*ID="BTN_2"[\s\S]*?\/>/) || [''])[0];
assert.ok(iconButtonTag, 'fresh 输出必须包含带图标按钮节点');
assert.match(iconButtonTag, /IconWidth="97"/, 'IconWidth 必须取图标图形节点 bbox 并取整');
assert.match(iconButtonTag, /IconHeight="66"/, 'IconHeight 必须取图标图形节点 bbox 并取整');
assert.match(iconButtonTag, /PageName="Jump:Home"/, '真实 PageName 必须按映射发射');
assert.match(iconButtonTag, /IOCommand=""/, '带图标按钮同样要补空 IOCommand 占位');
assert.match(iconButtonTag, /IOEnable=""/, '带图标按钮同样要补空 IOEnable 占位');
// 属性顺序固定（目标项目页面惯例）：
//   身份 → Icon → 文本 → LangName → 运行时字段 → 控件尺寸 → 图标尺寸 → 位置
function attrNamesOf(tag) {
  return [...tag.matchAll(/([A-Za-z_][A-Za-z0-9_]*)="/g)].map((match) => match[1]);
}
function assertAttrOrder(tag, order, label) {
  const names = attrNamesOf(tag);
  const actual = names.filter((name) => order.includes(name));
  const expected = order.filter((name) => names.includes(name));
  assert.deepStrictEqual(actual, expected, label + ' 属性顺序不符：' + names.join(', '));
}
const PAGE_ATTR_ORDER = [
  'ID', 'ControlType', 'Style', 'Icon', 'IconText', 'TopLeftContent', 'Value', 'Header', 'LangName',
  'PageName', 'IOName', 'IOCommand', 'IOVisible', 'IOEnable', 'IOParam', 'IOStyle', 'IOState', 'IOGroup',
  'UserRightId',
  'IsAutoRead', 'IsAutoWrite', 'IsAutoRefresh', 'IsWriteIO', 'IsSave',
  'IsShowDialog', 'DialogMessage', 'IsShowStatus', 'IsNeedRedMark', 'StatusBrush',
  'Foreground', 'FontSize', 'Orientation', 'ItemsSourceFile', 'DisplayMemberPath',
  'SelectedValuePath', 'Filter', 'DefaultValue', 'MinValue', 'MaxValue', 'MinRange',
  'MaxRange', 'DecimalPlaces', 'Keypad', 'MaxLength', 'DisableRow', 'DesignPanelID',
  'ParameterName',
  'Width', 'Height', 'IconWidth', 'IconHeight', 'Left', 'Top'
];
const statusTag = (buttonXml.match(/<IOContorl[^>]*ControlType="StatusButton"[\s\S]*?\/>/) || [''])[0];
assert.ok(statusTag, 'fresh 输出必须包含 StatusButton 节点');
assert.match(statusTag, /PageName=""/, 'StatusButton 必须同样发射空 PageName 占位');
assert.match(statusTag, /IOVisible=""/, 'StatusButton 必须同样发射空 IOVisible 占位');
assert.match(statusTag, /IOCommand=""/, 'StatusButton 必须同样发射空 IOCommand 占位');
assert.match(statusTag, /IOEnable=""/, 'StatusButton 必须同样发射空 IOEnable 占位');
assert.ok(!/IconWidth=|IconHeight=/.test(statusTag), '无图标的 StatusButton 不得发射 IconWidth/IconHeight');
const textTag = (buttonXml.match(/<IOContorl[^>]*ControlType="TextBlock"[\s\S]*?\/>/) || [''])[0];
assert.ok(textTag, 'fresh 输出必须包含 TextBlock 节点');
assert.ok(!/PageName=|IconWidth=|IconHeight=/.test(textTag), '非按钮族控件不得获得按钮族固定参数');
assertAttrOrder(iconButtonTag, PAGE_ATTR_ORDER, '带图标 IconButton');
assertAttrOrder(buttonTag, PAGE_ATTR_ORDER, '无图标 IconButton');
assertAttrOrder(statusTag, PAGE_ATTR_ORDER, 'StatusButton');
assertAttrOrder(textTag, PAGE_ATTR_ORDER, 'TextBlock');
assert.match(textTag, /Width="NaN"/, 'TextBlock 的 Width 必须固定为 NaN');
assert.match(textTag, /Height="40"/, 'TextBlock 的 Height 必须固定为 40');

// ---- 每个 ControlType 的固定必写字段（设计方模板）：缺来源一律写空字符串占位 ----
assert.match(textTag, /Style=""/, 'TextBlock 必须发射空 Style 占位');
assert.match(textTag, /IOName=""/, 'TextBlock 必须发射空 IOName 占位');
assert.match(textTag, /IOEnable=""/, 'TextBlock 必须发射空 IOEnable 占位');
assert.match(textTag, /IOVisible=""/, 'TextBlock 必须发射空 IOVisible 占位');
assert.match(textTag, /IsAutoRead=""/, 'TextBlock 必须发射空 IsAutoRead 占位');
assert.match(textTag, /Foreground=""/, 'TextBlock 必须发射空 Foreground 占位');
assert.match(iconButtonTag, /Icon="ExitGeometry"/, 'IconButton 的 Icon 必须按映射发射');
assert.match(iconButtonTag, /TopLeftContent=""/, 'IconButton 必须发射空 TopLeftContent 占位');
assert.match(iconButtonTag, /IsShowStatus=""/, 'IconButton 必须发射空 IsShowStatus 占位');
assert.match(iconButtonTag, /IsNeedRedMark=""/, 'IconButton 必须发射空 IsNeedRedMark 占位');
assert.match(statusTag, /Style=""/, 'StatusButton 必须发射空 Style 占位');
assert.match(statusTag, /Value=""/, 'StatusButton 必须发射空 Value 占位');
assert.ok(!/LangName="/.test(statusTag), 'LangName 例外：没有真实语言 key 时不写空占位');

// 其余 ControlType 的必写字段集（设计方模板逐类核对）
const typedMapping = path.join(dir, 'typed-mapping.json');
const typedOutput = path.join(dir, 'typed-page.xml');
fs.writeFileSync(typedMapping, JSON.stringify({
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'num', parentRef: 'root', pageAbsX: 10, pageAbsY: 292, relativeX: 10, relativeY: 292, width: 140, height: 36 },
    { ref: 'chk', parentRef: 'root', pageAbsX: 200, pageAbsY: 292, relativeX: 200, relativeY: 292, width: 24, height: 24 },
    { ref: 'rad', parentRef: 'root', pageAbsX: 300, pageAbsY: 292, relativeX: 300, relativeY: 292, width: 24, height: 24 },
    { ref: 'cmb', parentRef: 'root', pageAbsX: 400, pageAbsY: 292, relativeX: 400, relativeY: 292, width: 170, height: 40 },
    { ref: 'cam', parentRef: 'root', pageAbsX: 600, pageAbsY: 292, relativeX: 600, relativeY: 292, width: 600, height: 600 },
    { ref: 'grid', parentRef: 'root', pageAbsX: 10, pageAbsY: 700, relativeX: 10, relativeY: 700, width: 600, height: 200 },
    { ref: 'box', parentRef: 'root', pageAbsX: 10, pageAbsY: 400, relativeX: 10, relativeY: 400, width: 300, height: 200 },
    { ref: 'bdr', parentRef: 'root', pageAbsX: 10, pageAbsY: 400, relativeX: 10, relativeY: 400, width: 300, height: 2 }
  ],
  textAudit: [],
  nodes: [
    { ref: 'num', sourceRef: 'num', sourceParent: 'root', id: 'NUM_1', xmlId: 'NUM_1', controlType: 'NumberBox', absX: 10, absY: 292, w: 140, h: 36, attrs: { Value: '0.3000' } },
    { ref: 'chk', sourceRef: 'chk', sourceParent: 'root', id: 'CHK_1', xmlId: 'CHK_1', controlType: 'CheckBox', absX: 200, absY: 292, w: 24, h: 24, attrs: {} },
    { ref: 'rad', sourceRef: 'rad', sourceParent: 'root', id: 'RAD_1', xmlId: 'RAD_1', controlType: 'RadioButton', absX: 300, absY: 292, w: 24, h: 24, attrs: {} },
    { ref: 'cmb', sourceRef: 'cmb', sourceParent: 'root', id: 'CMB_1', xmlId: 'CMB_1', controlType: 'ComboBox', absX: 400, absY: 292, w: 170, h: 40, attrs: {} },
    { ref: 'cam', sourceRef: 'cam', sourceParent: 'root', id: 'CAM_1', xmlId: 'CAM_1', controlType: 'Camera', absX: 600, absY: 292, w: 600, h: 600, attrs: {} },
    { ref: 'grid', sourceRef: 'grid', sourceParent: 'root', id: 'GRD_1', xmlId: 'GRD_1', controlType: 'DataGrid', absX: 10, absY: 700, w: 600, h: 200, attrs: {} },
    { ref: 'box', sourceRef: 'box', sourceParent: 'root', id: 'BOX_1', xmlId: 'BOX_1', controlType: 'GroupBox', absX: 10, absY: 400, w: 300, h: 200, attrs: {} },
    { ref: 'bdr', sourceRef: 'bdr', sourceParent: 'root', id: 'BDR_1', xmlId: 'BDR_1', controlType: 'Border', absX: 10, absY: 400, w: 300, h: 2, attrs: {} }
  ]
}, null, 2));
const typedRun = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'), '--fresh', typedMapping, '--out', typedOutput], { encoding: 'utf8' });
assert.strictEqual(typedRun.status, 0, '各 ControlType 必写字段映射必须能正常渲染: ' + typedRun.stderr);
const typedXml = fs.readFileSync(typedOutput, 'utf8');
function tagOf(xml, id) { return (xml.match(new RegExp('<IOContorl[^>]*ID="' + id + '"[\\s\\S]*?/>')) || [''])[0]; }
const REQUIRED_BY_TYPE = {
  NUM_1: ['Value="0.3000"', 'MinValue=""', 'MaxValue=""', 'DefaultValue=""', 'DecimalPlaces=""', 'IsWriteIO=""', 'Keypad=""', 'IsAutoRead=""', 'IOEnable=""', 'IOVisible=""'],
  CHK_1: ['Value=""', 'IOName=""', 'DefaultValue=""', 'IsWriteIO=""', 'IOEnable=""', 'IOVisible=""'],
  RAD_1: ['Style=""', 'Value=""', 'IOName=""', 'IOState=""', 'IsAutoRefresh=""', 'IOEnable=""', 'IOVisible=""'],
  CMB_1: ['Style=""', 'Value=""', 'IOName=""', 'ItemsSourceFile=""', 'DisplayMemberPath=""', 'SelectedValuePath=""', 'IsAutoRead=""', 'IsAutoWrite=""', 'IsWriteIO=""', 'IOCommand=""', 'IOEnable=""', 'IOVisible=""'],
  CAM_1: ['DesignPanelID=""', 'Value=""', 'IOName=""'],
  GRD_1: ['Value=""', 'IOName=""', 'IOEnable=""', 'IOVisible=""'],
  BOX_1: ['Style=""', 'Header=""', 'IOEnable=""', 'IOVisible=""'],
  BDR_1: ['Style=""', 'Value="1"', 'IOEnable=""', 'IOVisible=""']
};
for (const [id, expected] of Object.entries(REQUIRED_BY_TYPE)) {
  const tag = tagOf(typedXml, id);
  assert.ok(tag, '输出必须包含节点 ' + id);
  for (const attr of expected) {
    assert.ok(tag.includes(attr), id + ' 缺少必写字段 ' + attr + '：' + tag.replace(/\s+/g, ' '));
  }
  assertAttrOrder(tag, PAGE_ATTR_ORDER, id);
}

// 门禁：按钮带 Icon 却没有 iconSize 必须直接失败
const badMapping = path.join(dir, 'button-missing-iconsize.json');
const badOutput = path.join(dir, 'button-missing-iconsize.xml');
const bad = JSON.parse(fs.readFileSync(buttonMapping, 'utf8'));
delete bad.nodes.find(node => node.ref === 'btnIcon').iconSize;
fs.writeFileSync(badMapping, JSON.stringify(bad, null, 2));
const badResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'), '--fresh', badMapping, '--out', badOutput], { encoding: 'utf8' });
assert.notStrictEqual(badResult.status, 0, '带图标但没有 iconSize 的按钮必须被拒绝');
assert.match(badResult.stderr + badResult.stdout, /缺少 iconSize/);

// merge：缺失的占位参数新增；已有真实 PageName 保留；IconWidth/IconHeight 按图标 bbox 覆盖
const existingXml = path.join(dir, 'existing-button-page.xml');
const mergedXml = path.join(dir, 'merged-button-page.xml');
fs.writeFileSync(existingXml, [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<IOContorl',
  '    ID=""',
  '    Left="NaN"',
  '    Top="NaN"',
  '    Width="NaN"',
  '    Height="NaN">',
  '    <IOContorl',
  '        ID="BTN_1"',
  '        ControlType="IconButton"',
  '        Style="SmallButton"',
  '        PageName="Jump:Legacy"',
  '        Value="+5"',
  '        Left="100"',
  '        Top="100"',
  '        Width="60"',
  '        Height="44" />',
  '    <IOContorl',
  '        ID="BTN_2"',
  '        ControlType="IconButton"',
  '        Style="RightButtonStyle"',
  '        Icon="ExitGeometry"',
  '        PageName="Jump:Home"',
  '        IconWidth="24"',
  '        IconHeight="24"',
  '        Value="退出"',
  '        Left="300"',
  '        Top="100"',
  '        Width="170"',
  '        Height="80" />',
  '    <IOContorl',
  '        ID="TXT_1"',
  '        ControlType="TextBlock"',
  '        Value="旧标签"',
  '        Left="200"',
  '        Top="100"',
  '        Width="80"',
  '        Height="40" />',
  '</IOContorl>',
  ''
].join('\n'));
const merge = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'), '--merge', existingXml, buttonMapping, '--out', mergedXml], { encoding: 'utf8' });
assert.strictEqual(merge.status, 0, 'merge 必须成功: ' + merge.stderr);
const mergedXmlText = fs.readFileSync(mergedXml, 'utf8');
const mergedButtonTag = (mergedXmlText.match(/<IOContorl[^>]*ID="BTN_1"[\s\S]*?\/>/) || [''])[0];
assert.match(mergedButtonTag, /PageName="Jump:Legacy"/, 'merge 必须保留工程师已有的真实 PageName');
assert.match(mergedButtonTag, /IOVisible=""/, 'merge 必须补齐空 IOVisible 占位');
assert.match(mergedButtonTag, /IOCommand=""/, 'merge 必须补齐空 IOCommand 占位');
const mergedIconButtonTag = (mergedXmlText.match(/<IOContorl[^>]*ID="BTN_2"[\s\S]*?\/>/) || [''])[0];
assert.match(mergedIconButtonTag, /PageName="Jump:Home"/, 'merge 必须保留已有真实 PageName（带图标按钮）');
assert.match(mergedIconButtonTag, /IconWidth="97"/, 'merge 必须把 IconWidth 覆盖为图标 bbox 宽度');
assert.match(mergedIconButtonTag, /IconHeight="66"/, 'merge 必须把 IconHeight 覆盖为图标 bbox 高度');
const mergedTextTag = (mergedXmlText.match(/<IOContorl[^>]*ID="TXT_1"[\s\S]*?\/>/) || [''])[0];
assert.match(mergedTextTag, /Width="NaN"/, 'merge 必须把 TextBlock 的 Width 覆写为 NaN');
assert.match(mergedTextTag, /Height="40"/, 'merge 必须保持 TextBlock 的 Height=40');
assert.match(mergedTextTag, /Value="速度"/, 'merge 必须按 dsl.text 覆盖旧文本，保证 Value 与设计文本一致');

// ---- 按钮族规则改为读模板表（--map）：改表即改产物，不再各自维护常量 ----
const mapPath = path.join(dir, 'template-map.json');
const mapOutput = path.join(dir, 'map-page.xml');
fs.writeFileSync(mapPath, JSON.stringify({
  buttonFamily: {
    controlTypes: ['IconButton', 'Button'],
    alwaysWrittenAttrs: ['PageName', 'IOVisible', 'IOCommand', 'IOParam'],
    iconSizeAttrs: ['IconWidth', 'IconHeight']
  },
  controlTypeRequiredAttrs: {
    // 只登记需要的类型：表里没有的类型不发射固定字段（改表即改产物）
    IconButton: ['PageName', 'IOVisible', 'IOCommand', 'IOParam', 'Icon', 'IconWidth', 'IconHeight', 'Value'],
    Button: ['PageName', 'IOVisible', 'IOCommand', 'IOParam', 'Value']
  }
}, null, 2));
const mapRun = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'),
  '--fresh', buttonMapping, '--out', mapOutput, '--map', mapPath], { encoding: 'utf8' });
assert.strictEqual(mapRun.status, 0, '带 --map 必须能正常渲染: ' + mapRun.stderr);
const mapXml = fs.readFileSync(mapOutput, 'utf8');
const mapButtonTag = (mapXml.match(/<IOContorl[^>]*ID="BTN_1"[\s\S]*?\/>/) || [''])[0];
assert.match(mapButtonTag, /IOParam=""/, '按钮族恒写属性必须来自模板表（表里加了 IOParam 就要发射）');
const mapStatusTag = (mapXml.match(/<IOContorl[^>]*ControlType="StatusButton"[\s\S]*?\/>/) || [''])[0];
assert.ok(mapStatusTag, 'StatusButton 节点仍应存在');
assert.ok(!/PageName=|IOParam=/.test(mapStatusTag),
  '模板表里 controlTypes 不含 StatusButton 时，该控件不得再获得按钮族固定参数');

// ---- 发射顺序：按设计稿上下布局（Top 主序、Left 次序），与 mapping 数组顺序无关 ----
// 设计稿的图层树顺序与画面上下位置无关；上下布局容器的子节点顺序决定运行时显示顺序，
// 因此 XML 必须按设计坐标重排，而 ID / 坐标 / 属性不变。
const orderMapping = path.join(dir, 'order-mapping.json');
const orderOutput = path.join(dir, 'order-page.xml');
function orderTextNode(ref, xmlId, text, x, y) {
  return {
    ref: ref, sourceRef: ref, sourceParent: 'root', id: xmlId, xmlId: xmlId,
    controlType: 'TextBlock', absX: x, absY: y, w: 80, h: 40,
    sourceText: text, valueSource: 'dsl.text', attrs: { Value: text }
  };
}
fs.writeFileSync(orderMapping, JSON.stringify({
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'c', parentRef: 'root', pageAbsX: 100, pageAbsY: 283, relativeX: 100, relativeY: 283, width: 80, height: 20, type: 'TEXT', text: '底部' },
    { ref: 'b', parentRef: 'root', pageAbsX: 200, pageAbsY: 202, relativeX: 200, relativeY: 202, width: 80, height: 20, type: 'TEXT', text: '同一行右侧' },
    { ref: 'a', parentRef: 'root', pageAbsX: 100, pageAbsY: 202, relativeX: 100, relativeY: 202, width: 80, height: 20, type: 'TEXT', text: '顶部' }
  ],
  textAudit: [
    { sourceRef: 'c', sourceText: '底部', visibility: true, role: 'content', decision: 'emit', outputRefs: ['MG_C'] },
    { sourceRef: 'b', sourceText: '同一行右侧', visibility: true, role: 'content', decision: 'emit', outputRefs: ['MG_B'] },
    { sourceRef: 'a', sourceText: '顶部', visibility: true, role: 'content', decision: 'emit', outputRefs: ['MG_A'] }
  ],
  // 故意与上下顺序相反：底部 → 同行右侧 → 顶部
  nodes: [
    orderTextNode('c', 'MG_C', '底部', 100, 283),
    orderTextNode('b', 'MG_B', '同一行右侧', 200, 202),
    orderTextNode('a', 'MG_A', '顶部', 100, 202)
  ]
}, null, 2));
const orderRun = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'),
  '--fresh', orderMapping, '--out', orderOutput], { encoding: 'utf8' });
assert.strictEqual(orderRun.status, 0, '顺序用例必须能渲染: ' + orderRun.stderr);
const orderIds = [...fs.readFileSync(orderOutput, 'utf8').matchAll(/ID="(MG_[A-Z])"/g)].map((match) => match[1]);
assert.deepStrictEqual(orderIds, ['MG_A', 'MG_B', 'MG_C'],
  '页面 XML 必须按设计稿上下顺序发射（Top 主序、同一行 Left 次序），与 mapping 数组顺序无关');

// ---- 图标字段按 ControlType 模板收窄：非图标模板不发射，iconSize 不脱离 Icon 单独消费 ----
const iconScopeMapping = path.join(dir, 'icon-scope-mapping.json');
const iconScopeOutput = path.join(dir, 'icon-scope-page.xml');
fs.writeFileSync(iconScopeMapping, JSON.stringify({
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'plain', parentRef: 'root', pageAbsX: 100, pageAbsY: 292, relativeX: 100, relativeY: 292, width: 60, height: 44 },
    { ref: 'plain/icon', parentRef: 'plain', pageAbsX: 110, pageAbsY: 300, relativeX: 10, relativeY: 8, width: 40.4, height: 30.6 },
    { ref: 'stale', parentRef: 'root', pageAbsX: 300, pageAbsY: 292, relativeX: 300, relativeY: 292, width: 170, height: 80 },
    { ref: 'stale/icon', parentRef: 'stale', pageAbsX: 310, pageAbsY: 300, relativeX: 10, relativeY: 8, width: 50, height: 40 }
  ],
  textAudit: [],
  nodes: [
    // Button 的模板不含图标字段：即使映射残留 Icon 与 iconSize 也不得发射这三项。
    {
      ref: 'plain', sourceRef: 'plain', sourceParent: 'root', id: 'PLAIN_1', xmlId: 'PLAIN_1',
      controlType: 'Button', absX: 100, absY: 292, w: 60, h: 44,
      attrs: { Style: 'SmallButton', Icon: 'EnterGeometry' },
      iconSize: { width: 40.4, height: 30.6, sourceRef: 'plain/icon' }
    },
    // IconButton 的模板含图标字段但 Icon 为空：iconSize 不得被单独消费，三项写空占位。
    {
      ref: 'stale', sourceRef: 'stale', sourceParent: 'root', id: 'STALE_1', xmlId: 'STALE_1',
      controlType: 'IconButton', absX: 300, absY: 292, w: 170, h: 80,
      attrs: { Style: 'RightButtonStyle' },
      iconSize: { width: 50, height: 40, sourceRef: 'stale/icon' }
    }
  ]
}, null, 2));
const iconScopeRun = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'),
  '--fresh', iconScopeMapping, '--out', iconScopeOutput], { encoding: 'utf8' });
assert.strictEqual(iconScopeRun.status, 0, '图标字段收窄用例必须能渲染: ' + iconScopeRun.stderr);
const iconScopeXml = fs.readFileSync(iconScopeOutput, 'utf8');
const plainButtonTag = (iconScopeXml.match(/<IOContorl[^>]*ID="PLAIN_1"[\s\S]*?\/>/) || [''])[0];
assert.ok(plainButtonTag, '必须包含 Button 节点');
assert.doesNotMatch(plainButtonTag, /Icon="/, 'Button 模板不含图标字段，不得发射 Icon');
assert.doesNotMatch(plainButtonTag, /IconWidth="/, 'Button 模板不含图标字段，不得发射 IconWidth');
assert.doesNotMatch(plainButtonTag, /IconHeight="/, 'Button 模板不含图标字段，不得发射 IconHeight');
const staleIconButtonTag = (iconScopeXml.match(/<IOContorl[^>]*ID="STALE_1"[\s\S]*?\/>/) || [''])[0];
assert.ok(staleIconButtonTag, '必须包含 IconButton 节点');
assert.match(staleIconButtonTag, /Icon=""/, 'IconButton 无 Icon 时仍要发射空 Icon 占位');
assert.match(staleIconButtonTag, /IconWidth=""/, 'IconButton 无 Icon 时 iconSize 不得单独生效，IconWidth 写空占位');
assert.match(staleIconButtonTag, /IconHeight=""/, 'IconButton 无 Icon 时 iconSize 不得单独生效，IconHeight 写空占位');

console.log('PASS IOContorl typed-node gate regression test');
console.log('PASS IconButton fixed-attribute regression test');
console.log('PASS button-family rules are read from the template map');
console.log('PASS icon attributes follow the ControlType template scope');

// ---- 输出父节点真值源：layoutParent → parent → DSL sourceParent（CI REVIEW-001）----
// item 的 DSL 父节点是 root，但映射显式登记 layoutParent=panel：发射器必须与 provenance / 坐标门禁
// 一样按 layoutParent 嵌套发射（Left/Top 相对 panel），否则校验器重算得出的 expectedLeft/Top 会与
// XML 不符而硬失败。
const layoutParentMapping = path.join(dir, 'layout-parent-mapping.json');
const layoutParentOutput = path.join(dir, 'layout-parent-page.xml');
fs.writeFileSync(layoutParentMapping, JSON.stringify({
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'panel', parentRef: 'root', pageAbsX: 600, pageAbsY: 200, relativeX: 600, relativeY: 200, width: 200, height: 120 },
    { ref: 'item', parentRef: 'root', pageAbsX: 610, pageAbsY: 200, relativeX: 610, relativeY: 200, width: 60, height: 60 }
  ],
  nodes: [
    {
      ref: 'panel', sourceRef: 'panel', sourceParent: 'root', id: 'PANEL_1', xmlId: 'PANEL_1',
      controlType: 'Border', absX: 600, absY: 200, w: 200, h: 120,
      expectedLeft: 600, expectedTop: 8, expectedWidth: 200, expectedHeight: 120, attrs: {}
    },
    {
      ref: 'item', sourceRef: 'item', sourceParent: 'root', id: 'ITEM_1', xmlId: 'ITEM_1',
      controlType: 'Border', parent: null, layoutParent: 'panel', absX: 610, absY: 200, w: 60, h: 60,
      expectedLeft: 10, expectedTop: 0, expectedWidth: 60, expectedHeight: 60, attrs: {}
    }
  ]
}, null, 2));
const layoutParentRun = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'),
  '--fresh', layoutParentMapping, '--out', layoutParentOutput], { encoding: 'utf8' });
assert.strictEqual(layoutParentRun.status, 0, 'layoutParent 映射必须能渲染: ' + layoutParentRun.stderr);
const layoutParentXml = fs.readFileSync(layoutParentOutput, 'utf8');
assert.ok(!/\n\s{4}<IOContorl[^>]*ID="ITEM_1"/.test(layoutParentXml),
  'ITEM_1 登记了 layoutParent=panel，不得作为页面根级子节点发射');
assert.match(layoutParentXml,
  /ID="PANEL_1"[\s\S]*?<IOContorl[^>]*ID="ITEM_1"[\s\S]*?Left="10"[\s\S]*?Top="0"/,
  'ITEM_1 必须嵌套在 PANEL_1 内并按输出父节点计算相对坐标（Left=10 / Top=0）');
console.log('PASS output-parent (layoutParent) regression test');

// merge 路径：新节点的插入点必须与嵌套口径一致（CI BLOCK-001）。
// ITEM_1 登记 parent:null + layoutParent:"panel"：既要把坐标算成相对 PANEL_1（Left=10/Top=0），
// 也必须插到 PANEL_1 的闭合标签之前；按裸 parent 插入会落到页面根，成为 PANEL_1 的同级节点。
const nestedExistingXml = path.join(dir, 'nested-existing-page.xml');
const nestedMergedXml = path.join(dir, 'nested-merged-page.xml');
fs.writeFileSync(nestedExistingXml, [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<IOContorl',
  '    ID=""',
  '    Left="NaN"',
  '    Top="NaN"',
  '    Width="NaN"',
  '    Height="NaN">',
  '    <IOContorl',
  '        ID="PANEL_1"',
  '        ControlType="Border"',
  '        Left="600"',
  '        Top="8"',
  '        Width="200"',
  '        Height="120">',
  '    </IOContorl>',
  '</IOContorl>',
  ''
].join('\n'));
const nestedMergeRun = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'),
  '--merge', nestedExistingXml, layoutParentMapping, '--out', nestedMergedXml], { encoding: 'utf8' });
assert.strictEqual(nestedMergeRun.status, 0, 'layoutParent 映射必须能 merge: ' + nestedMergeRun.stderr);
const nestedMergedText = fs.readFileSync(nestedMergedXml, 'utf8');
const panelBlock = (nestedMergedText.match(/<IOContorl[^>]*ID="PANEL_1"[\s\S]*?<\/IOContorl>/) || [''])[0];
assert.ok(panelBlock, 'merge 输出必须包含 PANEL_1 容器');
assert.match(panelBlock, /ID="ITEM_1"/,
  'merge 必须把新节点插入到输出父节点（layoutParent=panel）的闭合标签之前，而不是页面根');
assert.match(panelBlock, /ID="ITEM_1"[\s\S]*?Left="10"[\s\S]*?Top="0"/,
  'merge 新增的嵌套节点必须按输出父节点计算相对坐标（Left=10 / Top=0）');
console.log('PASS merge insertion point follows output parent');
