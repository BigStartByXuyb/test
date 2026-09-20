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
assert.match(iconButtonTag, /IconWidth="97"/, 'IconWidth 必须取台账命中条目节点 bbox 并取整');
assert.match(iconButtonTag, /IconHeight="66"/, 'IconHeight 必须取台账命中条目节点 bbox 并取整');
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

// merge 容器类控件：GroupBox 的标题文案由 Header 承载（没有 Value），merge 必须同样按 dsl.text 覆盖，
// 否则保留旧 Header 会在 provenance 硬门禁处报 "Header != DSL"。文案承载属性与校验器同口径：
// 有 Value 比 Value，没有 Value 的容器比 Header。
const containerMapping = path.join(dir, 'container-mapping.json');
const containerExisting = path.join(dir, 'existing-container-page.xml');
const containerMerged = path.join(dir, 'merged-container-page.xml');
fs.writeFileSync(containerMapping, JSON.stringify({
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'grp', parentRef: 'root', pageAbsX: 100, pageAbsY: 292, relativeX: 100, relativeY: 292, width: 252, height: 534 },
    { ref: 'grp/title', parentRef: 'grp', pageAbsX: 108, pageAbsY: 300, relativeX: 8, relativeY: 8, width: 80, height: 20, type: 'TEXT', text: '周期名称' }
  ],
  textAudit: [{ sourceRef: 'grp/title', sourceText: '周期名称', visibility: true, role: 'content', decision: 'emit', outputRefs: ['GRP_1'] }],
  nodes: [
    {
      ref: 'grp', sourceRef: 'grp', sourceParent: 'root', id: 'GRP_1', xmlId: 'GRP_1',
      controlType: 'GroupBox', absX: 100, absY: 292, w: 252, h: 534,
      sourceText: '周期名称', valueSource: 'dsl.text',
      attrs: { Header: '周期名称', IOName: '', MinValue: '', MaxValue: '' }
    }
  ]
}, null, 2));
fs.writeFileSync(containerExisting, [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<IOContorl',
  '    ID=""',
  '    Left="NaN"',
  '    Top="NaN"',
  '    Width="NaN"',
  '    Height="NaN">',
  '    <IOContorl',
  '        ID="GRP_1"',
  '        ControlType="GroupBox"',
  '        Header="旧标题"',
  '        IOName="EngineerName"',
  '        Left="100"',
  '        Top="100"',
  '        Width="252"',
  '        Height="534" />',
  '</IOContorl>',
  ''
].join('\n'));
const containerMerge = spawnSync(process.execPath,
  [path.join(__dirname, '..', 'gen-iocontrol-xml.js'), '--merge', containerExisting, containerMapping, '--out', containerMerged],
  { encoding: 'utf8' });
assert.strictEqual(containerMerge.status, 0, '容器 merge 必须成功: ' + containerMerge.stderr);
const containerMergedText = fs.readFileSync(containerMerged, 'utf8');
const mergedGroupTag = (containerMergedText.match(/<IOContorl[^>]*ID="GRP_1"[\s\S]*?\/>/) || [''])[0];
assert.match(mergedGroupTag, /Header="周期名称"/,
  'merge 必须按 dsl.text 覆盖 GroupBox 的 Header（文案承载属性，没有 Value）');
assert.match(mergedGroupTag, /IOName="EngineerName"/,
  'merge 必须保留工程师手写的 IOName（只覆盖文案承载属性）');
assert.match(mergedGroupTag, /MinValue=""/, 'merge 必须补齐模板声明的空属性 MinValue');
assert.match(mergedGroupTag, /MaxValue=""/, 'merge 必须补齐模板声明的空属性 MaxValue');

// 容器内子节点的坐标必须从"内容区原点"量：Left/Top = 设计绝对 − 容器绝对 − contentInset。
// 漏扣这一项会让容器内所有子控件整体下移一个标题条高度（GroupBox 模板是标题条 + 内容区两段式）。
const nestedContainerMapping = path.join(dir, 'nested-container-mapping.json');
const nestedContainerOutput = path.join(dir, 'nested-container-page.xml');
fs.writeFileSync(nestedContainerMapping, JSON.stringify({
  rootRef: 'root',
  contentOriginY: 192,
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'grp', parentRef: 'root', pageAbsX: 658, pageAbsY: 514, relativeX: 658, relativeY: 514, width: 200, height: 160 },
    { ref: 'input', parentRef: 'root', pageAbsX: 704, pageAbsY: 566, relativeX: 704, relativeY: 566, width: 100, height: 40 },
    { ref: 'grp/title', parentRef: 'grp', pageAbsX: 682, pageAbsY: 530, relativeX: 24, relativeY: 16, width: 123, height: 20, type: 'TEXT', text: '设定XY轴位置' }
  ],
  textAudit: [{ sourceRef: 'grp/title', sourceText: '设定XY轴位置', visibility: true, role: 'component-value', decision: 'emit', outputRefs: ['GRP_9'] }],
  nodes: [
    {
      ref: 'grp', sourceRef: 'grp', sourceParent: 'root', id: 'GRP_9', xmlId: 'GRP_9',
      controlType: 'GroupBox', absX: 658, absY: 514, w: 200, h: 160,
      sourceText: '设定XY轴位置', valueSource: 'dsl.text', valueSourceRef: 'grp/title',
      contentInset: { left: 1, top: 35 },
      attrs: { Style: '', Header: '设定XY轴位置', IOName: '', IOVisible: '', IOEnable: '', MinValue: '', MaxValue: '' }
    },
    {
      ref: 'input', sourceRef: 'input', sourceParent: 'root', id: 'NB_9', xmlId: 'NB_9',
      controlType: 'NumberBox', absX: 704, absY: 566, w: 100, h: 40,
      parent: 'grp', layoutParent: 'grp', expectedLeft: 45, expectedTop: 17, attrs: {}
    }
  ]
}, null, 2));
const nestedRun = spawnSync(process.execPath,
  [path.join(__dirname, '..', 'gen-iocontrol-xml.js'), '--fresh', nestedContainerMapping, '--out', nestedContainerOutput],
  { encoding: 'utf8' });
assert.strictEqual(nestedRun.status, 0, '容器嵌套映射必须能正常渲染: ' + nestedRun.stderr);
const nestedText = fs.readFileSync(nestedContainerOutput, 'utf8');
const nestedGroupTag = (nestedText.match(/<IOContorl[^>]*ID="GRP_9"[\s\S]*?>/) || [''])[0];
// GroupBox 的 Style 是必写字段但按当前框架口径恒为空串；内容区原点仍按映射的 contentInset 换算。
assert.match(nestedGroupTag, /Style=""/, '容器必须发射 Style，且值为空串');
assert.doesNotMatch(nestedGroupTag, /Style="IOGroupBox/, 'Style 不得发射样式键');
const nestedInputTag = (nestedText.match(/<IOContorl[^>]*ID="NB_9"[\s\S]*?\/>/) || [''])[0];
assert.match(nestedInputTag, /Left="45"/,
  '容器内子节点的 Left 必须扣掉内容区左边框（704 − 658 − 1 = 45）');
assert.match(nestedInputTag, /Top="17"/,
  '容器内子节点的 Top 必须扣掉标题条高度（566 − 514 − 35 = 17）');

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

// ---- 发射顺序：同一"视觉行"（Top 差 ≤ 15px）按 Left 从左到右 ----
// 设计稿里成对的"标签 + 输入框"常有十几像素高差（标签 Top=52、下拉框 Top=40）。
// 严格按 Top 排序会把它们拆成两行、把成对控件排散；这里断言它们保持"标签 → 输入框"的阅读顺序。
const rowMapping = path.join(dir, 'visual-row-mapping.json');
const rowOutput = path.join(dir, 'visual-row-page.xml');
fs.writeFileSync(rowMapping, JSON.stringify({
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'l1', parentRef: 'root', pageAbsX: 687, pageAbsY: 202, relativeX: 687, relativeY: 202, width: 80, height: 40, type: 'TEXT', text: '镜头倍率' },
    { ref: 'l2', parentRef: 'root', pageAbsX: 766, pageAbsY: 202, relativeX: 766, relativeY: 202, width: 80, height: 40, type: 'TEXT', text: '低倍率' },
    { ref: 'combo', parentRef: 'root', pageAbsX: 766, pageAbsY: 232, relativeX: 766, relativeY: 232, width: 120, height: 40 },
    { ref: 'l3', parentRef: 'root', pageAbsX: 687, pageAbsY: 244, relativeX: 687, relativeY: 244, width: 80, height: 40, type: 'TEXT', text: '光源通道' }
  ],
  textAudit: [
    { sourceRef: 'l1', sourceText: '镜头倍率', visibility: true, role: 'content', decision: 'emit', outputRefs: ['ROW_L1'] },
    { sourceRef: 'l2', sourceText: '低倍率', visibility: true, role: 'content', decision: 'emit', outputRefs: ['ROW_L2'] },
    { sourceRef: 'l3', sourceText: '光源通道', visibility: true, role: 'content', decision: 'emit', outputRefs: ['ROW_L3'] }
  ],
  // 故意打乱：下拉框 → 光源通道 → 镜头倍率 → 低倍率
  nodes: [
    { ref: 'combo', sourceRef: 'combo', sourceParent: 'root', id: 'ROW_COMBO', xmlId: 'ROW_COMBO', controlType: 'ComboBox', absX: 766, absY: 232, w: 120, h: 40, attrs: { Value: 'Auto' } },
    orderTextNode('l3', 'ROW_L3', '光源通道', 687, 244),
    orderTextNode('l1', 'ROW_L1', '镜头倍率', 687, 202),
    orderTextNode('l2', 'ROW_L2', '低倍率', 766, 202)
  ]
}, null, 2));
const rowRun = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'),
  '--fresh', rowMapping, '--out', rowOutput], { encoding: 'utf8' });
assert.strictEqual(rowRun.status, 0, '视觉行用例必须能渲染: ' + rowRun.stderr);
const rowIds = [...fs.readFileSync(rowOutput, 'utf8').matchAll(/ID="(ROW_[A-Z0-9]+)"/g)].map((match) => match[1]);
assert.deepStrictEqual(rowIds, ['ROW_L1', 'ROW_L2', 'ROW_L3', 'ROW_COMBO'],
  '同一视觉行（Top 差 ≤ 15px）内必须按 Left 从左到右：标签"光源通道"要排在下拉框之前');

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

// ---- merge 新增「同级」节点也必须按视觉行排序（与 fresh 同一口径）----
// 场景：既有页面里没有这两个控件，merge 时把它们新增到 root 下。
// 旧的（严格 Top）实现会按 232 → 244 排成「下拉框 → 光源通道」；视觉行口径应为「光源通道 → 下拉框」。
const mergeRowMapping = path.join(dir, 'merge-row-mapping.json');
const mergeRowExisting = path.join(dir, 'merge-row-existing.xml');
const mergeRowMerged = path.join(dir, 'merge-row-merged.xml');
fs.writeFileSync(mergeRowMapping, JSON.stringify({
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'exist', parentRef: 'root', pageAbsX: 100, pageAbsY: 202, relativeX: 100, relativeY: 202, width: 80, height: 40, type: 'TEXT', text: '既有标签' },
    { ref: 'l3', parentRef: 'root', pageAbsX: 687, pageAbsY: 244, relativeX: 687, relativeY: 244, width: 80, height: 40, type: 'TEXT', text: '光源通道' },
    { ref: 'combo', parentRef: 'root', pageAbsX: 766, pageAbsY: 232, relativeX: 766, relativeY: 232, width: 120, height: 40 }
  ],
  textAudit: [
    { sourceRef: 'exist', sourceText: '既有标签', visibility: true, role: 'content', decision: 'emit', outputRefs: ['MROW_EXIST'] },
    { sourceRef: 'l3', sourceText: '光源通道', visibility: true, role: 'content', decision: 'emit', outputRefs: ['MROW_L3'] }
  ],
  // 故意把下拉框排在前（严格 Top 顺序），断言 merge 后按视觉行重排
  nodes: [
    { ref: 'exist', sourceRef: 'exist', sourceParent: 'root', id: 'MROW_EXIST', xmlId: 'MROW_EXIST', controlType: 'TextBlock', absX: 100, absY: 202, w: 80, h: 40, sourceText: '既有标签', valueSource: 'dsl.text', attrs: { Value: '既有标签' } },
    { ref: 'combo', sourceRef: 'combo', sourceParent: 'root', id: 'MROW_COMBO', xmlId: 'MROW_COMBO', controlType: 'ComboBox', absX: 766, absY: 232, w: 120, h: 40, attrs: { Value: 'Auto' } },
    orderTextNode('l3', 'MROW_L3', '光源通道', 687, 244)
  ]
}, null, 2));
fs.writeFileSync(mergeRowExisting, [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<IOContorl',
  '    ID=""',
  '    Left="NaN"',
  '    Top="NaN"',
  '    Width="NaN"',
  '    Height="NaN">',
  '    <IOContorl',
  '        ID="MROW_EXIST"',
  '        ControlType="TextBlock"',
  '        Value="既有标签"',
  '        Width="NaN"',
  '        Height="40"',
  '        Left="100"',
  '        Top="10" />',
  '</IOContorl>',
  ''
].join('\n'));
const mergeRowRun = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'),
  '--merge', mergeRowExisting, mergeRowMapping, '--out', mergeRowMerged], { encoding: 'utf8' });
assert.strictEqual(mergeRowRun.status, 0, 'merge 视觉行用例必须成功: ' + mergeRowRun.stderr);
const mergeRowIds = [...fs.readFileSync(mergeRowMerged, 'utf8').matchAll(/ID="(MROW_[A-Z0-9]+)"/g)].map((m) => m[1]);
assert.deepStrictEqual(mergeRowIds, ['MROW_EXIST', 'MROW_L3', 'MROW_COMBO'],
  'merge 新增的同级节点必须按视觉行排序：标签"光源通道"要排在下拉框之前');

console.log('PASS IOContorl typed-node gate regression test');
console.log('PASS IconButton fixed-attribute regression test');
console.log('PASS button-family rules are read from the template map');
console.log('PASS icon attributes follow the ControlType template scope');
console.log('PASS merge new siblings follow visual-row order');

// ---- 表格列定义（nodeKind=table-column）：几何按 columnTemplate 固定发射、不写 Width ----
const tableMap = path.join(__dirname, '..', '..', 'references', 'adapters', 'mtslg-iocontrol', 'mtslg-iocontrol-map.json');
const tableMapping = path.join(dir, 'table-mapping.json');
const tableOutput = path.join(dir, 'table-page.xml');
fs.writeFileSync(tableMapping, JSON.stringify({
  rootRef: 'root',
  contentOriginY: 192,
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'root/table', parentRef: 'root', pageAbsX: 50, pageAbsY: 507, relativeX: 50, relativeY: 507, width: 646, height: 189 },
    { ref: 'root/table/header', parentRef: 'root/table', pageAbsX: 175, pageAbsY: 507, relativeX: 125, relativeY: 0, width: 504, height: 32 },
    { ref: 'root/table/header/macro', parentRef: 'root/table/header', pageAbsX: 203, pageAbsY: 515, relativeX: 28, relativeY: 8, width: 47, height: 16, type: 'TEXT', text: 'Macro' },
    { ref: 'root/table/item/title', parentRef: 'root/table', pageAbsX: 64, pageAbsY: 551, relativeX: 14, relativeY: 44, width: 95, height: 16, type: 'TEXT', text: '图像识别阈值' }
  ],
  textAudit: [
    { sourceRef: 'root/table/header/macro', sourceText: 'Macro', visibility: true, role: 'component-value', decision: 'emit', outputRefs: ['MGCol_0001'] },
    { sourceRef: 'root/table/item/title', sourceText: '图像识别阈值', visibility: true, role: 'table-data-cell', decision: 'omit', omitReason: 'table-data-cell', outputRefs: [] }
  ],
  nodes: [
    {
      ref: 'root/table', sourceRef: 'root/table', sourceParent: 'root', id: 'MG_GRID', xmlId: 'MG_GRID',
      controlType: 'DataGrid', parent: null, layoutParent: null, absX: 50, absY: 507, w: 646, h: 189,
      expectedLeft: 50, expectedTop: 315, expectedWidth: 646, expectedHeight: 189,
      widthSource: 'dsl.bbox', heightSource: 'dsl.bbox', attrs: { Value: '' }
    },
    {
      ref: 'root/table/header/macro', sourceRef: 'root/table/header/macro', sourceParent: 'root/table/header',
      id: 'MGCol_0001', xmlId: 'MGCol_0001', controlType: 'TextBlock',
      parent: 'root/table', layoutParent: 'root/table', absX: 203, absY: 515, w: 47, h: 16,
      sourceText: 'Macro', valueSource: 'dsl.text',
      expectedLeft: 0, expectedTop: 0, expectedWidth: 'NaN', expectedHeight: 45,
      widthSource: 'table.column-template', heightSource: 'table.column-template',
      omitWidth: true, nodeKind: 'table-column', dslLeft: 153, dslTop: 8, dslWidth: 47, dslHeight: 16,
      attrs: { Value: 'Macro', IOName: '' }
    }
  ]
}, null, 2));
const tableFresh = spawnSync(process.execPath, [path.join(__dirname, '..', 'gen-iocontrol-xml.js'),
  '--fresh', tableMapping, '--out', tableOutput, '--map', tableMap], { encoding: 'utf8' });
assert.strictEqual(tableFresh.status, 0, '表格映射必须能正常渲染: ' + tableFresh.stderr);
const tableXml = fs.readFileSync(tableOutput, 'utf8');
const gridTag = (tableXml.match(/<IOContorl[^>]*ID="MG_GRID"[\s\S]*?>/) || [''])[0];
assert.ok(gridTag, 'fresh 输出必须包含 DataGrid 根节点');
assert.match(gridTag, /ControlType="DataGrid"/);
assert.match(gridTag, /Value=""/, 'DataGrid 的 Value 无来源时必须空串占位');
assert.match(gridTag, /Left="50"/);
assert.match(gridTag, /Top="315"/);
const columnTag = (tableXml.match(/<IOContorl[^>]*ID="MGCol_0001"[\s\S]*?\/>/) || [''])[0];
assert.ok(columnTag, 'fresh 输出必须包含列定义子节点');
assert.match(columnTag, /Left="0"/, '列定义几何固定 Left=0');
assert.match(columnTag, /Top="0"/, '列定义几何固定 Top=0');
assert.match(columnTag, /Height="45"/, '列定义几何固定 Height=45');
assert.doesNotMatch(columnTag, /Width=""/, '列定义不写 Width');
assert.ok(!columnTag.includes('Width='), '列定义不得发射 Width');
assert.match(columnTag, /IOName=""/, '列定义必须恒写 IOName 空占位');
assert.ok(!columnTag.includes('FontSize='), '列定义不套页面控件的必写字段集');

console.log('PASS table column definition (DataGrid columns) regression test');

// ---- 变体登记 omitRequiredAttrs：被收窄的必写字段不发射（右栏 enter/exit 用这条） ----
const omitMap = path.join(__dirname, '..', '..', 'references', 'adapters', 'mtslg-iocontrol', 'mtslg-iocontrol-map.json');
const omitMapping = path.join(dir, 'omit-attrs-mapping.json');
const omitOutput = path.join(dir, 'omit-attrs-page.xml');
fs.writeFileSync(omitMapping, JSON.stringify({
  rootRef: 'root',
  contentOriginY: 192,
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'right/enter', parentRef: 'root', pageAbsX: 1090, pageAbsY: 606, relativeX: 1090, relativeY: 606, width: 170, height: 80 },
    { ref: 'right/enter/icon', parentRef: 'right/enter', pageAbsX: 1112, pageAbsY: 629, relativeX: 22, relativeY: 23, width: 34.677, height: 33.009 }
  ],
  nodes: [{
    ref: 'right/enter', sourceRef: 'right/enter', sourceParent: 'root', id: 'MG_ENT', xmlId: 'MG_ENT',
    controlType: 'IconButton', parent: null, layoutParent: null, absX: 1090, absY: 606, w: 170, h: 80,
    expectedLeft: 1090, expectedTop: 414, expectedWidth: 170, expectedHeight: 80,
    widthSource: 'dsl.bbox', heightSource: 'dsl.bbox',
    // 解析器（resolve-mtslg-template-mapping.js）按变体登记盖上的收窄标记
    omitAttrs: ['IOVisible', 'IOEnable', 'IsShowStatus', 'IsNeedRedMark'],
    iconSize: { width: 34.677, height: 33.009, sourceRef: 'right/enter/icon' },
    attrs: { Style: 'EnterButtonStyle', Icon: 'EnterGeometry', Value: 'ENTER', LangName: 'DemoEnter', PageName: '', IsSave: 'true' }
  }]
}, null, 2));
const omitResult = spawnSync(process.execPath, [
  path.join(__dirname, '..', 'gen-iocontrol-xml.js'), '--fresh', omitMapping, '--out', omitOutput, '--map', omitMap
], { encoding: 'utf8' });
assert.strictEqual(omitResult.status, 0, omitResult.stderr);
const omitXml = fs.readFileSync(omitOutput, 'utf8');
const omitTag = (omitXml.match(/<IOContorl[^>]*ID="MG_ENT"[\s\S]*?\/>/) || [''])[0];
assert.ok(omitTag, '必须发射该按钮节点');
for (const attr of ['IOVisible', 'IOEnable', 'IsShowStatus', 'IsNeedRedMark']) {
  assert.ok(!omitTag.includes(attr + '='), 'omitRequiredAttrs 登记的 ' + attr + ' 不得发射');
}
assert.match(omitTag, /IOCommand=""/, '未登记的必写字段仍须空串占位');
assert.match(omitTag, /Style="EnterButtonStyle"/);
assert.match(omitTag, /IsSave="true"/, 'fixedAttrs 仍须发射');
assert.match(omitTag, /IconWidth="35"/, '图标尺寸仍按 bbox 四舍五入发射');
assert.match(omitTag, /IconHeight="33"/);

console.log('PASS variant omitRequiredAttrs narrowing regression test');

// ---- merge 唯一性硬门：现有文件里同一个 ID 指向两个控件（人工复制节点忘改 ID 的典型场景）
//      → 必须先修再 merge，禁止把重复 ID 静默带进交付物 ----
const dupExisting = path.join(dir, 'existing-duplicate-id.xml');
const dupMergedOut = path.join(dir, 'merged-duplicate-id.xml');
fs.writeFileSync(dupExisting, [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN">',
  '    <IOContorl ID="TXT_1" ControlType="TextBlock" Value="旧标签" Left="200" Top="100" Width="80" Height="40" />',
  '    <IOContorl ID="TXT_1" ControlType="TextBlock" Value="复制出来的副本" Left="400" Top="100" Width="80" Height="40" />',
  '</IOContorl>',
  ''
].join('\n'));
const dupRun = spawnSync(process.execPath,
  [path.join(__dirname, '..', 'gen-iocontrol-xml.js'), '--merge', dupExisting, buttonMapping, '--out', dupMergedOut],
  { encoding: 'utf8' });
assert.notStrictEqual(dupRun.status, 0, '现有文件存在重复 ID 时必须拒绝 merge');
assert.match(dupRun.stderr + dupRun.stdout, /重复 ID/, '失败信息必须指出重复 ID');

// ---- merge：LangName 跟随设计稿覆盖（它是 Value 的多语言载体），人工的业务属性保留 ----
const langExisting = path.join(dir, 'existing-langname.xml');
const langMergedOut = path.join(dir, 'merged-langname.xml');
const langMappingPath = path.join(dir, 'langname-mapping.json');
fs.writeFileSync(langExisting, [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN">',
  '    <IOContorl ID="TXT_1" ControlType="TextBlock" Value="旧标签" LangName="OldKey" IOName="KeepMe" Left="200" Top="100" Width="NaN" Height="40" />',
  '</IOContorl>',
  ''
].join('\n'));
fs.writeFileSync(langMappingPath, JSON.stringify({
  contentOriginY: 192,
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 }
  ],
  nodes: [{
    ref: 'txt1', xmlId: 'TXT_1', id: 'TXT_1', controlType: 'TextBlock', parent: null, layoutParent: null,
    absX: 200, absY: 292, w: 80, h: 16, expectedLeft: 200, expectedTop: 100,
    expectedWidth: 'NaN', expectedHeight: 40, dslWidth: 80, sourceRef: 'txt1',
    sourceText: '新标签', valueSource: 'dsl.text',
    attrs: { Value: '新标签', LangName: 'F2DemoNewLabel', ControlType: 'TextBlock' }
  }]
}, null, 2));
const langRun = spawnSync(process.execPath,
  [path.join(__dirname, '..', 'gen-iocontrol-xml.js'), '--merge', langExisting, langMappingPath, '--out', langMergedOut],
  { encoding: 'utf8' });
assert.strictEqual(langRun.status, 0, 'LangName 覆盖用例必须能跑通: ' + langRun.stderr);
const langTag = (fs.readFileSync(langMergedOut, 'utf8').match(/<IOContorl[^>]*ID="TXT_1"[\s\S]*?\/>/) || [''])[0];
assert.match(langTag, /LangName="F2DemoNewLabel"/, 'LangName 必须跟随设计稿覆盖');
assert.match(langTag, /Value="新标签"/, '文案（dsl.text）按设计稿覆盖');
assert.match(langTag, /IOName="KeepMe"/, '人工的业务属性必须保留');
assert.match(langRun.stderr + langRun.stdout, /语言键覆盖/, '语言键被覆盖时必须写进报告');

console.log('PASS merge 唯一性硬门 + LangName 跟随设计稿回归测试');
