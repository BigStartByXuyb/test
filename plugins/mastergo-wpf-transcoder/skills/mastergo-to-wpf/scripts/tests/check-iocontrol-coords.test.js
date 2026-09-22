'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iocontrol-coords-'));
const xmlPath = path.join(dir, 'page.xml');
const nodesPath = path.join(dir, 'nodes.json');

fs.writeFileSync(xmlPath, '<IOContorl ID="label" ControlType="TextBlock" Left="658" Top="476" Width="63" Height="40" FontSize="16" />');
fs.writeFileSync(nodesPath, JSON.stringify([{
  id: 'label', x: 658, y: 668, w: 63, h: 40, fontSize: 16,
  contentOriginX: 0, contentOriginY: 192
}]));

const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'check-iocontrol-coords.js'), '--xml', xmlPath, '--nodes', nodesPath], { encoding: 'utf8' });
if (result.status !== 0) {
  throw new Error(`absolute coordinate regression failed:\n${result.stdout}\n${result.stderr}`);
}
if (!/OK id="label"/.test(result.stdout)) throw new Error('expected absolute coordinate match');
console.log('PASS absolute coordinate regression test');

// ---- 嵌套节点：XML 里的 Left/Top 是相对父容器的，原点必须是父容器的页面绝对坐标 ----
// 父容器 panel：pageAbs(600, 392) → Left=600-0=600、Top=(392-192)-0=200
// 子控件 label2：pageAbs(610, 412) → Left=610-600=10、Top=(412-192)-(392-192)=20
const nestedXmlPath = path.join(dir, 'nested-page.xml');
const nestedNodesPath = path.join(dir, 'nested-nodes.json');
fs.writeFileSync(nestedXmlPath, [
  '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN">',
  '  <IOContorl ID="panel" ControlType="Border" Left="600" Top="200" Width="200" Height="120">',
  '    <IOContorl ID="label2" ControlType="TextBlock" Left="10" Top="20" Width="NaN" Height="40" FontSize="16" />',
  '  </IOContorl>',
  '</IOContorl>'
].join('\n'));
fs.writeFileSync(nestedNodesPath, JSON.stringify([
  { id: 'panel', x: 600, y: 392, w: 200, h: 120, contentOriginX: 0, contentOriginY: 192 },
  { id: 'label2', x: 610, y: 412, w: 'NaN', h: 40, contentOriginX: 600, contentOriginY: 392 }
]));
const nestedResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'check-iocontrol-coords.js'),
  '--xml', nestedXmlPath, '--nodes', nestedNodesPath], { encoding: 'utf8' });
if (nestedResult.status !== 0) {
  throw new Error(`nested coordinate regression failed:\n${nestedResult.stdout}\n${nestedResult.stderr}`);
}
if (!/OK id="panel"/.test(nestedResult.stdout) || !/OK id="label2"/.test(nestedResult.stdout)) {
  throw new Error('expected nested coordinate match for both panel and label2:\n' + nestedResult.stdout);
}
console.log('PASS nested (parent-relative) coordinate regression test');

// ---- 度量归一化与缺度量报错：数值字符串算数值；缺度量必须点名 MISMATCH（不允许静默跳过）----
// 与 provenance / bundle 坐标门禁同口径：Number("292") 视为数值，缺字段必须失败。
// 独立夹具：TextBlock 的 Width 按规则必须是 NaN，因此不复用上面 Width="63" 的旧夹具。
const metricXmlPath = path.join(dir, 'metric-page.xml');
fs.writeFileSync(metricXmlPath, '<IOContorl ID="label" ControlType="TextBlock" Left="658" Top="476" Width="NaN" Height="40" FontSize="16" />');
const stringMetricNodesPath = path.join(dir, 'string-metric-nodes.json');
fs.writeFileSync(stringMetricNodesPath, JSON.stringify([
  { id: 'label', x: '658', y: '668', w: 'NaN', h: '40', contentOriginX: '0', contentOriginY: '192' }
]));
const stringMetricResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'check-iocontrol-coords.js'),
  '--xml', metricXmlPath, '--nodes', stringMetricNodesPath], { encoding: 'utf8' });
if (stringMetricResult.status !== 0 || !/OK id="label"/.test(stringMetricResult.stdout)) {
  throw new Error(`数值字符串度量必须按数值核对:\n${stringMetricResult.stdout}`);
}

const nonNumericNodesPath = path.join(dir, 'non-numeric-nodes.json');
fs.writeFileSync(nonNumericNodesPath, JSON.stringify([
  { id: 'label', x: 'abc', y: 668, w: 'NaN', h: 40, contentOriginX: 0, contentOriginY: 192 }
]));
const nonNumericResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'check-iocontrol-coords.js'),
  '--xml', metricXmlPath, '--nodes', nonNumericNodesPath], { encoding: 'utf8' });
if (nonNumericResult.status === 0 || !/MISMATCH id="label"/.test(nonNumericResult.stdout)) {
  throw new Error(`非数值度量必须报 MISMATCH:\n${nonNumericResult.stdout}`);
}

const missingMetricNodesPath = path.join(dir, 'missing-metric-nodes.json');
fs.writeFileSync(missingMetricNodesPath, JSON.stringify([
  { id: 'label', w: 'NaN', h: 40, contentOriginX: 0, contentOriginY: 192 }   // 缺 x / y
]));
const missingMetricResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'check-iocontrol-coords.js'),
  '--xml', metricXmlPath, '--nodes', missingMetricNodesPath], { encoding: 'utf8' });
if (missingMetricResult.status === 0 || !/缺少设计稿度量: x, y/.test(missingMetricResult.stdout)) {
  throw new Error(`缺少度量必须点名报 MISMATCH:\n${missingMetricResult.stdout}`);
}

const missingWidthNodesPath = path.join(dir, 'missing-width-nodes.json');
fs.writeFileSync(missingWidthNodesPath, JSON.stringify([
  { id: 'label', x: 658, y: 668, h: 40, contentOriginX: 0, contentOriginY: 192 }   // 缺 w
]));
const missingWidthResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'check-iocontrol-coords.js'),
  '--xml', metricXmlPath, '--nodes', missingWidthNodesPath], { encoding: 'utf8' });
if (missingWidthResult.status === 0 || !/缺少设计稿度量: w/.test(missingWidthResult.stdout)) {
  throw new Error(`缺宽度必须点名报 MISMATCH:\n${missingWidthResult.stdout}`);
}
console.log('PASS coordinate metric normalization + missing-metric reporting');

// ---- TextBlock Align=Right：Left 由 expectedLeft 显式给出（口径：到父容器外框右边缘的距离）----
// 节点表里 x 仍是控件自身的页面绝对 X（708），但 Align=Right 的 Left 口径不是 x − 原点，而是
// 「父容器外框右边缘 − (x + 设计稿 bbox 宽)」= 1280 − (708 + 42) = 530；check-coords.mjs 会算好并
// 以 expectedLeft 传给核对器。这里验证核对器 honored expectedLeft（并验证没给时仍按 x − 原点算）。
const alignRightXmlPath = path.join(dir, 'align-right-page.xml');
const alignRightNodesPath = path.join(dir, 'align-right-nodes.json');
fs.writeFileSync(alignRightXmlPath, '<IOContorl ID="r1" ControlType="TextBlock" Left="530" Top="10" Width="NaN" Height="40" FontSize="16" Align="Right" />');
fs.writeFileSync(alignRightNodesPath, JSON.stringify([
  { id: 'r1', x: 708, y: 202, w: 'NaN', h: 40, contentOriginX: 0, contentOriginY: 192, expectedLeft: 530 }
]));
const alignRightResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'check-iocontrol-coords.js'),
  '--xml', alignRightXmlPath, '--nodes', alignRightNodesPath], { encoding: 'utf8' });
if (alignRightResult.status !== 0 || !/OK id="r1"/.test(alignRightResult.stdout)) {
  throw new Error(`Align=Right 的 expectedLeft 必须被核对器采用:\n${alignRightResult.stdout}\n${alignRightResult.stderr}`);
}
// 反向：不给 expectedLeft 时仍按 x − contentOriginX 核对 —— 用同一份 XML 会因 674 != 530 报 MISMATCH。
const noOverrideNodesPath = path.join(dir, 'align-right-no-override-nodes.json');
fs.writeFileSync(noOverrideNodesPath, JSON.stringify([
  { id: 'r1', x: 708, y: 202, w: 'NaN', h: 40, contentOriginX: 0, contentOriginY: 192 }
]));
const noOverrideResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'check-iocontrol-coords.js'),
  '--xml', alignRightXmlPath, '--nodes', noOverrideNodesPath], { encoding: 'utf8' });
if (noOverrideResult.status === 0 || !/MISMATCH id="r1"/.test(noOverrideResult.stdout)) {
  throw new Error(`不给 expectedLeft 时必须按 x − 原点核对并报 MISMATCH:\n${noOverrideResult.stdout}`);
}
console.log('PASS Align=Right expectedLeft override regression test');
