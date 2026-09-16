'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { validate, validateTextAudit, validateCaptureProvenance } = require('../validate-iocontrol-provenance');

// 新产物的 capture provenance 基准（AI-27）：校验器现在硬断言 mapping.source 五项存在且非空。
// 下面每个「应当通过」的 fixture 都是新产物形态，所以都要带上——否则失败信息会变成缺 provenance，
// 而不是本用例真正要验证的那条规则。
const PROVENANCE = {
  egress: 'direct',
  sourceSha256: '0123456789abcdef'.repeat(4),
  sourceBytes: 2048,
  snapshotSha256: 'fedcba9876543210'.repeat(4),
  snapshotBytes: 4096
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iocontrol-provenance-'));
const xmlPath = path.join(dir, 'bad.xml');
const manifestPath = path.join(dir, 'mapping.json');

fs.writeFileSync(xmlPath, '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN"><IOContorl ID="RelativePositionXLabel" ControlType="TextBlock" Value="X" Left="658" Top="476" Width="10" Height="16" /></IOContorl>');
fs.writeFileSync(manifestPath, JSON.stringify({ contentOriginY: 192, source: PROVENANCE, sourceNodes: [
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
fs.writeFileSync(flatManifestPath, JSON.stringify({ contentOriginY: 192, source: PROVENANCE, rootRef: 'root', sourceNodes: [
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
fs.writeFileSync(fixed40ManifestPath, JSON.stringify({ contentOriginY: 192, source: PROVENANCE, sourceNodes: [
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
    source: PROVENANCE,
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
if (badIconBoxResult.ok || !badIconBoxResult.errors.some(x => /iconSize 与图标图形节点 bbox 不一致/.test(x))) {
  throw new Error('iconSize 与图标图形节点 bbox 不一致时必须失败');
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
fs.writeFileSync(numericTextManifestPath, JSON.stringify({ contentOriginY: 192, source: PROVENANCE, rootRef: 'root', sourceNodes: [
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
  source: PROVENANCE,
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
  source: PROVENANCE,
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
  source: PROVENANCE,
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
  source: PROVENANCE,
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

// ---- capture provenance 硬门禁（AI-28）----
// 断言只针对 AI-27 新增的 provenance 字段：五项存在且非空 + 形状正确。
// 历史产物（冻结守卫上线前，快照里没有 capture provenance）默认失败，可用
// --allow-legacy-provenance 显式把「缺失」降级为警告——但豁免不覆盖「写错的值」。
const { sha256File } = require('../lib/script-helpers');
const PROVENANCE_FIELD_NAMES = ['sourceSha256', 'sourceBytes', 'snapshotSha256', 'snapshotBytes', 'egress'];

assert.deepStrictEqual(validateCaptureProvenance({ source: PROVENANCE }, {}).errors, [],
  '五项齐全的 provenance 不得报错');
assert.deepStrictEqual(validateCaptureProvenance({ source: PROVENANCE }, {}).warnings, [],
  '断言通过时不得留下警告');
for (const field of PROVENANCE_FIELD_NAMES) {
  const dropped = Object.assign({}, PROVENANCE);
  delete dropped[field];
  assert.ok(validateCaptureProvenance({ source: dropped }, {}).errors.some(x => x.includes(field)),
    '缺 ' + field + ' 必须失败并点名该字段');
  // AI-27 的快照没有 capture provenance 时生成器如实写 null，null 必须走「缺失」这条路径
  assert.ok(validateCaptureProvenance({ source: Object.assign({}, PROVENANCE, { [field]: null }) }, {})
    .errors.some(x => x.includes(field)), field + ' 为 null 必须视同缺失');
}
assert.ok(validateCaptureProvenance({}, {}).errors.some(x => /缺少 mapping\.source/.test(x)),
  '整个 source 缺失必须失败');
assert.ok(validateCaptureProvenance([], {}).errors.some(x => /缺少 mapping\.source/.test(x)),
  '数组形态映射清单没有 source，必须失败');

// 形状：哈希 64 位小写十六进制、字节数正整数、egress 非空字符串——写错的值永远失败。
for (const bad of [PROVENANCE.sourceSha256.toUpperCase(), PROVENANCE.sourceSha256.slice(0, 63),
  PROVENANCE.sourceSha256 + 'z', 123]) {
  assert.ok(validateCaptureProvenance({ source: Object.assign({}, PROVENANCE, { sourceSha256: bad }) }, {})
    .errors.some(x => /sourceSha256 必须是 64 位小写十六进制/.test(x)), '哈希形状错误必须失败: ' + bad);
}
for (const bad of [0, -1, 1.5, '2048']) {
  assert.ok(validateCaptureProvenance({ source: Object.assign({}, PROVENANCE, { snapshotBytes: bad }) }, {})
    .errors.some(x => /snapshotBytes 必须是正整数字节数/.test(x)), '字节数形状错误必须失败: ' + bad);
}
assert.ok(validateCaptureProvenance({ source: Object.assign({}, PROVENANCE, { egress: '   ' }) }, {})
  .errors.some(x => /egress/.test(x)), '全空白的 egress 必须视同缺失');
assert.ok(validateCaptureProvenance({ source: Object.assign({}, PROVENANCE, { egress: 7 }) }, {})
  .errors.some(x => /egress 必须是非空字符串/.test(x)), '非字符串 egress 必须失败');

// 历史产物豁免：只把「缺失」降级为警告，且必须留下可见警告。
const legacyProvenance = { egress: null, sourceSha256: null, sourceBytes: null, snapshotSha256: null, snapshotBytes: null };
assert.ok(validateCaptureProvenance({ source: legacyProvenance }, {}).errors.length > 0,
  '历史产物默认必须失败');
const legacyExempt = validateCaptureProvenance({ source: legacyProvenance }, { allowLegacyProvenance: true });
assert.deepStrictEqual(legacyExempt.errors, [], '豁免后缺失不再是错误');
assert.ok(legacyExempt.warnings.length > 0, '豁免必须留下可见的警告，不得静默放行');
assert.ok(validateCaptureProvenance({ source: Object.assign({}, legacyProvenance, { snapshotSha256: 'NOTHEX' }) },
  { allowLegacyProvenance: true }).errors.some(x => /snapshotSha256 必须是 64 位小写十六进制/.test(x)),
  '豁免不得放过形状错误的哈希：缺字段与写错值不能互相抵消');

// 闭环核对：--snapshot / --capture-provenance 是可选旁证，核对同一份字节的事实。
const chainCaptureSha = 'a1b2c3d4'.repeat(8);
const chainSnapshotPath = path.join(dir, 'chain.dsl.snapshot.json');
fs.writeFileSync(chainSnapshotPath, JSON.stringify({
  schemaVersion: 'mastergo-dsl-snapshot/2', fileId: 'f', layerId: 'root',
  captureSha256: chainCaptureSha, captureBytes: 2048, egress: 'direct'
}, null, 2) + '\n');
const chainSource = {
  egress: 'direct', sourceSha256: chainCaptureSha, sourceBytes: 2048,
  snapshotSha256: sha256File(chainSnapshotPath), snapshotBytes: fs.statSync(chainSnapshotPath).size
};
const chainOptions = { snapshotPath: chainSnapshotPath };
assert.deepStrictEqual(validateCaptureProvenance({ source: chainSource }, chainOptions).errors, [],
  '快照与 mapping.source 闭环一致时不得报错');
assert.ok(validateCaptureProvenance({ source: Object.assign({}, chainSource, { snapshotSha256: PROVENANCE.snapshotSha256 }) },
  chainOptions).errors.some(x => /快照字节与 mapping\.source\.snapshotSha256 不一致/.test(x)),
  'snapshotSha256 与快照真实字节不符必须失败（防止抄一份别的页面的哈希）');
assert.ok(validateCaptureProvenance({ source: Object.assign({}, chainSource, { snapshotBytes: chainSource.snapshotBytes + 1 }) },
  chainOptions).errors.some(x => /快照字节数与 mapping\.source\.snapshotBytes 不一致/.test(x)),
  'snapshotBytes 与快照实际大小不符必须失败');
assert.ok(validateCaptureProvenance({ source: Object.assign({}, chainSource, { sourceSha256: PROVENANCE.sourceSha256 }) },
  chainOptions).errors.some(x => /captureSha256 与 mapping\.source\.sourceSha256 不一致/.test(x)),
  '快照回指的 capture 哈希与 mapping.source 不符必须失败（断链）');
const orphanSnapshotPath = path.join(dir, 'orphan.dsl.snapshot.json');
fs.writeFileSync(orphanSnapshotPath, JSON.stringify({ fileId: 'f', layerId: 'root' }, null, 2) + '\n');
assert.ok(validateCaptureProvenance({ source: chainSource }, { snapshotPath: orphanSnapshotPath })
  .errors.some(x => /缺少 captureSha256/.test(x)),
  '快照自己缺 captureSha256 时必须失败，不得当作已核对');
assert.ok(validateCaptureProvenance({ source: chainSource }, { snapshotPath: path.join(dir, 'no-such-snapshot.json') })
  .errors.some(x => /读取 DSL 快照 失败/.test(x)),
  '显式给出的旁证文件读不到必须失败，不得静默跳过已声明的核对');

const chainSidecarPath = path.join(dir, 'getDsl.json.provenance.json');
fs.writeFileSync(chainSidecarPath, JSON.stringify({
  schemaVersion: 'mastergo-mcp-capture-provenance/1', sha256: chainCaptureSha, bytes: 2048, egress: 'direct'
}, null, 2) + '\n');
const sidecarOptions = { captureProvenancePath: chainSidecarPath };
assert.deepStrictEqual(validateCaptureProvenance({ source: chainSource }, sidecarOptions).errors, [],
  '取数 sidecar 与 mapping.source 一致时不得报错');
assert.ok(validateCaptureProvenance({ source: Object.assign({}, chainSource, { sourceSha256: PROVENANCE.sourceSha256 }) },
  sidecarOptions).errors.some(x => /provenance sidecar 的 sha256 与 mapping\.source\.sourceSha256 不一致/.test(x)),
  'sidecar 哈希与 mapping.source 不符必须失败——这是唯一能对到真实 capture 字节的一环');
assert.ok(validateCaptureProvenance({ source: Object.assign({}, chainSource, { egress: 'corp-proxy' }) },
  sidecarOptions).errors.some(x => /egress 与 mapping\.source\.egress 不一致/.test(x)),
  '出网链路声明前后不一致必须失败');

// CLI 接线：默认硬失败、显式豁免可见、--snapshot 真的参与核对。
const legacyCliMappingPath = path.join(dir, 'header-group-legacy.json');
const legacyCliMapping = JSON.parse(fs.readFileSync(headerMappingPath, 'utf8'));
delete legacyCliMapping.source;
fs.writeFileSync(legacyCliMappingPath, JSON.stringify(legacyCliMapping, null, 2));
const gateFailRun = spawnSync(process.execPath, [cliScript, '--xml', headerXmlPath, '--mapping', legacyCliMappingPath], { encoding: 'utf8' });
assert.notStrictEqual(gateFailRun.status, 0, '缺 provenance 的历史产物默认必须校验失败');
assert.match(gateFailRun.stderr + gateFailRun.stdout, /缺少 mapping\.source/,
  '失败信息必须点名缺的是 capture provenance');
const gateExemptRun = spawnSync(process.execPath, [cliScript, '--xml', headerXmlPath, '--mapping', legacyCliMappingPath,
  '--allow-legacy-provenance'], { encoding: 'utf8' });
assert.strictEqual(gateExemptRun.status, 0,
  '显式豁免历史产物后必须通过: ' + gateExemptRun.stderr + gateExemptRun.stdout);
assert.match(gateExemptRun.stderr, /WARN: 历史产物豁免/,
  '豁免必须留在 stderr 上可见，不得静默放行');
const chainCliMappingPath = path.join(dir, 'header-group-chain.json');
fs.writeFileSync(chainCliMappingPath, JSON.stringify(
  Object.assign({}, JSON.parse(fs.readFileSync(headerMappingPath, 'utf8')), { source: chainSource }), null, 2));
const chainCliRun = spawnSync(process.execPath, [cliScript, '--xml', headerXmlPath, '--mapping', chainCliMappingPath,
  '--snapshot', chainSnapshotPath], { encoding: 'utf8' });
assert.strictEqual(chainCliRun.status, 0,
  '闭环一致时 --snapshot 不得误报: ' + chainCliRun.stderr + chainCliRun.stdout);
const chainCliBadRun = spawnSync(process.execPath, [cliScript, '--xml', headerXmlPath, '--mapping', headerMappingPath,
  '--snapshot', chainSnapshotPath], { encoding: 'utf8' });
assert.notStrictEqual(chainCliBadRun.status, 0, '--snapshot 与 mapping.source 的哈希不符必须失败');
assert.match(chainCliBadRun.stderr + chainCliBadRun.stdout, /snapshotSha256 不一致/,
  '失败信息必须点名是快照字节对不上');

console.log('PASS capture provenance gate regression test');
