#!/usr/bin/env node
'use strict';

// 备份保留份数：同一目标文件只留最近 MAX_BACKUPS（2）份 .bak，更早的副本自动删除。
// 依据：backupFile 由 Bundle / Layout / 宿主壳三处共用（唯一实现在 lib/script-helpers.js）。

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const helpers = require(path.join(__dirname, '..', 'lib', 'script-helpers.js'));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-backup-retention-'));
const target = path.join(root, 'View.xaml');
fs.writeFileSync(target, 'v0\n', 'utf8');

// 每次覆盖前都备份，并把该份备份的内容记下来（备份名可能被复用，所以用内容判定，不用路径判定）。
const snapshots = [];
for (let i = 1; i <= 4; i += 1) {
  // 真实调用顺序是「先备份、再覆盖」（copyOutput：backupFile(target) → 写新内容），照此复现。
  const backup = helpers.backupFile(target);
  snapshots.push({ path: backup, content: fs.readFileSync(backup, 'utf8') });
  fs.writeFileSync(target, 'v' + i + '\n', 'utf8');
  // 备份按修改时间排序：把前 3 份钉在过去且递增的时间点，
  // 保证“最近 2 份”的判定稳定（最新一份保留自然时间 = 真正最新）。
  if (i < 4) {
    const anchor = (Date.now() - (4 - i) * 1000) / 1000;
    fs.utimesSync(backup, anchor, anchor);
  }
}

const remaining = helpers.listBackups(target);
assert.strictEqual(remaining.length, helpers.MAX_BACKUPS,
  '同一目标文件只允许保留 MAX_BACKUPS 份备份');
assert.strictEqual(remaining.length, 2, '默认保留份数为 2');
// 保留的必须是最近两次覆盖前的状态：第 4 次备份存的是 v3，第 3 次备份存的是 v2。
assert.ok(fs.existsSync(snapshots[3].path), '最近一次备份必须保留（哪怕文件名被复用）');
assert.strictEqual(snapshots[3].content, 'v3\n', '最近一次备份内容是覆盖前的状态');
assert.deepStrictEqual(
  remaining.map(function (file) { return fs.readFileSync(file, 'utf8'); }).sort(),
  ['v2\n', 'v3\n'],
  '只保留最近两次备份的内容，更早的 2 份被删除');

// 幂等/无关文件不受影响：另一个目标文件的备份不参与本文件的保留判定。
const other = path.join(root, 'Other.xaml');
fs.writeFileSync(other, 'o\n', 'utf8');
helpers.backupFile(other);
helpers.backupFile(other);
assert.strictEqual(helpers.listBackups(target).length, 2, '其他文件的备份不得影响本文件保留数');
assert.strictEqual(helpers.listBackups(other).length, 2, '其他文件同样按 2 份保留');

fs.rmSync(root, { recursive: true, force: true });
console.log('PASS backup retention regression test');
