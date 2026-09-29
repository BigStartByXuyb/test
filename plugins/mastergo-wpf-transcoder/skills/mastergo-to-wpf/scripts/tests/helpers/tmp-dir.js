#!/usr/bin/env node
"use strict";

// 测试临时目录：创建即登记，测试进程退出时统一删除。
// 背景：用例用 fs.mkdtempSync 建一次性的输入/输出目录，建完各自不清理，
// 一次全量回归就在系统临时目录里留下数百个目录。
// 边界：只管本进程建的目录；删不掉就把退出码置 1，让泄漏在 CI 里暴露。

const fs = require("fs");
const os = require("os");
const path = require("path");

const tracked = new Set();
let hooked = false;

// 建一个临时目录并登记，返回它的绝对路径。
function tmpDir(prefix) {
  if (!hooked) {
    process.on("exit", removeAll);
    hooked = true;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tracked.add(dir);
  return dir;
}

// 删除全部已登记的临时目录。
function removeAll() {
  for (const dir of Array.from(tracked)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    catch (error) {
      process.exitCode = 1;
      console.error("测试临时目录删不掉：" + dir + " → " + error.message);
      continue;
    }
    tracked.delete(dir);
  }
}

module.exports = { tmpDir };
