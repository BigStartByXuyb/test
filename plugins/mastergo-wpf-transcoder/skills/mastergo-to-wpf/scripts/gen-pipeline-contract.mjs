#!/usr/bin/env node
// gen-pipeline-contract.mjs —— 由 run-all.ps1 的步骤定义生成「一键流水线」契约文档。
//
// 为什么要有这个脚本：步骤契约（输入 / 产物 / 失败 / 怎么修）原本写在 SKILL.md 与参考文档里，
// 与 run-all.ps1 的实际行为各写一份，改一处就会漂移。现在真值源只有一个 —— run-all.ps1 的 `$Steps`
// （经 `-List -Format json` 暴露），本脚本把它渲染成 references/adapters/mtslg-iocontrol/pipeline-contract.md，
// 回归测试用 `--check` 重新生成并比对，文档不再是手写自由发挥的产物。
//
// 用法：
//   node gen-pipeline-contract.mjs                 # 写入默认输出路径
//   node gen-pipeline-contract.mjs --out <file>    # 写入指定路径
//   node gen-pipeline-contract.mjs --check         # 只校验已提交文档是否与脚本一致（不一致退出码 1）
//   node gen-pipeline-contract.mjs --print         # 打印渲染结果（不落盘）
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, "..");
const RUN_ALL = path.join(HERE, "run-all.ps1");
const DEFAULT_OUT = path.join(SKILL_ROOT, "references", "adapters", "mtslg-iocontrol", "pipeline-contract.md");

function parseArgs(argv) {
  const args = { check: false, print: false, out: DEFAULT_OUT };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--check") { args.check = true; continue; }
    if (token === "--print") { args.print = true; continue; }
    if (token === "--out") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--out 缺少取值");
      args.out = path.resolve(value);
      index += 1;
      continue;
    }
    throw new Error("未知参数: " + token);
  }
  return args;
}

// 步骤契约的唯一来源：跑脚本自己暴露的 JSON，而不是在这里再抄一份步骤表。
function readSteps() {
  const stdout = execFileSync(
    process.platform === "win32" ? "pwsh" : "pwsh",
    ["-NoProfile", "-File", RUN_ALL, "-List", "-Format", "json"],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
  );
  const steps = JSON.parse(stdout.replace(/^\uFEFF/, ""));
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("run-all.ps1 -List -Format json 没有返回步骤数组");
  }
  for (const step of steps) {
    for (const field of ["Id", "Name", "Title", "Inputs", "Outputs", "Failures", "Recovery"]) {
      if (step[field] === undefined || step[field] === null) {
        throw new Error(`步骤 ${step.Name || step.Id} 缺少契约字段 ${field}`);
      }
    }
    for (const field of ["Inputs", "Outputs", "Failures", "Recovery"]) {
      if (!Array.isArray(step[field]) || step[field].length === 0) {
        throw new Error(`步骤 ${step.Name} 的 ${field} 必须是非空数组`);
      }
    }
  }
  return steps;
}

function render(steps) {
  const lines = [];
  lines.push("# 一键流水线步骤契约（生成物，勿手改）");
  lines.push("");
  lines.push("本文件由 `scripts/gen-pipeline-contract.mjs` 从 `scripts/run-all.ps1` 的步骤定义生成；");
  lines.push("**真值源是脚本，不是本文件**——要改契约就改 `run-all.ps1` 的 `$Steps`，然后重新生成本文件");
  lines.push("（`node scripts/gen-pipeline-contract.mjs`）。回归测试用 `--check` 重新生成并比对，手改本文件会直接挂测试。");
  lines.push("");
  lines.push("## 怎么跑");
  lines.push("");
  lines.push("**一条命令跑完全部 12 步**，不需要逐个手工调用，也不要为每一步单独起一次 `run-all`：");
  lines.push("");
  lines.push("```powershell");
  lines.push("pwsh -NoProfile -File <skill>\\scripts\\run-all.ps1 -ProjectRoot <项目> -Target <Target> -Overwrite");
  lines.push("```");
  lines.push("");
  lines.push("默认区间是第 1 步 → 第 12 步。下面的 12 个阶段用于**定位失败**与**断点续跑**：失败后从该步继续 `-Progress <步骤名>`；需要人工补语义输入时先跑到 `-StopAfter discover`。");
  lines.push("");
  lines.push("## 步骤总览（同一条命令内部的阶段）");
  lines.push("");
  lines.push("| 步骤 | 名称 | 内容 |");
  lines.push("|---|---|---|");
  for (const step of steps) {
    lines.push(`| ${step.Id} | \`${step.Name}\` | ${step.Title} |`);
  }
  lines.push("");
  lines.push("## 每一步的输入 / 产物 / 失败 / 怎么修");
  lines.push("");
  for (const step of steps) {
    lines.push(`### ${step.Id}. \`${step.Name}\` —— ${step.Title}`);
    lines.push("");
    for (const [label, field] of [["输入", "Inputs"], ["产物", "Outputs"], ["失败语义", "Failures"], ["怎么修", "Recovery"]]) {
      lines.push(`- **${label}**：`);
      for (const item of step[field]) lines.push(`  - ${item}`);
    }
    lines.push("");
  }
  lines.push("## 运行方式");
  lines.push("");
  lines.push("```powershell");
  lines.push("pwsh -NoProfile -File <skill>\\scripts\\run-all.ps1 -ProjectRoot <项目> -Target <Target> -Overwrite   # 一次跑完 12 步");
  lines.push("pwsh -NoProfile -File <skill>\\scripts\\run-all.ps1 -ProjectRoot <项目> -Progress <步骤名>            # 失败后从该步继续");
  lines.push("pwsh -NoProfile -File <skill>\\scripts\\run-all.ps1 -List -Format json                             # 本文件的机器可读来源");
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

const args = parseArgs(process.argv.slice(2));
const steps = readSteps();
const content = render(steps);

if (args.print) {
  process.stdout.write(content);
  process.exit(0);
}

const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/\s+$/, "");

if (args.check) {
  if (!fs.existsSync(args.out)) {
    console.error("缺少契约文档: " + args.out + "（跑 node scripts/gen-pipeline-contract.mjs 生成）");
    process.exit(1);
  }
  const current = normalize(fs.readFileSync(args.out, "utf8"));
  if (current !== normalize(content)) {
    console.error("契约文档与 run-all.ps1 的步骤定义不一致: " + args.out +
      "\n请重新生成：node scripts/gen-pipeline-contract.mjs");
    process.exit(1);
  }
  console.log("PASS 流水线契约文档与 run-all.ps1 步骤定义一致");
  process.exit(0);
}

fs.mkdirSync(path.dirname(args.out), { recursive: true });
fs.writeFileSync(args.out, content, "utf8");
console.log("已生成 " + args.out + "（步骤 " + steps.length + " 个）");
