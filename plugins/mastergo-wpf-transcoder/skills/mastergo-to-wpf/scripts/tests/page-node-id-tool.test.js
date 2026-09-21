#!/usr/bin/env node
'use strict';
// 交叉校验：tools/page-node-id/MasterGoPageNodeId.exe（C# 实现）与 scripts/lib/page-node-id.js
// （JS 唯一实现）算出的页面节点 ID 必须完全一致——两个实现漂移会让"人工手写控件查 ID"拿到错的句柄。
// 非 Windows 或 exe 不存在时跳过（exe 是给不装 Node 的开发用的，插件的正式产物）。

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pageKeyOf, derivePageNodeId } = require('../lib/page-node-id.js');

const exe = path.resolve(__dirname, '..', '..', '..', '..', 'tools', 'page-node-id', 'MasterGoPageNodeId.exe');
if (process.platform !== 'win32' || !fs.existsSync(exe)) {
  console.log('SKIP MasterGoPageNodeId.exe 交叉校验（非 Windows 或 exe 不存在）');
  process.exit(0);
}

// 夹具：与真实 DSL 同形（子节点 id 就是"父链 + 自身 id"的全路径）
const snapshot = {
  dsl: {
    nodes: [{
      type: 'INSTANCE', id: '79:162125', name: '连续运行数据（3.1.8.NS）',
      layoutStyle: { width: 1280, height: 1028, relativeX: 0, relativeY: 0 },
      children: [{
        type: 'INSTANCE', id: '1158:250712', name: '背景常驻信息',
        layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
        children: [{
          type: 'TEXT', id: '1158:250712/261:131374', name: '固定文本框',
          layoutStyle: { width: 88, height: 16, relativeX: 92, relativeY: 386 },
          text: [{ text: '检测区域(%)' }]
        }]
      }, {
        type: 'INSTANCE', id: '1158:251921', name: '右侧栏',
        layoutStyle: { width: 170, height: 80, relativeX: 1090, relativeY: 606 },
        children: [{
          type: 'TEXT', id: '1158:251921/2221:228393/1066:249745', name: '固定文本框',
          layoutStyle: { width: 82, height: 24, relativeX: 72, relativeY: 29 },
          text: [{ text: 'ENTER' }]
        }]
      }]
    }]
  }
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-node-id-'));
const snapshotPath = path.join(dir, 'dsl.snapshot.json');
fs.writeFileSync(snapshotPath, JSON.stringify(snapshot), 'utf8');

const pageKey = pageKeyOf(snapshot);
const refs = [];
(function walk(node) {
  refs.push(node.id);
  for (const child of node.children || []) walk(child);
})(snapshot.dsl.nodes[0]);
const expectedIds = refs.map((ref) => derivePageNodeId(pageKey, ref));

// 1) --all：exe 输出的 ID 集合必须与 JS 派生完全一致
const all = spawnSync(exe, ['--all', '--snapshot', snapshotPath], { encoding: 'utf8' });
assert.strictEqual(all.status, 0, 'exe --all 必须成功: ' + all.stderr);
const exeIds = (all.stdout.match(/MX_[0-9a-f]{32}/g) || []);
assert.strictEqual(exeIds.length, expectedIds.length,
  'exe 输出的节点数必须与 JS 派生一致（' + exeIds.length + ' vs ' + expectedIds.length + '）');
assert.deepStrictEqual(exeIds.slice().sort(), expectedIds.slice().sort(),
  'exe 与 JS 派生的页面节点 ID 必须完全一致');

// 2) 按名字/文本查：命中行里的 ID 必须是该节点自己的 ID
const byText = spawnSync(exe, ['检测区域', '--snapshot', snapshotPath], { encoding: 'utf8' });
assert.strictEqual(byText.status, 0, '按文本查询必须命中: ' + byText.stderr);
assert.ok(byText.stdout.includes(derivePageNodeId(pageKey, '1158:250712/261:131374')),
  '按文本查询必须返回该节点的 ID');
assert.ok(byText.stdout.includes('layer_id：261:131374'), '输出必须给出自身 layer_id 便于在 MasterGo 里对照');

// 3) 查不到时返回非 0（方便脚本判断）
const none = spawnSync(exe, ['这个控件不存在', '--snapshot', snapshotPath], { encoding: 'utf8' });
assert.strictEqual(none.status, 1, '查不到匹配节点时必须以 1 退出');

console.log('PASS 页面节点 ID 工具（MasterGoPageNodeId.exe ↔ JS 公式）交叉校验');
