"use strict";

/*
 * SIP 规则调度：BOM 关键词、分支优先级与主干行级规则的边界。
 * 用例直接执行 Python 调度器，文档与实现同源变化时在这里失败。
 */

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const skillRoot = path.resolve(__dirname, "..", "..");
const scriptsDir = path.join(skillRoot, "scripts");
const python = process.platform === "win32" ? "python" : "python3";

function classify(cases) {
  const code = [
    "import json, os, sys",
    "sys.path.insert(0, os.getcwd())",
    "from sip_rules import classify",
    "cases = json.loads(sys.stdin.buffer.read().decode('utf-8'))",
    "out = {}",
    "for case in cases:",
    "  result, reason = classify(case['stage'], case.get('item', ''), case.get('sub', ''), case.get('std', ''), case.get('method', ''), family=case.get('family', 'trunk'))",
    "  out[case['key']] = {'result': list(result), 'reason': reason}",
    "sys.stdout.buffer.write(json.dumps(out, ensure_ascii=False).encode('utf-8'))",
  ].join("\n");
  const result = spawnSync(python, ["-I", "-c", code], {
    cwd: scriptsDir,
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    input: JSON.stringify(cases),
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("BOM 外观关键词在说明与实现中一致", () => {
  const skill = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
  assert.match(skill, /外观\/安装\/完好\/牢固\/无损伤 → 外观 1 级/);

  const actual = classify([
    { key: "installed", stage: "UPS电源", std: "安装牢固" },
    { key: "intact", stage: "UPS电源", std: "包装完好无损伤" },
    { key: "normal", stage: "UPS电源", std: "运行正常" }
  ]);
  assert.deepEqual(actual.installed.result, ["2. 外观检验", "1级"]);
  assert.deepEqual(actual.intact.result, ["2. 外观检验", "1级"]);
  assert.deepEqual(actual.normal.result, ["3. 通电检验", "5级"]);
  assert.equal(actual.normal.reason, "主干规则");
});

test("分支阶段、前缀和关键字规则都由调度器单次命中", () => {
  const actual = classify([
    { key: "stage", stage: "随机拆解的配件核对", family: "slg" },
    { key: "prefix", stage: "夹料机械手99(试制)", family: "slg" },
    { key: "keyword", stage: "激光器温控", family: "slg" }
  ]);
  assert.deepEqual(actual.stage, { result: ["1. 铭牌核对", "2级"], reason: "分支规则" });
  assert.deepEqual(actual.prefix, { result: ["3. 通电检验", "5级"], reason: "分支规则" });
  assert.deepEqual(actual.keyword, { result: ["3. 通电检验", "5级"], reason: "分支规则" });
});

test("SLG 风扇关键字不覆盖主干离子风扇行级规则", () => {
  const actual = classify([
    { key: "install", stage: "离子风扇", family: "slg", std: "安装位置正确" },
    { key: "function", stage: "离子风扇", family: "slg", std: "运行正常" },
    { key: "bom", stage: "风扇", family: "slg", std: "2 pcs" }
  ]);
  assert.deepEqual(actual.install, { result: ["2. 外观检验", "1级"], reason: "主干规则" });
  assert.deepEqual(actual.function, { result: ["3. 通电检验", "9级"], reason: "主干规则" });
  assert.deepEqual(actual.bom, { result: ["1. 铭牌核对", "2级"], reason: "分支规则" });
});

test("设备族分支不复制主干同值规则", () => {
  const code = [
    "import json, os, sys",
    "sys.path.insert(0, os.getcwd())",
    "from sip_rules_trunk import STAGE_RULES as trunk",
    "out = {}",
    "for family in ('sdc', 'exp', 'slg'):",
    "  mod = __import__('sip_family_' + family)",
    "  out[family] = {",
    "    'stage': sorted(k for k, v in getattr(mod, 'STAGE_RULES', {}).items() if trunk.get(k) == v),",
    "    'prefix': sorted(p for p, main, sub in getattr(mod, 'STAGE_PREFIX_RULES', []) if trunk.get(p) == (main, sub)),",
    "    'exact': sorted(k for k, v in getattr(mod, 'EXACT', {}).items() if trunk.get(k) == v)",
    "  }",
    "print(json.dumps(out, ensure_ascii=False))"
  ].join("\n");
  const result = spawnSync(python, ["-I", "-c", code], {
    cwd: scriptsDir,
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    sdc: { stage: [], prefix: [], exact: [] },
    exp: { stage: [], prefix: [], exact: [] },
    slg: { stage: [], prefix: [], exact: [] }
  });
});

test("设备族分支的精确规则不与前缀规则重复", () => {
  const code = [
    "import json, os, sys",
    "sys.path.insert(0, os.getcwd())",
    "out = {}",
    "for family in ('sdc', 'exp', 'slg'):",
    "  mod = __import__('sip_family_' + family)",
    "  stage = set(getattr(mod, 'STAGE_RULES', {}))",
    "  prefix = {p for p, main, sub in getattr(mod, 'STAGE_PREFIX_RULES', [])}",
    "  out[family] = sorted(stage & prefix)",
    "print(json.dumps(out, ensure_ascii=False))"
  ].join("\n");
  const result = spawnSync(python, ["-I", "-c", code], {
    cwd: scriptsDir,
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { sdc: [], exp: [], slg: [] });
});

test("SLG 的通用工序回到主干规则兜底", () => {
  const actual = classify([
    { key: "row", stage: "流量及压力表头设定默认值", family: "slg" },
    { key: "vision", stage: "视觉对位及标定", family: "slg" },
    { key: "arm", stage: "搬运手臂", family: "slg" },
    { key: "air", stage: "空气过滤组合", family: "slg" },
    { key: "slg-vision", stage: "视觉对位及标定(第六工位)", family: "slg" }
  ]);
  assert.equal(actual.row.reason, "主干规则");
  assert.equal(actual.vision.reason, "主干规则");
  assert.equal(actual.arm.reason, "主干规则");
  assert.equal(actual.air.reason, "主干规则");
  assert.equal(actual["slg-vision"].reason, "分支规则");
});

test("合并优先级文档不再声明不存在的主干前缀规则层", () => {
  const orderModel = fs.readFileSync(path.join(skillRoot, "reference", "order-model.md"), "utf8");
  assert.doesNotMatch(orderModel, /主干前缀\s*\/\s*BOM\s*\/\s*关键字/);
});
