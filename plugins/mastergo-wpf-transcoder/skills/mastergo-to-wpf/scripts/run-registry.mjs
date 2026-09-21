// 运行登记表 CLI —— 唯一实现对在 scripts/lib/run-registry.js（本文件只做参数解析与输出）。
//
// 用法:
//   node run-registry.mjs init --project-root <项目> --target <Target>
//        [--file-id <id>] [--layer-id <id>] [--ui <F2>] [--design-page <设计页名>]
//        [--page-title <标题>] [--translations <相对路径>] [--glossary <相对路径>]
//        [--icon-naming <相对路径>] [--out <run.json>] [--keep]
//   node run-registry.mjs artifact --run <run.json> --key <键> --path <相对|绝对> [--step <N>]
//   node run-registry.mjs step     --run <run.json> --id <N> --name <名字> --status ok|failed
//        [--seconds <秒>] [--note <说明>] [--log <相对路径>]
//   node run-registry.mjs path     --run <run.json> --key <键>
//   node run-registry.mjs check    --run <run.json> [--key <键>] [--quiet]
//   node run-registry.mjs outputs  --run <run.json> --manifest <bundle.manifest.json>
//   node run-registry.mjs check-output --run <run.json> --path <项目相对路径>
//   node run-registry.mjs show     --run <run.json>
//
// 约定：登记表里的路径一律是"相对项目根"；本 CLI 打印的 path 是绝对路径（供 shell 直接使用）。

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const registry = require("./lib/run-registry.js");

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) { out._.push(token); continue; }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) { out[key] = true; continue; }
    i += 1;
    out[key] = value;
  }
  return out;
}

function usage() {
  console.error("用法见 run-registry.mjs 头部注释（init / artifact / step / path / check / check-output / outputs / show）");
  process.exit(2);
}

function loadRun(args) {
  if (!args.run || args.run === true) throw new Error("缺少 --run <run.json>");
  const file = path.resolve(String(args.run));
  const data = registry.loadRegistry(file);
  const projectRoot = args["project-root"] && args["project-root"] !== true
    ? path.resolve(String(args["project-root"]))
    : path.resolve(data.projectRoot || path.dirname(path.dirname(path.dirname(path.dirname(file)))));
  return { file, data, projectRoot };
}

function readInputFile(projectRoot, value, label) {
  if (!value || value === true) return null;
  const abs = path.isAbsolute(value) ? path.resolve(value) : path.resolve(projectRoot, value);
  if (!fs.existsSync(abs)) throw new Error(label + " 文件不存在: " + abs);
  const stat = fs.statSync(abs);
  return { path: registry.projectRelative(projectRoot, abs), sha256: registry.sha256File(abs), size: stat.size };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (!command) usage();

  if (command === "init") {
    if (!args["project-root"] || args["project-root"] === true) throw new Error("init 需要 --project-root");
    if (!args.target || args.target === true) throw new Error("init 需要 --target");
    const projectRoot = path.resolve(String(args["project-root"]));
    const translations = readInputFile(projectRoot, args.translations, "译文清单");
    const glossary = readInputFile(projectRoot, args.glossary, "术语表");
    const iconNaming = readInputFile(projectRoot, args["icon-naming"], "图标命名表");
    const { file, registry: data } = registry.createRegistry({
      projectRoot,
      target: String(args.target),
      fileId: args["file-id"] && args["file-id"] !== true ? String(args["file-id"]) : null,
      layerId: args["layer-id"] && args["layer-id"] !== true ? String(args["layer-id"]) : null,
      ui: args.ui && args.ui !== true ? String(args.ui) : null,
      designPageName: args["design-page"] && args["design-page"] !== true ? String(args["design-page"]) : null,
      pageTitleText: args["page-title"] && args["page-title"] !== true ? String(args["page-title"]) : null,
      translations,
      glossary,
      iconNaming,
      out: args.out && args.out !== true ? String(args.out) : null,
      keep: args.keep === true
    });
    console.log(JSON.stringify({ file, runId: data.runId, keep: args.keep === true }, null, 2));
    return;
  }

  const { file, data, projectRoot } = loadRun(args);

  if (command === "artifact") {
    if (!args.key || args.key === true) throw new Error("artifact 需要 --key");
    if (!args.path || args.path === true) throw new Error("artifact 需要 --path");
    const entry = registry.recordArtifact(data, String(args.key), {
      projectRoot,
      path: String(args.path),
      step: args.step && args.step !== true ? args.step : null
    });
    registry.saveRegistry(file, data);
    console.log(JSON.stringify({ key: String(args.key), ...entry }, null, 2));
    return;
  }

  if (command === "step") {
    const entry = registry.recordStep(data, {
      id: args.id,
      name: args.name,
      status: args.status || "ok",
      seconds: args.seconds && args.seconds !== true ? args.seconds : null,
      note: args.note && args.note !== true ? String(args.note) : "",
      log: args.log && args.log !== true ? String(args.log) : null
    });
    registry.saveRegistry(file, data);
    console.log(JSON.stringify(entry, null, 2));
    return;
  }

  if (command === "path") {
    if (!args.key || args.key === true) throw new Error("path 需要 --key");
    const abs = registry.resolveArtifact(data, String(args.key), { projectRoot });
    const shadow = registry.assertNoLegacyShadow(data, String(args.key), { projectRoot });
    if (shadow) console.error("提示: 旧布局文件 " + shadow.path + " 仍存在，但内容与本次登记一致（可以清理）");
    console.log(abs);
    return;
  }

  if (command === "check-output") {
    if (typeof args.path !== "string" || !args.path) throw new Error("check-output 需要 --path");
    registry.resolveOutput(data, args.path, { projectRoot });
    return;
  }

  if (command === "check") {
    const explicitKey = args.key !== undefined;
    if (explicitKey && (typeof args.key !== "string" || !registry.ARTIFACT_KEYS.includes(args.key))) {
      throw new Error("check 需要有效的 --key <产物键>（收到: " + String(args.key) + "）");
    }
    // 无 --key 时检查已登记的子集，允许流水线尚未完成；显式点名的产物不得静默跳过。
    const keys = explicitKey ? [args.key] : registry.ARTIFACT_KEYS.filter(
      (key) => data.artifacts && data.artifacts[key]
    );
    const checked = [];
    const shadows = [];
    for (const key of keys) {
      registry.resolveArtifact(data, key, { projectRoot });
      const shadow = registry.assertNoLegacyShadow(data, key, { projectRoot });
      if (shadow) shadows.push(shadow.path);
      checked.push(key);
    }
    if (args.quiet !== true) {
      console.log(JSON.stringify({ checked, shadows, summary: registry.summarize(data) }, null, 2));
    }
    return;
  }

  if (command === "outputs") {
    if (!args.manifest || args.manifest === true) throw new Error("outputs 需要 --manifest <bundle.manifest.json>");
    const manifestPath = path.isAbsolute(String(args.manifest))
      ? path.resolve(String(args.manifest))
      : path.resolve(projectRoot, String(args.manifest));
    if (!fs.existsSync(manifestPath)) throw new Error("Bundle 审计不存在: " + manifestPath);
    const audit = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const count = registry.recordOutputs(data, audit.files, { projectRoot });
    registry.saveRegistry(file, data);
    console.log(JSON.stringify({ outputs: count, manifest: registry.projectRelative(projectRoot, manifestPath) }, null, 2));
    return;
  }

  if (command === "show") {
    console.log(JSON.stringify(registry.summarize(data), null, 2));
    return;
  }

  usage();
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
