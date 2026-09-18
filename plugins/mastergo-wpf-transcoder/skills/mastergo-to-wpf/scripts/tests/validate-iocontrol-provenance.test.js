'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { validate, validateTextAudit } = require('../validate-iocontrol-provenance');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iocontrol-provenance-'));
const xmlPath = path.join(dir, 'bad.xml');
const manifestPath = path.join(dir, 'mapping.json');

fs.writeFileSync(xmlPath, '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN"><IOContorl ID="RelativePositionXLabel" ControlType="TextBlock" Value="X" Left="658" Top="476" Width="10" Height="16" /></IOContorl>');
fs.writeFileSync(manifestPath, JSON.stringify({ contentOriginY: 192, sourceNodes: [
  { ref: '3:44417', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
  { ref: '3:56338/3:53325/3:53243', parentRef: '3:44417', pageAbsX: 658, pageAbsY: 668, relativeX: 658, relativeY: 668, width: 63, height: 16, text: '镜头倍率' }
], nodes: [{
  xmlId: 'RelativePositionXLabel',
  sourceRef: '3:56338/3:53325/3:53243',
  sourceParent: '3:44417',
  sourceText: '镜头倍率',
  valueSource: 'dsl.text',
  expectedLeft: 0,
  expectedTop: 476,
  expectedWidth: 63,
  expectedHeight: 16
}] }));

const result = validate(xmlPath, manifestPath);
if (result.ok) throw new Error('校验器必须拒绝错误 Value 和错误 Width');
if (!result.errors.some(x => /Value/.test(x))) throw new Error('缺少 Value 错误');
if (!result.errors.some(x => /Width/.test(x))) throw new Error('缺少 Width 错误');
if (!result.errors.some(x => /expectedLeft/.test(x))) throw new Error('缺少 sourceNodes 坐标重算错误');
const flatXmlPath = path.join(dir, 'flat.xml');
const flatManifestPath = path.join(dir, 'flat.json');
fs.writeFileSync(flatXmlPath, '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN"><IOContorl ID="FlatChild" ControlType="TextBlock" Value="SCAN" Left="150" Top="158" Width="NaN" Height="40" /></IOContorl>');
fs.writeFileSync(flatManifestPath, JSON.stringify({ contentOriginY: 192, rootRef: 'root', sourceNodes: [
  { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
  { ref: 'component', parentRef: 'root', pageAbsX: 100, pageAbsY: 300, relativeX: 100, relativeY: 300, width: 384, height: 132 },
  { ref: 'component/scan', parentRef: 'component', pageAbsX: 150, pageAbsY: 350, relativeX: 50, relativeY: 50, width: 45, height: 18, text: 'SCAN' }
], nodes: [{
  xmlId: 'FlatChild', sourceRef: 'component/scan', sourceParent: 'component', layoutParent: null,
  sourceText: 'SCAN', valueSource: 'dsl.text', expectedLeft: 150, expectedTop: 158,
  expectedWidth: 'NaN', expectedHeight: 40, widthSource: 'mtslg.textblock.fixed-nan', dslWidth: 45, heightSource: 'mtslg.textblock.fixed-40'
}] }));
const flatResult = validate(flatXmlPath, flatManifestPath);
if (!flatResult.ok) throw new Error('展平模板节点应按 layoutParent=null 使用页面绝对坐标: ' + flatResult.errors.join('; '));
const fixed40XmlPath = path.join(dir, 'fixed40.xml');
const fixed40ManifestPath = path.join(dir, 'fixed40.json');
fs.writeFileSync(fixed40XmlPath, '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN"><IOContorl ID="FixedText" ControlType="TextBlock" Value="标题" FontSize="16" Left="10" Top="20" Width="NaN" Height="40" /></IOContorl>');
fs.writeFileSync(fixed40ManifestPath, JSON.stringify({ contentOriginY: 192, sourceNodes: [
  { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
  { ref: 'text', parentRef: 'root', pageAbsX: 10, pageAbsY: 212, relativeX: 10, relativeY: 212, width: 50, height: 16, text: '标题' }
], nodes: [{
  xmlId: 'FixedText', sourceRef: 'text', sourceParent: 'root', sourceText: '标题', valueSource: 'dsl.text',
  expectedLeft: 10, expectedTop: 20, expectedWidth: 'NaN', expectedHeight: 40,
  heightSource: 'mtslg.textblock.fixed-40'
}] }));
const fixed40Result = validate(fixed40XmlPath, fixed40ManifestPath);
if (!fixed40Result.ok) throw new Error('TextBlock 固定 40 高度应通过 provenance 校验: ' + fixed40Result.errors.join('; '));
const fixedManifestPath = path.join(dir, 'wrong-origin.json');
const fixedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
fixedManifest.contentOriginY = 191;
fs.writeFileSync(fixedManifestPath, JSON.stringify(fixedManifest));
const fixedResult = validate(xmlPath, fixedManifestPath);
if (fixedResult.ok || !fixedResult.errors.some(x => /固定为 192/.test(x))) {
  throw new Error('校验器必须拒绝非 192 的 contentOriginY');
}

const textAuditMapping = {
  sourceNodes: [
    { ref: 'visible-text', type: 'TEXT', text: '显示文本' },
    { ref: 'placeholder-text', type: 'TEXT', text: '组件占位文案' },
    { ref: 'hidden-text', type: 'TEXT', text: '隐藏文本' },
    { ref: 'title-text', type: 'TEXT', text: '标题' }
  ],
  nodes: [
    { xmlId: 'visible-text', sourceRef: 'visible-text', sourceText: '显示文本', valueSource: 'dsl.text' },
    { xmlId: 'placeholder-text', sourceRef: 'placeholder-text', sourceText: '组件占位文案', valueSource: 'dsl.text' }
  ],
  textAudit: [
    { sourceRef: 'visible-text', sourceText: '显示文本', visibility: true, role: 'content', decision: 'emit', outputRefs: ['visible-text'] },
    { sourceRef: 'placeholder-text', sourceText: '组件占位文案', visibility: true, role: 'mapped-placeholder', decision: 'emit', outputRefs: ['placeholder-text'] },
    { sourceRef: 'hidden-text', sourceText: '隐藏文本', visibility: false, role: 'content', decision: 'omit', omitReason: 'hidden', outputRefs: [] },
    { sourceRef: 'title-text', sourceText: '标题', visibility: true, role: 'page-title', decision: 'omit', omitReason: 'page-title', outputRefs: [] }
  ]
};
if (validateTextAudit(textAuditMapping, textAuditMapping.nodes).length !== 0) {
  throw new Error('正确的 textAudit 不应失败');
}
const missingVisibleOutput = JSON.parse(JSON.stringify(textAuditMapping));
missingVisibleOutput.nodes = [];
if (!validateTextAudit(missingVisibleOutput, missingVisibleOutput.nodes).some(x => /可见普通 TEXT/.test(x))) {
  throw new Error('可见普通 TEXT 缺少输出时必须失败');
}

// ---- 按钮族固定参数与图标尺寸 ----
const buttonSourceNodes = [
  { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
  { ref: 'btn', parentRef: 'root', pageAbsX: 300, pageAbsY: 300, relativeX: 300, relativeY: 300, width: 170, height: 80 },
  { ref: 'btn/icon', parentRef: 'btn', pageAbsX: 312, pageAbsY: 314, relativeX: 12, relativeY: 14, width: 97.0352783203125, height: 65.99 },
  { ref: 'plain', parentRef: 'root', pageAbsX: 600, pageAbsY: 300, relativeX: 600, relativeY: 300, width: 60, height: 60 }
];
function buttonCase(tagAttrs, nodeExtra) {
  const xml = '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN"><IOContorl ' +
    Object.entries(tagAttrs).map(([k, v]) => k + '="' + v + '"').join(' ') + ' /></IOContorl>';
  const manifest = {
    contentOriginY: 192,
    sourceNodes: buttonSourceNodes,
    nodes: [Object.assign({
      xmlId: 'BTN', sourceRef: 'btn', sourceParent: 'root', controlType: 'IconButton',
      expectedLeft: 300, expectedTop: 108, expectedWidth: 170, expectedHeight: 80,
      attrs: { ControlType: 'IconButton' }
    }, nodeExtra || {})]
  };
  const xmlFile = path.join(dir, 'button-case.xml');
  const manifestFile = path.join(dir, 'button-case.json');
  fs.writeFileSync(xmlFile, xml);
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  return validate(xmlFile, manifestFile);
}
const iconButtonAttrs = { ID: 'BTN', ControlType: 'IconButton', Icon: 'ExitGeometry', PageName: '', IOVisible: '', IOCommand: '', IOEnable: '', IconWidth: '97', IconHeight: '66', Left: '300', Top: '108', Width: '170', Height: '80' };
const iconNodeAttrs = { attrs: { ControlType: 'IconButton', Icon: 'ExitGeometry', PageName: '', IOVisible: '', IOCommand: '', IOEnable: '' }, iconSize: { width: 97.0352783203125, height: 65.99, sourceRef: 'btn/icon' } };
const goodButton = buttonCase(iconButtonAttrs, iconNodeAttrs);
if (!goodButton.ok) throw new Error('合法按钮族节点应通过 provenance 校验: ' + goodButton.errors.join('; '));

const missingAlwaysAttrs = Object.assign({}, iconButtonAttrs);
delete missingAlwaysAttrs.IOVisible;
const missingAlwaysNode = { attrs: { ControlType: 'IconButton', Icon: 'ExitGeometry', PageName: '', IOCommand: '' }, iconSize: { width: 97.0352783203125, height: 65.99, sourceRef: 'btn/icon' } };
const missingAlwaysResult = buttonCase(missingAlwaysAttrs, missingAlwaysNode);
if (missingAlwaysResult.ok || !missingAlwaysResult.errors.some(x => /缺少必写属性 IOVisible/.test(x))) {
  throw new Error('按钮族缺少 IOVisible 时必须失败');
}

const noIconSizeResult = buttonCase(iconButtonAttrs, { attrs: { ControlType: 'IconButton', Icon: 'ExitGeometry', PageName: '', IOVisible: '', IOCommand: '' } });
if (noIconSizeResult.ok || !noIconSizeResult.errors.some(x => /缺少 iconSize/.test(x))) {
  throw new Error('按钮带 Icon 却缺少 iconSize 时必须失败');
}

const badIconRefResult = buttonCase(iconButtonAttrs, { attrs: { ControlType: 'IconButton', Icon: 'ExitGeometry', PageName: '', IOVisible: '', IOCommand: '' }, iconSize: { width: 97.0352783203125, height: 65.99, sourceRef: 'btn/missing' } });
if (badIconRefResult.ok || !badIconRefResult.errors.some(x => /iconSize.sourceRef 不存在/.test(x))) {
  throw new Error('iconSize.sourceRef 不在 sourceNodes 时必须失败');
}

const badIconBoxResult = buttonCase(iconButtonAttrs, { attrs: { ControlType: 'IconButton', Icon: 'ExitGeometry', PageName: '', IOVisible: '', IOCommand: '' }, iconSize: { width: 40, height: 40, sourceRef: 'btn/icon' } });
if (badIconBoxResult.ok || !badIconBoxResult.errors.some(x => /iconSize 与台账命中条目节点 bbox 不一致/.test(x))) {
  throw new Error('iconSize 与台账命中条目节点 bbox 不一致时必须失败');
}

const plainButtonAttrs = { ID: 'BTN', ControlType: 'IconButton', PageName: '', IOVisible: '', IOCommand: '', IconWidth: '60', IconHeight: '60', Left: '600', Top: '108', Width: '60', Height: '60' };
const plainButtonNode = { sourceRef: 'plain', expectedLeft: 600, expectedTop: 108, expectedWidth: 60, expectedHeight: 60, attrs: { ControlType: 'IconButton', PageName: '', IOVisible: '', IOCommand: '' } };
const plainButtonResult = buttonCase(plainButtonAttrs, plainButtonNode);
if (plainButtonResult.ok || !plainButtonResult.errors.some(x => /无图标按钮的 IconWidth 必须为空值/.test(x))) {
  throw new Error('无图标按钮带非空 IconWidth/IconHeight 时必须失败');
}

// ---- TextBlock 固定宽度 NaN ----
const numericTextXmlPath = path.join(dir, 'textblock-numeric-width.xml');
const numericTextManifestPath = path.join(dir, 'textblock-numeric-width.json');
fs.writeFileSync(numericTextXmlPath, '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN"><IOContorl ID="TextWidth" ControlType="TextBlock" Value="标签" Left="10" Top="220" Width="76" Height="40" /></IOContorl>');
fs.writeFileSync(numericTextManifestPath, JSON.stringify({ contentOriginY: 192, rootRef: 'root', sourceNodes: [
  { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
  { ref: 'text', parentRef: 'root', pageAbsX: 10, pageAbsY: 412, relativeX: 10, relativeY: 412, width: 76, height: 22, text: '标签' }
], nodes: [{
  xmlId: 'TextWidth', sourceRef: 'text', sourceParent: 'root', sourceText: '标签', valueSource: 'dsl.text',
  expectedLeft: 10, expectedTop: 220, expectedWidth: 76, expectedHeight: 40, heightSource: 'mtslg.textblock.fixed-40'
}] }));
const numericTextResult = validate(numericTextXmlPath, numericTextManifestPath);
if (numericTextResult.ok) throw new Error('TextBlock 使用具体宽度时必须失败');
if (!numericTextResult.errors.some(x => /TextBlock 的 Width 必须固定为 NaN/.test(x))) {
  throw new Error('缺少 TextBlock Width 固定 NaN 错误: ' + numericTextResult.errors.join('; '));
}
if (!numericTextResult.errors.some(x => /TextBlock 的 expectedWidth 必须固定为 NaN/.test(x))) {
  throw new Error('缺少 TextBlock expectedWidth 固定 NaN 错误');
}
// 按钮族规则改为读模板表（--map）：表里要求额外属性时，校验必须跟着变严
const assert = require('assert');
const { spawnSync } = require('child_process');
const cliScript = path.join(__dirname, '..', 'validate-iocontrol-provenance.js');
const cliXmlPath = path.join(dir, 'button-cli.xml');
const cliMappingPath = path.join(dir, 'button-cli-mapping.json');
const cliTemplateMapPath = path.join(dir, 'button-cli-template-map.json');
fs.writeFileSync(cliXmlPath, [
  '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN">',
  '  <IOContorl ID="BTN" ControlType="IconButton" PageName="" IOVisible="" IOCommand="" IOEnable="" Left="10" Top="10" Width="20" Height="20" />',
  '</IOContorl>'
].join('\n'));
fs.writeFileSync(cliMappingPath, JSON.stringify({
  contentOriginY: 192,
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'btn', parentRef: 'root', pageAbsX: 10, pageAbsY: 202, relativeX: 10, relativeY: 202, width: 20, height: 20 }
  ],
  nodes: [{
    xmlId: 'BTN', sourceRef: 'btn', sourceParent: 'root',
    expectedLeft: 10, expectedTop: 10, expectedWidth: 20, expectedHeight: 20
  }]
}, null, 2));
fs.writeFileSync(cliTemplateMapPath, JSON.stringify({
  buttonFamily: {
    controlTypes: ['IconButton'],
    alwaysWrittenAttrs: ['PageName', 'IOVisible', 'IOCommand', 'IOParam']
  }
}, null, 2));

const defaultRun = spawnSync(process.execPath, [cliScript, '--xml', cliXmlPath, '--mapping', cliMappingPath], { encoding: 'utf8' });
assert.strictEqual(defaultRun.status, 0, '默认规则下该按钮族 XML 应通过: ' + defaultRun.stderr);
const strictRun = spawnSync(process.execPath, [cliScript, '--xml', cliXmlPath, '--mapping', cliMappingPath, '--map', cliTemplateMapPath], { encoding: 'utf8' });
assert.notStrictEqual(strictRun.status, 0, '模板表要求 IOParam 时，缺该属性的按钮必须校验失败');
assert.match(strictRun.stderr + strictRun.stdout, /IOParam/, '失败信息必须指出缺失的按钮族常驻属性');

// ---- 模板不含图标字段的按钮族：映射残留 Icon/iconSize 不得被当成「有图标」 ----
const scopedMapPath = path.join(dir, 'template-map-button-without-icon.json');
const scopedXmlPath = path.join(dir, 'button-without-icon.xml');
const scopedMappingPath = path.join(dir, 'button-without-icon-mapping.json');
fs.writeFileSync(scopedMapPath, JSON.stringify({
  buttonFamily: {
    controlTypes: ['IconButton', 'Button'],
    alwaysWrittenAttrs: ['PageName', 'IOVisible', 'IOCommand', 'IOEnable'],
    iconSizeAttrs: ['IconWidth', 'IconHeight']
  },
  controlTypeRequiredAttrs: {
    Button: ['Style', 'Value', 'PageName', 'IOCommand', 'IOEnable', 'IOVisible'],
    IconButton: ['Style', 'Value', 'PageName', 'Icon', 'IOCommand', 'IOEnable', 'IOVisible', 'IconWidth', 'IconHeight']
  }
}, null, 2));
fs.writeFileSync(scopedXmlPath, '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN">' +
  '<IOContorl ID="BTN" ControlType="Button" Style="SmallButton" Value="+5" PageName="" IOVisible="" IOCommand="" ' +
  'IOEnable="" Left="600" Top="108" Width="60" Height="60" /></IOContorl>');
fs.writeFileSync(scopedMappingPath, JSON.stringify({
  contentOriginY: 192,
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'plain', parentRef: 'root', pageAbsX: 600, pageAbsY: 300, relativeX: 600, relativeY: 300, width: 60, height: 60 },
    { ref: 'plain/icon', parentRef: 'plain', pageAbsX: 610, pageAbsY: 310, relativeX: 10, relativeY: 10, width: 40, height: 40 }
  ],
  nodes: [{
    xmlId: 'BTN', sourceRef: 'plain', sourceParent: 'root', controlType: 'Button',
    expectedLeft: 600, expectedTop: 108, expectedWidth: 60, expectedHeight: 60,
    // 映射残留图标信息：模板不含图标字段时，两项都不参与校验
    attrs: { ControlType: 'Button', Icon: 'EnterGeometry' },
    iconSize: { width: 40, height: 40, sourceRef: 'plain/icon' }
  }]
}, null, 2));
const scopedRun = spawnSync(process.execPath, [cliScript, '--xml', scopedXmlPath,
  '--mapping', scopedMappingPath, '--map', scopedMapPath], { encoding: 'utf8' });
assert.strictEqual(scopedRun.status, 0,
  '模板不含图标字段的 Button 不得因映射残留 Icon/iconSize 触发图标尺寸校验: ' + scopedRun.stderr + scopedRun.stdout);
// 未传 --map 时必须与生成器内置口径一致：Button / StatusButton 仍不按图标字段校验。
const noMapRun = spawnSync(process.execPath, [cliScript, '--xml', scopedXmlPath,
  '--mapping', scopedMappingPath], { encoding: 'utf8' });
assert.strictEqual(noMapRun.status, 0,
  '未传 --map 时也要与生成器内置口径一致：Button 不得因映射残留 Icon 触发图标尺寸校验: ' + noMapRun.stderr + noMapRun.stdout);
// ---- 表已提供但确实缺该 ControlType 条目：走「无该条目」分支，与生成器一致视为模板不含图标字段 ----
// 节点用 IconButton、表只登记 Button，才能让 requiredAttrs 为 undefined，真正覆盖该分支。
const missingEntryMapPath = path.join(dir, 'template-map-missing-entry.json');
const missingEntryXmlPath = path.join(dir, 'iconbutton-missing-entry.xml');
const missingEntryBadXmlPath = path.join(dir, 'iconbutton-missing-entry-bad.xml');
const missingEntryMappingPath = path.join(dir, 'iconbutton-missing-entry-mapping.json');
fs.writeFileSync(missingEntryMapPath, JSON.stringify({
  buttonFamily: {
    controlTypes: ['IconButton', 'Button'],
    alwaysWrittenAttrs: ['PageName', 'IOVisible', 'IOCommand', 'IOEnable'],
    iconSizeAttrs: ['IconWidth', 'IconHeight']
  },
  controlTypeRequiredAttrs: {
    Button: ['Style', 'Value', 'PageName', 'IOCommand', 'IOEnable', 'IOVisible']
  }
}, null, 2));
const missingEntryNode = '<IOContorl ID="BTN" ControlType="IconButton" PageName="" IOVisible="" IOCommand="" ' +
  'IOEnable="" Left="600" Top="108" Width="60" Height="60"';
fs.writeFileSync(missingEntryXmlPath,
  '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN">' + missingEntryNode + ' /></IOContorl>');
fs.writeFileSync(missingEntryBadXmlPath,
  '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN">' + missingEntryNode +
  ' IconWidth="50" IconHeight="40" /></IOContorl>');
fs.writeFileSync(missingEntryMappingPath, JSON.stringify({
  contentOriginY: 192,
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'plain', parentRef: 'root', pageAbsX: 600, pageAbsY: 300, relativeX: 600, relativeY: 300, width: 60, height: 60 }
  ],
  nodes: [{
    xmlId: 'BTN', sourceRef: 'plain', sourceParent: 'root', controlType: 'IconButton',
    expectedLeft: 600, expectedTop: 108, expectedWidth: 60, expectedHeight: 60,
    attrs: { ControlType: 'IconButton' }
  }]
}, null, 2));
const missingEntryRun = spawnSync(process.execPath, [cliScript, '--xml', missingEntryXmlPath,
  '--mapping', missingEntryMappingPath, '--map', missingEntryMapPath], { encoding: 'utf8' });
assert.strictEqual(missingEntryRun.status, 0,
  '表里缺该 ControlType 条目时必须与生成器一致（视为模板不含图标字段），不得按 IconButton 反推图标尺寸: ' +
  missingEntryRun.stderr + missingEntryRun.stdout);
const missingEntryBadRun = spawnSync(process.execPath, [cliScript, '--xml', missingEntryBadXmlPath,
  '--mapping', missingEntryMappingPath, '--map', missingEntryMapPath], { encoding: 'utf8' });
assert.notStrictEqual(missingEntryBadRun.status, 0,
  '表里缺该 ControlType 条目时，发射了图标尺寸字段必须失败（证明走的是「模板不含图标字段」分支）');
assert.match(missingEntryBadRun.stderr + missingEntryBadRun.stdout, /模板不含图标字段，不得发射 IconWidth/,
  '失败信息必须来自「模板不含图标字段」分支，而不是按 IconButton 反推出的无图标占位分支');

console.log('PASS provenance regression test');

// ---- 文案承载属性：GroupBox 以 Header 承载文案（valueSource=dsl.text 时比 Header）----
const headerXmlPath = path.join(dir, 'header-group.xml');
const headerMappingPath = path.join(dir, 'header-group.json');
fs.writeFileSync(headerXmlPath, [
  '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN">',
  '  <IOContorl ID="MG_GROUP" ControlType="GroupBox" Style="" Header="周期名称" LangName="PGroupHeader" IOName="" IOVisible="" IOEnable="" MinValue="" MaxValue="" Width="252" Height="534" Left="790" Top="12" />',
  '</IOContorl>'
].join('\n'));
fs.writeFileSync(headerMappingPath, JSON.stringify({
  contentOriginY: 192,
  rootRef: 'root',
  sourceNodes: [
    { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref: 'root/group', parentRef: 'root', pageAbsX: 790, pageAbsY: 204, relativeX: 790, relativeY: 204, width: 252, height: 534 }
  ],
  nodes: [{
    xmlId: 'MG_GROUP', sourceRef: 'root/group', sourceParent: 'root', sourceText: '周期名称', valueSource: 'dsl.text',
    expectedLeft: 790, expectedTop: 12, expectedWidth: 252, expectedHeight: 534
  }]
}, null, 2));
const headerRun = spawnSync(process.execPath, [cliScript, '--xml', headerXmlPath, '--mapping', headerMappingPath], { encoding: 'utf8' });
assert.strictEqual(headerRun.status, 0,
  'GroupBox 以 Header 承载文案时必须通过（不得要求 Value）: ' + headerRun.stderr + headerRun.stdout);

const headerBadXmlPath = path.join(dir, 'header-group-bad.xml');
fs.writeFileSync(headerBadXmlPath, fs.readFileSync(headerXmlPath, 'utf8').replace('Header="周期名称"', 'Header="别的标题"'));
const headerBadRun = spawnSync(process.execPath, [cliScript, '--xml', headerBadXmlPath, '--mapping', headerMappingPath], { encoding: 'utf8' });
assert.notStrictEqual(headerBadRun.status, 0, 'Header 与 DSL 文本不一致必须失败');
assert.match(headerBadRun.stderr + headerBadRun.stdout, /Header="别的标题" != DSL="周期名称"/,
  '失败信息必须点名 Header 与 DSL 文本不一致');

const headerMissingXmlPath = path.join(dir, 'header-group-missing.xml');
fs.writeFileSync(headerMissingXmlPath, fs.readFileSync(headerXmlPath, 'utf8')
  .replace(' Header="周期名称"', '').replace(' LangName="PGroupHeader"', ''));
const headerMissingRun = spawnSync(process.execPath, [cliScript, '--xml', headerMissingXmlPath, '--mapping', headerMappingPath], { encoding: 'utf8' });
assert.notStrictEqual(headerMissingRun.status, 0, '既没有 Value 也没有 Header 必须失败');
assert.match(headerMissingRun.stderr + headerMissingRun.stdout, /既没有 Value 也没有 Header/);

console.log('PASS provenance Header-carrier regression test');

// ---- 表格列定义（nodeKind=table-column）：按映射表 columnTemplate 校验，不套控件规则 ----
const tableMapPath = path.join(__dirname, '..', '..', 'references', 'adapters', 'mtslg-iocontrol', 'mtslg-iocontrol-map.json');
const tableSourceNodes = [
  { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
  { ref: 'root/table', parentRef: 'root', pageAbsX: 50, pageAbsY: 507, relativeX: 50, relativeY: 507, width: 646, height: 189 },
  { ref: 'root/table/header', parentRef: 'root/table', pageAbsX: 175, pageAbsY: 507, relativeX: 125, relativeY: 0, width: 504, height: 32 },
  { ref: 'root/table/header/macro', parentRef: 'root/table/header', pageAbsX: 203, pageAbsY: 515, relativeX: 28, relativeY: 8, width: 47, height: 16, text: 'Macro' },
  { ref: 'root/table/item/title', parentRef: 'root/table', pageAbsX: 64, pageAbsY: 551, relativeX: 14, relativeY: 44, width: 95, height: 16, text: '图像识别阈值' }
];
function tableCase(gridAttrs, columnAttrs, nodeExtra) {
  const xml = [
    '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN">',
    '  <IOContorl ' + gridAttrs + '>',
    '    <IOContorl ' + columnAttrs + ' />',
    '  </IOContorl>',
    '</IOContorl>'
  ].join('\n');
  const manifest = {
    contentOriginY: 192,
    rootRef: 'root',
    sourceNodes: tableSourceNodes,
    nodes: [
      {
        xmlId: 'MG_GRID', sourceRef: 'root/table', sourceParent: 'root', controlType: 'DataGrid',
        parent: null, layoutParent: null, absX: 50, absY: 507, w: 646, h: 189,
        expectedLeft: 50, expectedTop: 315, expectedWidth: 646, expectedHeight: 189,
        widthSource: 'dsl.bbox', heightSource: 'dsl.bbox', attrs: { Value: '' }
      },
      Object.assign({
        xmlId: 'MGCol_0001', sourceRef: 'root/table/header/macro', sourceParent: 'root/table/header',
        controlType: 'TextBlock', nodeKind: 'table-column', parent: 'root/table', layoutParent: 'root/table',
        absX: 203, absY: 515, w: 47, h: 16, sourceText: 'Macro', valueSource: 'dsl.text',
        expectedLeft: 0, expectedTop: 0, expectedWidth: 'NaN', expectedHeight: 45,
        widthSource: 'table.column-template', heightSource: 'table.column-template',
        omitWidth: true, dslLeft: 153, dslTop: 8, dslWidth: 47, dslHeight: 16,
        attrs: { Value: 'Macro', IOName: '' }
      }, nodeExtra || {})
    ],
    textAudit: [
      { sourceRef: 'root/table/header/macro', sourceText: 'Macro', visibility: true, role: 'component-value', decision: 'emit', outputRefs: ['MGCol_0001'] },
      { sourceRef: 'root/table/item/title', sourceText: '图像识别阈值', visibility: true, role: 'table-data-cell', decision: 'omit', omitReason: 'table-data-cell', outputRefs: [] }
    ]
  };
  const xmlFile = path.join(dir, 'table-case.xml');
  const manifestFile = path.join(dir, 'table-case.json');
  fs.writeFileSync(xmlFile, xml);
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  return validate(xmlFile, manifestFile, { templateMapPath: tableMapPath });
}

const gridAttrs = 'ID="MG_GRID" ControlType="DataGrid" Value="" IOName="" IOVisible="" IOEnable="" Width="646" Height="189" Left="50" Top="315"';
const goodColumn = 'ID="MGCol_0001" ControlType="TextBlock" Value="Macro" IOName="" Height="45" Left="0" Top="0"';
const tableOk = tableCase(gridAttrs, goodColumn);
assert.ok(tableOk.ok, '合法的表格列定义必须通过 provenance：' + tableOk.errors.join('; '));

const tableWidth = tableCase(gridAttrs, goodColumn + ' Width="NaN"');
assert.ok(!tableWidth.ok && tableWidth.errors.some(x => /不得发射 Width/.test(x)),
  '列定义发射 Width 必须失败');

const tableGeometry = tableCase(gridAttrs, 'ID="MGCol_0001" ControlType="TextBlock" Value="Macro" IOName="" Height="45" Left="0" Top="8"');
assert.ok(!tableGeometry.ok && tableGeometry.errors.some(x => /Top=8 != expected=0/.test(x)),
  '列定义几何偏离 columnTemplate 必须失败');

const tableNoIoname = tableCase(gridAttrs, 'ID="MGCol_0001" ControlType="TextBlock" Value="Macro" Height="45" Left="0" Top="0"');
assert.ok(!tableNoIoname.ok && tableNoIoname.errors.some(x => /缺少恒写属性 IOName/.test(x)),
  '列定义缺少恒写 IOName 必须失败');

const tableBadDsl = tableCase(gridAttrs, goodColumn, { dslWidth: 99 });
assert.ok(!tableBadDsl.ok && tableBadDsl.errors.some(x => /dslLeft\/dslTop\/dslWidth\/dslHeight/.test(x)),
  '列定义的 dsl* 溯源与 sourceNodes 不一致必须失败');

// 表格列定义不套 controlTypeRequiredAttrs：TextBlock 列缺少 Style/FontSize 等页面控件字段仍然通过。
assert.ok(!tableOk.errors.some(x => /缺少必写属性 Style/.test(x)),
  '列定义是列结构，不得按页面控件的必写字段集校验');

console.log('PASS provenance table-column regression test');
