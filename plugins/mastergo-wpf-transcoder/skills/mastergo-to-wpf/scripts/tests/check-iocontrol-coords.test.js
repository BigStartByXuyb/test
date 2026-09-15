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
