"use strict";

// 运行登记表（run registry）的唯一实现——**一次 run-all 运行只认这一份登记表**：
//   <项目>/Generated/runs/<Target>/run.json
//
// 解决的历史问题：采集产物改成"按页归档"后，消费端（build-bundle-manifest / Bundle）仍在按老约定
// 拼顶层 `Generated/dsl.snapshot.json` 这类路径，而磁盘上恰好还留着上一次运行的旧同名文件——存在性
// 检查通过，于是**静默用了旧数据**。这里的规则是：
//   1) 每步产出后登记（path + sha256 + size + mtime + 所属步骤）；
//   2) 每步消费前只从登记表取路径，并校验 sha256 与登记一致；
//   3) 磁盘上若存在"未登记的旧同名文件"（legacy shadow），直接失败并点名，不允许静默回落。
//
// 该文件是唯一实现：run-registry.mjs（CLI）、build-bundle-manifest.mjs、gen-mastergo-page-bundle.js
// 与 run-all.ps1（经 CLI）都复用这里，不得各写一份。

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SCHEMA_VERSION = "mastergo-run-registry/1";
const REGISTRY_RELATIVE = "Generated/runs";
const FILE_NAME = "run.json";

// 旧布局（按页归档之前）的同名产物路径：登记表之外的这些文件一旦存在，就是"静默用旧数据"的来源。
const LEGACY_SHADOWS = {
  getDsl: "Generated/getDsl.json",
  snapshot: "Generated/dsl.snapshot.json",
  visibility: "Generated/visibility.json",
  extractSvg: "Generated/extractSvg.json",
  coverage: "Generated/coverage-report.json",
  dslManifest: "Generated/manifest.json",
  timing: "Generated/timing.json"
};

// 登记表里的产物键（消费端只用这些键，不拼路径）
const ARTIFACT_KEYS = [
  "getDsl", "snapshot", "coverage", "dslManifest", "timing", "visibility", "extractSvg",
  "mappingDraft", "iconCandidates", "iconMap", "layoutManifest", "bundleManifest"
];

function fail(message) {
  throw new Error("运行登记表: " + message);
}

function toSlash(value) {
  return String(value).replace(/\\/g, "/");
}

function sha256File(absPath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}

function registryFile(projectRoot, target) {
  return path.join(projectRoot, "Generated", "runs", target, FILE_NAME);
}

function projectRelative(projectRoot, absPath) {
  return toSlash(path.relative(projectRoot, absPath));
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail("读取" + (label || filePath) + "失败: " + error.message);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = filePath + ".tmp-" + process.pid;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.renameSync(temp, filePath);
}

function newRunId() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = String(now.getFullYear()) + pad(now.getMonth() + 1) + pad(now.getDate()) +
    "-" + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  return stamp + "-" + crypto.randomBytes(4).toString("hex");
}

// 创建（或保留）登记表。keep=true 用于断点续跑：沿用已有 runId 与已登记产物。
function createRegistry(options) {
  const projectRoot = path.resolve(options.projectRoot);
  if (!options.target) fail("init 需要 --target");
  const file = options.out ? path.resolve(options.out) : registryFile(projectRoot, options.target);
  const keep = options.keep === true;
  let registry = null;
  if (keep) {
    registry = loadRegistry(file);
    // --keep 是续跑同一次设计采集，不是把已有产物重新标成另一张页面。
    // 所有身份检查都先于 saveRegistry；失败时原始登记表必须逐字节不变。
    if (registry.target !== options.target) {
      fail("续跑不能更改 target；请从 fetch 新开运行（不要使用 --keep）");
    }
    if (typeof registry.projectRoot !== "string" || !registry.projectRoot ||
        path.relative(path.resolve(registry.projectRoot), projectRoot) !== "") {
      fail("续跑不能更改 projectRoot；请在原项目续跑，或从 fetch 新开运行");
    }
    if (!registry.identity || typeof registry.identity !== "object" || Array.isArray(registry.identity)) {
      fail("续跑登记表缺少有效 identity；请从 fetch 新开运行");
    }
    for (const field of ["fileId", "layerId", "ui", "designPageName"]) {
      const supplied = options[field];
      if (supplied === undefined || supplied === null || supplied === "") continue;
      if (supplied !== registry.identity[field]) {
        fail("续跑不能更改 identity." + field + "（包括补写未登记的身份）；" +
          "请从 fetch 新开运行（不要使用 --keep）");
      }
    }
  }
  const now = new Date().toISOString();
  if (!registry) {
    registry = {
      schemaVersion: SCHEMA_VERSION,
      runId: options.runId || newRunId(),
      target: options.target,
      projectRoot: projectRoot,
      startedAt: now,
      updatedAt: now,
      identity: {
        fileId: options.fileId || null,
        layerId: options.layerId || null,
        ui: options.ui || null,
        designPageName: options.designPageName || null
      },
      inputs: {},
      artifacts: {},
      outputs: {},
      steps: []
    };
  }
  // 标题、译文、术语与图标命名是可修改的语义输入，不是采集身份。
  if (options.pageTitleText) registry.inputs.pageTitleText = options.pageTitleText;
  if (options.translations) registry.inputs.translations = options.translations;
  if (options.glossary) registry.inputs.glossary = options.glossary;
  if (options.iconNaming) registry.inputs.iconNaming = options.iconNaming;
  if (!Array.isArray(registry.steps)) registry.steps = [];
  saveRegistry(file, registry);
  return { file, registry };
}

function loadRegistry(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) fail("登记表不存在: " + abs + "（请先跑 run-all 的 init/早期步骤）");
  const registry = readJson(abs, "运行登记表");
  if (!registry || typeof registry !== "object" || Array.isArray(registry) ||
      registry.schemaVersion !== SCHEMA_VERSION) {
    fail("登记表 schemaVersion 不是 " + SCHEMA_VERSION + ": " + abs);
  }
  return registry;
}

// A matching digest is not sufficient when the caller requests another page or area.
function assertBinding(registry, options) {
  if (registry.target !== options.target) fail("target 与本次页面不一致: " + options.target);
  if (!registry.identity || registry.identity.ui !== options.ui) {
    fail("identity.ui 与本次 area 不一致: " + options.ui);
  }
  if (typeof registry.projectRoot !== "string" ||
      path.relative(path.resolve(registry.projectRoot), path.resolve(options.projectRoot)) !== "") {
    fail("projectRoot 与本次项目不一致");
  }
}

function saveRegistry(file, registry) {
  registry.updatedAt = new Date().toISOString();
  writeJson(path.resolve(file), registry);
}

// 登记一个产物：path 必须是项目内路径（相对项目根或绝对路径），一律换算成相对路径存档。
function recordArtifact(registry, key, options) {
  if (ARTIFACT_KEYS.indexOf(key) === -1) {
    fail("未知产物键 \"" + key + "\"（可用: " + ARTIFACT_KEYS.join(", ") + "）");
  }
  const projectRoot = path.resolve(options.projectRoot);
  const abs = path.isAbsolute(options.path) ? path.resolve(options.path) : path.resolve(projectRoot, options.path);
  if (!fs.existsSync(abs)) fail("登记产物 " + key + " 时文件不存在: " + abs);
  const stat = fs.statSync(abs);
  const entry = {
    path: projectRelative(projectRoot, abs),
    sha256: sha256File(abs),
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    step: options.step === undefined ? null : Number(options.step)
  };
  registry.artifacts[key] = entry;
  return entry;
}

function artifactEntry(registry, key) {
  const entry = registry.artifacts && registry.artifacts[key];
  if (!entry) {
    fail("登记表里没有产物 \"" + key + "\"：说明本次运行还没产出它（先跑对应步骤，别用磁盘上的同名旧文件）");
  }
  return entry;
}

// 取产物路径并校验：存在 + sha256 与登记一致。
function resolveArtifact(registry, key, options) {
  const projectRoot = path.resolve(options.projectRoot);
  const entry = artifactEntry(registry, key);
  const abs = path.resolve(projectRoot, entry.path);
  if (!fs.existsSync(abs)) {
    fail("登记表里的 " + key + " 指向 " + entry.path + "，但文件不存在（被删除或换了机器？）");
  }
  const actual = sha256File(abs);
  if (actual !== entry.sha256) {
    fail("登记表里的 " + key + " 与磁盘不一致：" + entry.path +
      "\n      登记 sha256 = " + entry.sha256 + "\n      磁盘 sha256 = " + actual +
      "\n      该文件被改写，或来自另一次运行——请重跑产出它的步骤");
  }
  return abs;
}

// 旧布局的同名影子文件探测：登记表之外的旧路径若存在，直接失败（不允许静默用旧数据）。
function assertNoLegacyShadow(registry, key, options) {
  const projectRoot = path.resolve(options.projectRoot);
  const legacyRel = LEGACY_SHADOWS[key];
  if (!legacyRel) return null;
  const legacyAbs = path.resolve(projectRoot, legacyRel);
  if (!fs.existsSync(legacyAbs)) return null;
  const entry = registry.artifacts && registry.artifacts[key];
  if (entry && toSlash(entry.path) === toSlash(legacyRel)) return null; // 登记的就是旧路径（未归档的项目）
  const legacyHash = sha256File(legacyAbs);
  if (entry && legacyHash === entry.sha256) return { path: legacyRel, sameHash: true, sha256: legacyHash };
  fail("发现未登记的旧同名文件 " + legacyRel +
    (entry ? "（本次登记的是 " + entry.path + "）" : "") +
    "\n      按页归档后旧路径不应再被消费；它属于上一次运行，内容与本次不同就无法察觉。" +
    "\n      处理：删除 " + legacyRel + "（或把它移出项目），然后重跑本步骤");
}

function recordStep(registry, step) {
  if (!Array.isArray(registry.steps)) registry.steps = [];
  const entry = {
    id: Number(step.id),
    name: String(step.name || ""),
    status: String(step.status || "ok"),
    seconds: step.seconds === undefined || step.seconds === null ? null : Number(step.seconds),
    note: step.note || "",
    log: step.log || null,
    at: new Date().toISOString()
  };
  const index = registry.steps.findIndex((item) => item.id === entry.id && item.name === entry.name);
  if (index >= 0) registry.steps[index] = entry;
  else registry.steps.push(entry);
  registry.steps.sort((a, b) => a.id - b.id);
  return entry;
}

// 把 Bundle 审计的 files[] 并进登记表的 outputs（输入登记与输出登记用同一份运行身份）。
function recordOutputs(registry, files, options) {
  const projectRoot = path.resolve(options.projectRoot);
  if (!Array.isArray(files)) return 0;
  let count = 0;
  for (const file of files) {
    if (!file || typeof file.path !== "string" || !file.path) continue;
    const abs = path.resolve(projectRoot, file.path);
    const exists = fs.existsSync(abs);
    registry.outputs[file.path] = {
      kind: file.kind || null,
      dependsOn: file.dependsOn || null,
      removed: file.removed === true,
      exists,
      sha256: exists && fs.statSync(abs).isFile() ? sha256File(abs) : null
    };
    count += 1;
  }
  return count;
}

// Only inspect explicitly selected page-local outputs. Shared Layout may be updated by another page.
function resolveOutput(registry, relative, options) {
  const key = toSlash(relative);
  const entry = registry.outputs && registry.outputs[key];
  if (!entry || entry.removed || !entry.sha256) fail("未登记有效输出: " + key);
  const file = path.resolve(options.projectRoot, key);
  if (!fs.existsSync(file) || sha256File(file) !== entry.sha256) fail("输出与本次登记不一致: " + key);
  return file;
}

function summarize(registry) {
  const artifacts = Object.keys(registry.artifacts || {});
  const outputs = Object.keys(registry.outputs || {});
  const failed = (registry.steps || []).filter((step) => step.status !== "ok");
  return {
    runId: registry.runId,
    target: registry.target,
    fileId: registry.identity && registry.identity.fileId,
    layerId: registry.identity && registry.identity.layerId,
    ui: registry.identity && registry.identity.ui,
    artifactCount: artifacts.length,
    artifacts,
    outputCount: outputs.length,
    stepCount: (registry.steps || []).length,
    failedSteps: failed.map((step) => step.id + ":" + step.name + ":" + step.status)
  };
}

module.exports = {
  SCHEMA_VERSION,
  REGISTRY_RELATIVE,
  FILE_NAME,
  ARTIFACT_KEYS,
  LEGACY_SHADOWS,
  registryFile,
  projectRelative,
  sha256File,
  createRegistry,
  loadRegistry,
  saveRegistry,
  assertBinding,
  recordArtifact,
  resolveArtifact,
  resolveOutput,
  assertNoLegacyShadow,
  recordStep,
  recordOutputs,
  summarize
};
