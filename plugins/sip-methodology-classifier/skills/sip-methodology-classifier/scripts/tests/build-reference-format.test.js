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

test("固定 Sheet 名与 Excel 大小写重名口径共用", () => {
  const result = JSON.parse(runPython([
    "import json, os, sys",
    "sys.path.insert(0, os.getcwd())",
    "from sip_sheet_name import RESERVED_SHEET_NAMES, safe_name",
    "used = set(RESERVED_SHEET_NAMES)",
    "names = [safe_name(RESERVED_SHEET_NAMES[0], used, fallback='项目'), safe_name(RESERVED_SHEET_NAMES[1], used, fallback='项目'), safe_name('ABC', {'abc'})]",
    "print(json.dumps({'reserved': names[:2] == [name + '_2' for name in RESERVED_SHEET_NAMES], 'case': names[2]}))"
  ].join("\n")));
  assert.deepEqual(result, { reserved: true, case: "ABC_2" });
});

test("Sheet 名清洗在两个生成器中共用同一实现", () => {
  const reference = fs.readFileSync(path.join(scriptsDir, "build_reference_format.py"), "utf8");
  const analysis = fs.readFileSync(path.join(scriptsDir, "build_sip_mapping.py"), "utf8");
  assert.match(reference, /title = safe_name\(os\.path\.splitext\(os\.path\.basename\(path\)\)\[0\], used\)\s*wb, unclassified = transform_source\(path, row_map, title\)/);
  assert.doesNotMatch(reference, /ws\.title = os\.path\.splitext/);
  assert.match(reference, /from sip_sheet_name import safe_name/);
  assert.match(reference, /used = set\(\)/);
  assert.match(analysis, /from sip_sheet_name import \(EXPLANATION_SHEET, PENDING_SHEET,/);
  assert.match(analysis, /safe_name\(pname, used, fallback='项目'\)/);
  assert.match(analysis, /used = set\(RESERVED_SHEET_NAMES\)/);
  assert.doesNotMatch(analysis, /def safe_sheet_name/);
  const verify = fs.readFileSync(path.join(scriptsDir, "sip_verify.py"), "utf8");
  assert.doesNotMatch(verify, /ws\.title in \(EXPLANATION_SHEET, PENDING_SHEET\)/);
  assert.doesNotMatch(verify, /startswith\('待确认'\)/);
  assert.match(verify, /if '主顺序' in vals and '子顺序' in vals and \(/);
  assert.match(verify, /'序号' in vals or '原序号' in vals/);
  assert.match(reference, /last_data_row = 1/);
  assert.match(reference, /if seqv is not None and str\(seqv\)\.strip\(\):/);
  assert.doesNotMatch(reference, /last_seq_row/);
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
    "sip_rules_trunk.py"
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(scriptsDir, file), "utf8");
    assert.match(source, /from sip_seq import parse_seq/);
    assert.doesNotMatch(source, /def parse_seq\(/);
  }
  const reference = fs.readFileSync(path.join(scriptsDir, "build_reference_format.py"), "utf8");
  assert.doesNotMatch(reference, /from sip_seq import parse_seq/);
});

test("黄色判定先于序号解析，黄行与未解析行分别计数", () => {
  const source = fs.readFileSync(path.join(scriptsDir, "sip_source.py"), "utf8");
  assert.ok(source.indexOf("yellow = is_yellow(seq_cell)") < source.indexOf("seq = parse_seq(seq_cell.value)"));
  assert.match(source, /if yellow:[\s\S]*skipped\['yellow'\] \+= 1[\s\S]*if seq is None:[\s\S]*skipped\['invalid'\] \+= 1/);
});

test("默认同格式输出排除四个标黄业务列，M/N 紧跟剩余列", () => {
  const result = JSON.parse(runPython([
    "import json, os, sys, tempfile",
    "sys.path.insert(0, os.getcwd())",
    "from openpyxl import Workbook, load_workbook",
    "from openpyxl.styles import PatternFill",
    "from build_reference_format import transform_source",
    "with tempfile.TemporaryDirectory() as d:",
    "    src = os.path.join(d, 'source.xlsx')",
    "    out = os.path.join(d, 'output.xlsx')",
    "    wb = Workbook()",
    "    ws = wb.active",
    "    ws.append(['文件编号：A', '版本：V1'])",
    "    ws.append(['序号', '检验工序', '检验项目', '检验标准', '检验频率', '重要等级', '检验记录表', '备注', '检验方法', '检验工具'])",
    "    ws.append([1, '工序A', '项目A', '标准A', '每批', 'A', '记录A', '备注A', '方法A', '工具A'])",
    "    yellow = PatternFill(fill_type='solid', start_color='FFFFFF00', end_color='FFFFFF00')",
    "    for cell in (ws['A1'], ws['B1'], *ws[2][4:8]):",
    "        cell.fill = yellow",
    "    wb.save(src)",
    "    output, unclassified = transform_source(src, {2: ('2. 外观检验', '1级')}, 'Demo')",
    "    output.save(out)",
    "    check = load_workbook(out).worksheets[0]",
    "    headers = [check.cell(1, c).value for c in range(1, check.max_column + 1)]",
    "    values = [check.cell(2, c).value for c in range(1, check.max_column + 1)]",
    "    print(json.dumps({'headers': headers, 'values': values, 'unclassified': unclassified}, ensure_ascii=False))"
  ].join("\n")));
  assert.deepEqual(result, {
    headers: ["序号", "检验工序", "检验项目", "检验标准", "检验方法", "检验工具", "主顺序", "子顺序（1级优先进行，12级最后进行）"],
    values: [1, "工序A", "项目A", "标准A", "方法A", "工具A", "2. 外观检验", "1级"],
    unclassified: []
  });
});
