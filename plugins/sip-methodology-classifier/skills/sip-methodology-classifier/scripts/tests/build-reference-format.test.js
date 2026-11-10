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
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
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

test("Sheet 名空值默认值可由调用方显式指定", () => {
  const result = JSON.parse(runPython([
    "import json, os, sys",
    "sys.path.insert(0, os.getcwd())",
    "from sip_sheet_name import safe_name",
    "print(json.dumps([safe_name('', set(), fallback='\\u9879\\u76ee')]))"
  ].join("\n")));
  assert.deepEqual(result, ["项目"]);
});

test("Sheet 名清洗在两个生成器中共用同一实现", () => {
  const reference = fs.readFileSync(path.join(scriptsDir, "build_reference_format.py"), "utf8");
  const analysis = fs.readFileSync(path.join(scriptsDir, "build_sip_mapping.py"), "utf8");
  assert.match(reference, /title = safe_name\(os\.path\.splitext\(os\.path\.basename\(path\)\)\[0\], used\)\s*wb, unclassified = transform_source\(path, row_map, title\)/);
  assert.doesNotMatch(reference, /ws\.title = os\.path\.splitext/);
  assert.match(analysis, /from sip_sheet_name import safe_name/);
  assert.match(analysis, /safe_name\(pname, used, fallback='项目'\)/);
  assert.doesNotMatch(analysis, /def safe_sheet_name/);
});

test("序号判定只接受整数数值或纯数字文本", () => {
  const result = JSON.parse(runPython([
    "import json, os, sys",
    "sys.path.insert(0, os.getcwd())",
    "from sip_seq import parse_seq",
    "values = [1, 1.0, ' 2 ', '2.5', -1, '', True, None]",
    "print(json.dumps([parse_seq(v) for v in values]))"
  ].join("\n")));
  assert.deepEqual(result, [1, 1, 2, null, null, null, null, null]);
});

test("序号判定在生产脚本中只来自共享模块", () => {
  const files = [
    "sip_source.py",
    "sip_verify.py",
    "sip_rules_trunk.py",
    "build_reference_format.py"
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(scriptsDir, file), "utf8");
    assert.match(source, /from sip_seq import parse_seq/);
    assert.doesNotMatch(source, /def parse_seq\(/);
  }
});
