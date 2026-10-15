#!/usr/bin/env node
"use strict";

// 测试临时目录卫生回归：样本在私有 TEMP 下跑一遍，必须自报建在哪里，并且退出时已删除。
// 依据：scripts/tests/helpers/tmp-dir.js 在进程退出时删除本进程建的临时目录。

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { tmpDir } = require(path.join(__dirname, "helpers", "tmp-dir.js"));

const PROBE = path.join(__dirname, "helpers", "tmp-dir-probe.js");
// 私有 TEMP：样本的 os.tmpdir() 指向这里，三个变量都给，避免个别平台优先取 TMPDIR 导致隔离失效。
const privateTemp = tmpDir("tmp-hygiene-parent-");
const env = Object.assign({}, process.env, { TMPDIR: privateTemp, TEMP: privateTemp, TMP: privateTemp });

const result = spawnSync(process.execPath, [PROBE], { encoding: "utf8", env: env });
assert.strictEqual(result.status, 0,
  "样本必须跑通（exit=" + result.status + "）：" + String(result.stderr || "").slice(-400));

// 样本自报它建在哪：既证明私有 TEMP 生效，也证明它确实建过目录（断言不是恒真）。
const reported = (result.stdout.match(/^PROBE_DIR (.+)$/m) || [])[1];
assert.ok(reported, "样本必须自报临时目录路径，实际输出：" + result.stdout);
assert.ok(reported.startsWith(privateTemp + path.sep),
  "样本的临时目录必须落在私有 TEMP 下，实际：" + reported);
assert.ok(!fs.existsSync(reported), "样本退出后临时目录必须已删除：" + reported);
assert.deepStrictEqual(fs.readdirSync(privateTemp), [], "私有 TEMP 不得留下残留：" + privateTemp);

console.log("PASS 测试临时目录卫生：样本自建目录已在退出时删除");
