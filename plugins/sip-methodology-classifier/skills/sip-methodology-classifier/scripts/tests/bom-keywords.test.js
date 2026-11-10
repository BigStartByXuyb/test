"use strict";

/*
 * BOM 关键词口径：SKILL.md 与 sip_rules._bom_result 必须同源。
 * 这组用例覆盖文档里列出的全部外观关键词，防止实现新增关键词后说明再次漂移。
 */

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const skillRoot = path.resolve(__dirname, "..", "..");
const scriptsDir = path.join(skillRoot, "scripts");
const python = process.platform === "win32" ? "python" : "python3";

function classify(items) {
  const code = [
    "import json, os, sys",
    "sys.path.insert(0, os.getcwd())",
    "from sip_rules import _bom_result",
    "items = json.loads(sys.stdin.buffer.read().decode('utf-8'))",
    "out = json.dumps({item: list(_bom_result(item)) for item in items}, ensure_ascii=False)",
    "sys.stdout.buffer.write(out.encode('utf-8'))"
  ].join("\n");
  const result = spawnSync(python, ["-I", "-c", code], {
    cwd: scriptsDir,
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    input: JSON.stringify(items),
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("BOM 外观关键词在说明与实现中一致", () => {
  const skill = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
  assert.match(skill, /外观\/安装\/完好\/牢固\/无损伤 → 外观 1 级/);

  const actual = classify(["安装牢固", "包装完好无损伤", "运行正常"]);
  assert.deepEqual(actual["安装牢固"], ["2. 外观检验", "1级"]);
  assert.deepEqual(actual["包装完好无损伤"], ["2. 外观检验", "1级"]);
  assert.deepEqual(actual["运行正常"], ["3. 通电检验", "5级"]);
});
