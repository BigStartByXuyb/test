"use strict";

/*
 * 同格式输出：文件名中的 Excel 非法字符必须先清洗，再写成 Sheet 名。
 */

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const test = require("node:test");

const skillRoot = path.resolve(__dirname, "..", "..");
const scriptsDir = path.join(skillRoot, "scripts");
const python = process.platform === "win32" ? "python" : "python3";

function runPython(code) {
  const result = spawnSync(python, ["-I", "-c", code], {
    cwd: scriptsDir,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test("Excel 非法字符先清洗，再截断并去重", () => {
  const result = JSON.parse(runPython([
    "import json, os, sys",
    "sys.path.insert(0, os.getcwd())",
    "from sip_sheet_name import safe_name",
    "used = set()",
    "names = [safe_name('MX[SLG]1', used), safe_name('MX[SLG]1', used), safe_name('', used), safe_name('A' * 40, used)]",
    "print(json.dumps(names, ensure_ascii=False))"
  ].join("\n")));
  assert.deepEqual(result, ["MX_SLG_1", "MX_SLG_1_2", "Sheet", "A".repeat(31)]);
});

test("生成器在创建工作表前先清洗标题", () => {
  const source = fs.readFileSync(path.join(scriptsDir, "build_reference_format.py"), "utf8");
  assert.match(source, /title = safe_name\(os\.path\.splitext\(os\.path\.basename\(path\)\)\[0\], used\)\s*wb, unclassified = transform_source\(path, row_map, title\)/);
  assert.doesNotMatch(source, /ws\.title = os\.path\.splitext/);
});
