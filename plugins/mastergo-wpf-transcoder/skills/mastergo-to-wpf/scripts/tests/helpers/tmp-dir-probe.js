#!/usr/bin/env node
"use strict";

// 卫生回归的样本：建一个临时目录，把路径报到 stdout，退出时由助手删除。
// 不是用例（文件名不含 .test），只由 tests/tmp-hygiene.test.js 拉起。

const fs = require("fs");
const path = require("path");

const { tmpDir } = require(path.join(__dirname, "tmp-dir.js"));

const dir = tmpDir("tmp-hygiene-probe-");
fs.writeFileSync(path.join(dir, "probe.txt"), "probe\n", "utf8");
console.log("PROBE_DIR " + dir);
