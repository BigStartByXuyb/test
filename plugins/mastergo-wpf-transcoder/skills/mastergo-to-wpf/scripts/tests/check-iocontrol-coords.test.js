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
