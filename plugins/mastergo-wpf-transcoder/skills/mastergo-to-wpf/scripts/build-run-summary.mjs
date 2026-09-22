// 本次运行的「本页现状」摘要 —— 替代模型每次手写探针去数一遍产物。
//
// 纪律（与 bundle-manifest.md 第 7 节「消费只按登记取」同一条契约）：
//   1. 只从 run.json 里登记的产物取数，绝不扫目录——目录里可能留着上一次运行的旧同名文件；
//   2. 每个登记产物都复校 sha256，对不上就失败，不降级、不警告了事；
//   3. 产物"不存在"分两种，必须靠登记表判定，不靠猜：
//        · 登记表在 outputs 里记了 removed=true / exists=false → 后续步骤正常清理的中间产物，记入 consumed；
//        · 没有这条记录 → 登记表与磁盘漂移，立即失败。
//   4. 摘要自身写回 projectRoot 并登记进 outputs，于是它也被同一套校验覆盖。
//
// 用法:
//   node build-run-summary.mjs --project-root <项目> --target <Target> [--quiet]
//
// 产出: <项目>/Generated/<Target>.summary.json
// stdout: 一行紧凑 JSON（只含计数与待办，不进整份产物）

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const registry = require("./lib/run-registry.js");

const SCHEMA_VERSION = "mastergo-run-summary/1";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) out[key] = true;
    else { out[key] = value; i += 1; }
  }
  return out;
}

function readJson(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function makeReaders(registryData, projectRoot, report) {
  const options = { projectRoot };
  const outputs = registryData.outputs || {};

  // 登记产物：sha256 必须一致；不存在时必须能从 outputs 证明是"被后续步骤清理"。
  function artifact(key) {
    const entry = registryData.artifacts && registryData.artifacts[key];
    if (!entry) {
      report.unavailable.push({ key, reason: "本次运行尚未登记该产物（对应步骤还没跑到）" });
      return null;
    }
    const abs = path.resolve(projectRoot, entry.path);
    if (!fs.existsSync(abs)) {
      const record = outputs[entry.path];
      if (record && record.exists === false && record.removed === true) {
        report.consumed.push({ key, path: entry.path, reason: "后续步骤已清理的中间产物（登记表已记录 removed=true）" });
        return null;
      }
      throw new Error("登记产物 " + key + " 指向 " + entry.path +
        "，但文件不存在，且登记表没有记录它被清理——登记表与磁盘已漂移，先跑产出它的那一步");
    }
    return { path: entry.path, value: readJson(registry.resolveArtifact(registryData, key, options)) };
  }

  // 页面局部产出：只认 outputs 里登记过、且 exists/sha256 都对得上的。
  function output(rel) {
    const slashed = rel.replace(/\\/g, "/");
    const record = outputs[slashed];
    if (!record || record.exists !== true || !record.sha256) return null;
    const abs = path.resolve(projectRoot, slashed);
    if (registry.sha256File(abs) !== record.sha256) {
      throw new Error("产出 " + slashed + " 与登记不一致（被改写或来自另一次运行）");
    }
    return { path: slashed, value: readJson(abs) };
  }

  return { artifact, output };
}

function count(value) {
  return Array.isArray(value) ? value.length : value === undefined || value === null ? 0 : 1;
}

function histogram(items, pick) {
  const out = {};
  for (const item of items || []) {
    const key = pick(item);
    if (key === undefined || key === null || key === "") continue;
    out[key] = (out[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))));
}

// 共享壳由多个页面共同更新，不属于本页；分开报，避免把别页的改动算进本页。
const SHARED_SHELL = [/^Resources\/Layout\//, /^[^/]+\.csproj$/, /^framework\.config\.json$/];

function classifyOutput(rel) {
  const slashed = String(rel).replace(/\\/g, "/");
  return SHARED_SHELL.some((re) => re.test(slashed)) ? "sharedShell" : "pageLocal";
}

// 产物层读数：只从 outputs 里登记并校验过的文件里数，作为"映射层"之外的一层事实。
// 同一个概念在两层落地时数量可以不同（例如底部栏常驻分组的图标由框架处理、不落页面字典），
// 所以两层都要报，且必须标明各自来源，避免消费方拿一层的数字去核另一层的产物。
function readOutputText(registryData, projectRoot, rel) {
  const record = (registryData.outputs || {})[rel];
  if (!record || record.exists !== true || !record.sha256) return null;
  const abs = path.resolve(projectRoot, rel);
  if (!fs.existsSync(abs)) return null;
  const text = fs.readFileSync(abs, "utf8");
  if (registry.sha256File(abs) !== record.sha256) {
    throw new Error("产出 " + rel + " 与登记不一致（被改写或来自另一次运行）");
  }
  return text;
}

function matchAll(text, re) {
  const out = [];
  if (!text) return out;
  for (const match of text.matchAll(re)) out.push(match[1]);
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(String(args["project-root"] || process.cwd()));
  const target = args.target ? String(args.target) : null;
  if (!target) throw new Error("需要 --target");

  const runFile = path.resolve(registry.registryFile(projectRoot, target));
  const registryData = registry.loadRegistry(runFile);
  if (registryData.target !== target) {
    throw new Error("登记表 target=" + registryData.target + " 与请求的 " + target + " 不一致");
  }

  const report = { unavailable: [], consumed: [] };
  const options = { projectRoot };
  const sources = {};
  const { artifact, output } = makeReaders(registryData, projectRoot, report);
  const take = (name, entry, step) => {
    if (entry) sources[name] = { path: entry.path, step: step === undefined ? null : step };
    return entry ? entry.value : null;
  };
  const stepOf = (key) => (registryData.artifacts[key] ? registryData.artifacts[key].step : null);

  const coverage = take("coverage", artifact("coverage"), stepOf("coverage"));
  const candidates = take("iconCandidates", artifact("iconCandidates"), stepOf("iconCandidates"));
  const ledger = take("iconMap", artifact("iconMap"), stepOf("iconMap"));
  const layout = take("layoutManifest", artifact("layoutManifest"), stepOf("layoutManifest"));
  const bundle = take("bundleManifest", artifact("bundleManifest"), stepOf("bundleManifest"));
  const svgs = take("extractSvg", artifact("extractSvg"), stepOf("extractSvg"));
  // mapping：草稿还在就用草稿（run 中途也能工作）；草稿已被 bundle 清理就取产物化的 Generated/<Target>.mapping.json。
  let mapping = take("mappingDraft", artifact("mappingDraft"), stepOf("mappingDraft"));
  if (!mapping) {
    const finalMapping = output("Generated/" + target + ".mapping.json");
    mapping = take("mapping", finalMapping, null);
  }
  const unavailable = report.unavailable;

  // 图标候选：icon-candidates.json 里 candidates 与 unmapped 是重叠视图，且同一条会重复出现，
  // 直接取数组长度会得到虚高的数字。按 sourceId||sourceRef 去重后，按 status 分类才是真实待处理量。
  const candidateList = [];
  const seenCandidates = new Set();
  for (const entry of candidates ? (candidates.candidates || []).concat(candidates.unmapped || []) : []) {
    if (!entry) continue;
    const key = entry.sourceId || entry.sourceRef;
    if (!key || seenCandidates.has(key)) continue;
    seenCandidates.add(key);
    candidateList.push(entry);
  }
  // 取不到候选清单时必须是 null 而不是 0 —— "0 个待定" 和 "不知道有几个" 是两件事，
  // 把后者显示成前者，就等于让消费方照着空口径继续做判断。
  const byStatus = candidates ? histogram(candidateList, (entry) => entry.status) : null;
  const unmappedCandidates = candidateList.filter((entry) => entry.status !== "confirmed");
  const ledgerIds = new Set((ledger && ledger.icons ? ledger.icons : []).map((icon) => icon.sourceId).filter(Boolean));
  const confirmedNotLedger = candidateList.filter((entry) => entry.status === "confirmed" && !ledgerIds.has(entry.sourceId));

  const mappingNodes = mapping ? mapping.nodes || [] : [];
  const textAudit = mapping ? mapping.textAudit || [] : [];
  const pending = mapping ? mapping.pending || [] : [];
  const unmapped = mapping ? mapping.unmappedComponents || [] : [];
  // 嵌套明细在 nesting-report.json（产物），bundle 里只有 { nesting: { enabled } } 开关。
  const nestingEntry = output("Generated/" + target + ".nesting-report.json");
  if (nestingEntry) sources.nesting = { path: nestingEntry.path, step: null };
  const nesting = nestingEntry ? nestingEntry.value : null;
  const layoutEvidence = layout && layout.layoutEvidence ? layout.layoutEvidence : null;

  // 产物层：页面 XML 的 ControlType 分布 + 页面图标字典的 x:Key。
  // 这两项以前是消费方各自写探针去数（读 Page.xml 分组、读 Icons.xaml 的 x:Key），
  // 数出来的层和映射层不是同一层，所以必须分层报、并给出各自的来源。
  const pageXmlRel = "Resources/Pages/" + target + "/" + target + "Page.xml";
  const iconsXamlRel = "Resources/Pages/" + target + "/" + target + "Icons.xaml";
  const pageXml = readOutputText(registryData, projectRoot, pageXmlRel);
  const iconsXaml = readOutputText(registryData, projectRoot, iconsXamlRel);
  if (pageXml) sources.pageXml = { path: pageXmlRel, step: null };
  if (iconsXaml) sources.iconsXaml = { path: iconsXamlRel, step: null };
  const pageControlTypes = pageXml ? histogram(matchAll(pageXml, /ControlType="([^"]*)"/g), (name) => name) : null;
  const pageIconKeys = iconsXaml ? matchAll(iconsXaml, /x:Key="([^"]*)"/g) : null;
  const ledgerNames = (ledger && ledger.icons ? ledger.icons : []).map((icon) => icon.name).filter(Boolean);
  // 台账里登记、但没进页面图标字典的（例如底部栏常驻分组由框架处理的那部分）：
  // 只报差集，不替框架解释原因。
  const ledgerNotInPageIcons = pageIconKeys ? ledgerNames.filter((name) => !pageIconKeys.includes(name)) : null;

  const outputs = registryData.outputs || {};
  const outputPaths = Object.keys(outputs);
  const pageLocal = outputPaths.filter((rel) => classifyOutput(rel) === "pageLocal" && outputs[rel].exists);
  const sharedShell = outputPaths.filter((rel) => classifyOutput(rel) === "sharedShell" && outputs[rel].exists);

  const steps = registryData.steps || [];
  const failedSteps = steps.filter((step) => step.status !== "ok").map((step) => step.id + ":" + step.name + ":" + step.status);

  // 待办：这些是必须人工/AI 处理才能继续的事项，摘要负责把它们一次性列全。
  const todos = [];
  if (pending.length) todos.push({ kind: "mapping.pending", count: pending.length, items: pending.map((p) => p.sourceRef + "（" + (p.reason || "") + "）").slice(0, 10) });
  if (unmapped.length) todos.push({ kind: "mapping.unmappedComponents", count: unmapped.length, items: unmapped.slice(0, 10) });
  if (unmappedCandidates.length) {
    todos.push({
      kind: "icons.unconfirmed",
      count: unmappedCandidates.length,
      byReason: histogram(unmappedCandidates, (entry) => entry.reason)
    });
  }
  if (confirmedNotLedger.length) todos.push({ kind: "icons.confirmedNotInLedger", count: confirmedNotLedger.length });
  if (nesting && count(nesting.conflicts)) todos.push({ kind: "nesting.conflicts", count: count(nesting.conflicts) });
  if (layoutEvidence && layoutEvidence.unresolvedBottomBarItems) todos.push({ kind: "layout.unresolvedBottomBarItems", count: layoutEvidence.unresolvedBottomBarItems });
  if (layout && layout.layoutStatus === "none") todos.push({ kind: "layout.status", note: "本页无底部栏（layoutStatus=none），不是失败" });
  // 台账与页面图标字典的差集不是"缺图标"，而是两层归属不同：报出来让人确认，别让消费方拿一层的数量去核另一层。
  if (ledgerNotInPageIcons && ledgerNotInPageIcons.length) {
    todos.push({ kind: "icons.ledgerNotInPageIcons", count: ledgerNotInPageIcons.length, items: ledgerNotInPageIcons, note: "台账登记但未落本页图标字典；可能是框架级几何（如 EXIT / ENTER，全项目从不定义却普遍被页面引用），需人工确认，不等于产物缺图标" });
  }

  const summary = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    run: {
      runId: registryData.runId,
      target,
      ui: registryData.identity ? registryData.identity.ui : null,
      fileId: registryData.identity ? registryData.identity.fileId : null,
      layerId: registryData.identity ? registryData.identity.layerId : null,
      designPageName: registryData.identity ? registryData.identity.designPageName : null,
      steps: steps.map((step) => ({ id: step.id, name: step.name, status: step.status, seconds: step.seconds, note: step.note || "", log: step.log || null })),
      failedSteps,
      artifactCount: Object.keys(registryData.artifacts || {}).length,
      outputCount: outputPaths.length
    },
    page: {
      capturedNodes: coverage ? coverage.capturedNodeCount : null,
      sourceNodes: mapping ? count(mapping.sourceNodes) : null,
      mappingNodes: mapping ? mappingNodes.length : null,
      componentInstances: mapping ? count(mapping.componentInstances) : null,
      controlTypes: mapping ? histogram(mappingNodes, (node) => node.controlType) : null,
      textAudit: mapping ? textAudit.length : null,
      layout: layout ? {
        status: layout.layoutStatus,
        menuItems: count(layout.menuItems),
        resolvedBottomBarItems: layoutEvidence ? layoutEvidence.resolvedBottomBarItems : null,
        unresolvedBottomBarItems: layoutEvidence ? layoutEvidence.unresolvedBottomBarItems : null
      } : null,
      nesting: nesting ? {
        containers: count(nesting.containers),
        reparented: count(nesting.reparented),
        skipped: count(nesting.skipped),
        conflicts: count(nesting.conflicts)
      } : null,
      icons: {
        extractSvgEntries: svgs ? (svgs.count === undefined ? count(svgs.svgs) : svgs.count) : null,
        candidates: candidates ? candidateList.length : null,
        byStatus,
        ledger: ledger ? count(ledger.icons) : null,
        confirmedNotInLedger: candidates && ledger ? confirmedNotLedger.length : null
      }
    },
    // 产物层：与上面的"映射层"不是同一层，数字可以不同，所以单独一节并标注来源。
    pageProduct: {
      counts: {
        pageXmlControls: pageControlTypes ? Object.values(pageControlTypes).reduce((a, b) => a + b, 0) : null,
        pageIconKeys: pageIconKeys ? pageIconKeys.length : null,
        ledgerIcons: ledger ? ledgerNames.length : null
      },
      pageXmlControlTypes: pageControlTypes,
      pageIconKeys,
      ledgerNotInPageIcons: ledger ? ledgerNotInPageIcons : null
    },
    todos,
    outputs: {
      pageLocal,
      sharedShell,
      counts: { pageLocal: pageLocal.length, sharedShell: sharedShell.length, registered: outputPaths.length }
    },
    sources,
    consumed: report.consumed,
    unavailable
  };

  const outFile = path.resolve(projectRoot, "Generated", target + ".summary.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const temp = outFile + ".tmp-" + process.pid;
  fs.writeFileSync(temp, JSON.stringify(summary, null, 2) + "\n", "utf8");
  fs.renameSync(temp, outFile);

  // 摘要自身也进 outputs：它和别的产出受同一套 sha256 校验，不会成为"唯一没人管"的文件。
  // kind 用文档已有的 audit（交付与来源证据、保留），不新增 kind——避免文档闭集与实现再次分叉。
  registry.recordOutputs(registryData, [{ path: registry.projectRelative(projectRoot, outFile), kind: "audit" }], options);
  registry.saveRegistry(runFile, registryData);

  if (!args.quiet) {
    console.log(JSON.stringify({
      summary: registry.projectRelative(projectRoot, outFile),
      runId: summary.run.runId,
      steps: steps.length,
      failedSteps,
      page: summary.page,
      todos: todos.map((todo) => todo.kind + "=" + (todo.count === undefined ? todo.note : todo.count)),
      sources: Object.keys(sources).length,
      consumed: report.consumed.map((item) => item.key),
      unavailable: unavailable.map((item) => item.key)
    }));
  }
}

main();
