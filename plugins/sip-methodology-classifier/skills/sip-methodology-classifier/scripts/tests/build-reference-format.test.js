"use strict";

/*
 * 同格式输出：文件名中的 Excel 非法字符必须先清洗，再写成 Sheet 名。
 */

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const skillRoot = path.resolve(__dirname, "..", "..");
const scriptsDir = path.join(skillRoot, "scripts");
const python = process.platform === "win32" ? "python" : "python3";

function runPython(code, args = []) {
  const result = spawnSync(python, ["-I", "-c", code, ...args], {
    cwd: scriptsDir,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test("源文件名含 Excel 非法字符时先清洗再创建 Sheet", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sip-sheet-name-"));
  const inputDir = path.join(root, "input");
  const source = path.join(inputDir, "MX[SLG]1.xlsx");
  const output = path.join(root, "output.xlsx");
  fs.mkdirSync(inputDir);
  try {
    runPython([
      "import sys",
      "from openpyxl import Workbook",
      "wb = Workbook()",
      "ws = wb.active",
      "ws.append(['序号', '检验工序', '检验项目'])",
      "ws.append([1, '通电检验', '功能检查'])",
      "wb.save(sys.argv[1])"
    ].join("\n"), [source]);

    const built = spawnSync(
      python,
      ["-I", path.join(scriptsDir, "build_reference_format.py"), "--input", inputDir, "--output", output],
      {
        cwd: scriptsDir,
        encoding: "utf8",
        windowsHide: true
      }
    );
    assert.equal(built.status, 0, built.stderr || built.stdout);

    const names = JSON.parse(runPython([
      "import json, sys",
      "from openpyxl import load_workbook",
      "print(json.dumps(load_workbook(sys.argv[1], read_only=True).sheetnames, ensure_ascii=False))"
    ].join("\n"), [output]));
    assert.deepEqual(names, ["MX_SLG_1"]);
  }
  finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
