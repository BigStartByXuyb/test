#!/usr/bin/env node
"use strict";

// 测试临时目录卫生回归：拿一个真实用例在私有 TEMP 下跑一遍，跑完不许留自己的目录。
// 依据：scripts/tests/helpers/tmp-dir.js 在进程退出时删除本进程建的临时目录。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const TESTS = __dirname;
const SAMPLE = "constraints.test.js";
const PREFIX = "constraints-";

// 私有 TEMP：样本用例的 os.tmpdir() 指向这里，既隔离又不会与并行执行的其它用例互相干扰。
const privateTemp = fs.mkdtempSync(path.join(os.tmpdir(), "tmp-hygiene-parent-"));
try {
  const env = Object.assign({}, process.env, { TEMP: privateTemp, TMP: privateTemp });
  const result = spawnSync(process.execPath, ["--test", path.join(TESTS, SAMPLE)], {
    encoding: "utf8",
    env: env,
    maxBuffer: 64 * 1024 * 1024
  });
  assert.strictEqual(result.status, 0,
    SAMPLE + " 必须自己跑通（exit=" + result.status + "）：" + String(result.stderr || result.stdout || "").slice(-800));

  const leftovers = fs.readdirSync(privateTemp).filter((name) => name.startsWith(PREFIX));
  assert.deepStrictEqual(leftovers, [],
    SAMPLE + " 跑完不得在临时目录留下自己的目录（留在 " + privateTemp + "）：" + leftovers.join("、"));
}
finally {
  fs.rmSync(privateTemp, { recursive: true, force: true });
}

console.log("PASS 测试临时目录卫生：" + SAMPLE + " 未留 " + PREFIX + "* 目录");
