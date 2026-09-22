// 本次运行的「本页现状」摘要 —— 替代消费方每次手写探针去数一遍产物。
//
// 纪律（与 bundle-manifest.md 第 7 节「消费只按登记取」同一条契约）：
//   1. 只从 run.json 里登记的条目取数，绝不扫目录——目录里可能留着上一次运行的旧同名文件；
//   2. 每个登记条目都复校 sha256，对不上就失败，不降级、不警告了事；
//   3. 「读不到」只由登记表判定，不靠猜：outputs 记了 removed=true / exists=false → 后续步骤
//      正常清理的中间产物，记入 consumed；登记为存在却读不到文件 → 登记表与磁盘漂移，立即失败；
//   4. 取不到的值一律 null 并记入 unavailable，「0」与「不知道」严格区分；
//   5. 摘要是派生视图：由 run-all 每步刷新，内容随刷新变化，因此**不写回登记表**——
//      写进去的 sha256 下一次刷新就过期，等于自己制造不一致。
//
// 用法:
//   node build-run-summary.mjs --project-root <项目> --target <Target> [--quiet]
//
// 产出: <项目>/Generated/<Target>.summary.json
// stdout: 一行紧凑 JSON（只含计数、待办与状态说明，不进整份产物）

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const registry = require("./lib/run-registry.js");
const helpers = require("./lib/script-helpers.js");

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

function matchAll(text, re) {
  const out = [];
  if (!text) return out;
  for (const match of text.matchAll(re)) out.push(match[1]);
  return out;
}

// 共享壳由多个页面共同更新，不属于本页；分开报，避免把别页的改动算进本页。
const SHARED_SHELL = [/^Resources\/Layout\//, /^[^/]+\.csproj$/, /^framework\.config\.json$/];

function classifyOutput(rel) {
  const slashed = String(rel).replace(/\\/g, "/");
  return SHARED_SHELL.some((re) => re.test(slashed)) ? "sharedShell" : "pageLocal";
}

// 登记产物与登记产出走同一条存在性判定：读不到只有两种结论——登记表记了清理，或登记表与磁盘漂移。
function makeReaders(registryData, projectRoot, report) {
  const outputs = registryData.outputs || {};
  // 同一路径可能既是登记产物又出现在 outputs 里，按路径去重，避免 consumed 出现两条。
  const addConsumed = (rel, reason, key) => {
    const existing = report.consumed.find((item) => item.path === rel);
    if (existing) {
      if (key && !existing.key) existing.key = key;
      return;
    }
    report.consumed.push(key ? { key, path: rel, reason } : { path: rel, reason });
  };
  const unreadable = (rel) => {
    const record = outputs[rel];
    if (record && record.exists === false && record.removed === true) {
      addConsumed(rel, "后续步骤已清理的中间产物（登记表已记录 removed=true）");
      return null;
    }
    throw new Error("登记为存在的 " + rel + " 读不到文件（登记表没有记录它被清理）——" +
      "登记表与磁盘已漂移，先跑产出它的那一步");
  };

  function artifact(key) {
    const entry = registryData.artifacts && registryData.artifacts[key];
    if (!entry) {
      report.unavailable.push({ key, layer: "artifact", reason: "本次运行尚未登记该产物（对应步骤还没跑到）" });
      return null;
    }
    const abs = path.resolve(projectRoot, entry.path);
    if (!fs.existsSync(abs)) {
      const record = outputs[entry.path];
      if (record && record.exists === false && record.removed === true) {
        addConsumed(entry.path, "后续步骤已清理的中间产物（登记表已记录 removed=true）", key);
        return null;
      }
      return unreadable(entry.path);
    }
    registry.resolveArtifact(registryData, key, { projectRoot }); // 复校 sha256，不符即抛
    return { path: entry.path, abs, value: helpers.readJson(abs, key) };
  }

  // 页面局部产出：只认 outputs 里登记过的；登记为已删除的不消费。
  // 只做"取到并校验过的文件"，是否 JSON 由调用方决定（页面 XML / Icon 字典不是 JSON）。
  function outputFile(rel) {
    const slashed = rel.replace(/\\/g, "/");
    const record = outputs[slashed];
    if (!record) {
      report.unavailable.push({ key: slashed, layer: "output", reason: "该产出未登记（对应步骤还没跑到）" });
      return null;
    }
    // 登记表自己记了 exists:false（例如收尾清理掉的 _work 文件）：不消费，也不算漂移。
    if (record.exists !== true || !record.sha256) {
      if (record.removed === true) addConsumed(slashed, "登记表已记录为已清理（removed=true）");
      report.unavailable.push({ key: slashed, layer: "output", reason: "登记表记录该产出不存在（已清理或未产出）" });
      return null;
    }
    const abs = path.resolve(projectRoot, slashed);
    if (!fs.existsSync(abs)) return unreadable(slashed);
    if (registry.sha256File(abs) !== record.sha256) {
      throw new Error("产出 " + slashed + " 与登记不一致（被改写或来自另一次运行）");
    }
    return { path: slashed, abs };
  }

  function outputJson(rel) {
    const entry = outputFile(rel);
    return entry ? { path: entry.path, abs: entry.abs, value: helpers.readJson(entry.abs, entry.path) } : null;
  }

  return { artifact, outputFile, outputJson };
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
  const sources = {};
  const { artifact, outputFile, outputJson } = makeReaders(registryData, projectRoot, report);
  const take = (name, entry, step) => {
    if (entry) sources[name] = { path: entry.path, step: step === undefined ? null : step };
    return entry ? entry.value : null;
  };
  const stepOf = (key) => (registryData.artifacts[key] ? registryData.artifacts[key].step : null);
  const artifacts = registryData.artifacts || {};

  const coverage = take("coverage", artifact("coverage"), stepOf("coverage"));
  const candidates = take("iconCandidates", artifact("iconCandidates"), stepOf("iconCandidates"));
  const ledger = take("iconMap", artifact("iconMap"), stepOf("iconMap"));
  const layout = take("layoutManifest", artifact("layoutManifest"), stepOf("layoutManifest"));
  const bundle = take("bundleManifest", artifact("bundleManifest"), stepOf("bundleManifest"));
  const svgs = take("extractSvg", artifact("extractSvg"), stepOf("extractSvg"));
  // mapping：草稿还在就用草稿（run 中途也能工作）；草稿已被 bundle 清理就取产物化的 Generated/<Target>.mapping.json。
  let mapping = take("mappingDraft", artifact("mappingDraft"), stepOf("mappingDraft"));
  if (!mapping) mapping = take("mapping", outputJson("Generated/" + target + ".mapping.json"), null);
  const unavailable = report.unavailable;

  // 图标候选：icon-candidates.json 里 candidates 与 unmapped 是重叠视图，同一条还会重复出现，
  // 直接取数组长度会虚高。按 sourceId||sourceRef 去重后，按 status 分类才是真实数量。
  const candidateList = [];
  const seenCandidates = new Set();
  for (const entry of candidates ? (candidates.candidates || []).concat(candidates.unmapped || []) : []) {
    if (!entry) continue;
    const key = entry.sourceId || entry.sourceRef;
    if (!key || seenCandidates.has(key)) continue;
    seenCandidates.add(key);
    candidateList.push(entry);
  }
  const byStatus = candidates ? histogram(candidateList, (entry) => entry.status) : null;
  const unconfirmed = candidateList.filter((entry) => entry.status !== "confirmed");
  const ledgerIds = new Set((ledger && ledger.icons ? ledger.icons : []).map((icon) => icon.sourceId).filter(Boolean));
  const confirmedNotLedger = candidateList.filter((entry) => entry.status === "confirmed" && !ledgerIds.has(entry.sourceId));

  const mappingNodes = mapping ? mapping.nodes || [] : [];
  const textAudit = mapping ? mapping.textAudit || [] : [];
  const pending = mapping ? mapping.pending || [] : [];
  const unmapped = mapping ? mapping.unmappedComponents || [] : [];
  const nestingEntry = outputJson("Generated/" + target + ".nesting-report.json");
  if (nestingEntry) sources.nesting = { path: nestingEntry.path, step: null };
  const nesting = nestingEntry ? nestingEntry.value : null;
  const layoutEvidence = layout && layout.layoutEvidence ? layout.layoutEvidence : null;

  // 产物层：页面 XML 的 ControlType 分布 + 本页图标字典的 x:Key。
  // 与上面的映射层不是同一层，数字可以不同，所以分层报并各自标来源。
  const pageXmlRel = "Resources/Pages/" + target + "/" + target + "Page.xml";
  const iconsXamlRel = "Resources/Pages/" + target + "/" + target + "Icons.xaml";
  const pageXmlEntry = outputFile(pageXmlRel);
  const iconsXamlEntry = outputFile(iconsXamlRel);
  if (pageXmlEntry) sources.pageXml = { path: pageXmlEntry.path, step: null };
  if (iconsXamlEntry) sources.iconsXaml = { path: iconsXamlEntry.path, step: null };
  const pageControlTypes = pageXmlEntry
    ? histogram(matchAll(fs.readFileSync(pageXmlEntry.abs, "utf8"), /ControlType="([^"]*)"/g), (name) => name)
    : null;
  const pageIconKeys = iconsXamlEntry ? matchAll(fs.readFileSync(iconsXamlEntry.abs, "utf8"), /x:Key="([^"]*)"/g) : null;
  const ledgerNames = (ledger && ledger.icons ? ledger.icons : []).map((icon) => icon.name).filter(Boolean);
  const ledgerNotInPageIcons = pageIconKeys ? ledgerNames.filter((name) => !pageIconKeys.includes(name)) : null;

  const outputs = registryData.outputs || {};
  const outputPaths = Object.keys(outputs);
  const pageLocal = outputPaths.filter((rel) => classifyOutput(rel) === "pageLocal" && outputs[rel].exists);
  const sharedShell = outputPaths.filter((rel) => classifyOutput(rel) === "sharedShell" && outputs[rel].exists);

  const steps = registryData.steps || [];
  const failedSteps = steps.filter((step) => step.status !== "ok").map((step) => step.id + ":" + step.name + ":" + step.status);

  // todos 只放「必须人工/AI 动作」的事项；状态说明放 notices，免得消费方按字段名误判。
  const todos = [];
  const notices = [];
  if (pending.length) todos.push({ kind: "mapping.pending", count: pending.length, items: pending.map((p) => p.sourceRef + "（" + (p.reason || "") + "）").slice(0, 10) });
  if (unmapped.length) todos.push({ kind: "mapping.unmappedComponents", count: unmapped.length, items: unmapped.slice(0, 10) });
  if (unconfirmed.length) {
    // 候选的 status / reason 只取第 6 步 discover 的时点值，之后不会相对台账重算，
    // 所以不能因为「台账文件已存在」就把它改判成信息项——那会让消费方以为图标定名无需动作。
    todos.push({
      kind: "icons.unconfirmed",
      count: unconfirmed.length,
      byReason: histogram(unconfirmed, (entry) => entry.reason),
      note: "候选状态是第 6 步 discover 的时点值（此后不重算）；已被台账采纳的见 page.icons.ledger"
    });
  }
  if (confirmedNotLedger.length) todos.push({ kind: "icons.confirmedNotInLedger", count: confirmedNotLedger.length });
  if (nesting && count(nesting.conflicts)) todos.push({ kind: "nesting.conflicts", count: count(nesting.conflicts) });
  if (layoutEvidence && layoutEvidence.unresolvedBottomBarItems) todos.push({ kind: "layout.unresolvedBottomBarItems", count: layoutEvidence.unresolvedBottomBarItems });
  if (layout && layout.layoutStatus === "none") notices.push({ kind: "layout.status", note: "本页无底部栏（layoutStatus=none），这是合法终态，无需动作" });
  // 台账与页面图标字典的差集不是「缺图标」：部分几何由框架级资源字典提供（EXIT / ENTER 全项目从不定义
  // 却普遍被页面 Icon 引用）。只报差集并要求人工确认，不替框架断定原因。
  if (ledgerNotInPageIcons && ledgerNotInPageIcons.length) {
    notices.push({
      kind: "icons.ledgerNotInPageIcons",
      count: ledgerNotInPageIcons.length,
      items: ledgerNotInPageIcons,
      note: "台账登记但未落本页图标字典；可能是框架级几何，需人工确认，不等于产物缺图标"
    });
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
      artifactCount: Object.keys(artifacts).length,
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
    // 产物层：与上面的映射层不是同一层，数字可以不同，所以单独一节并标注来源。
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
    notices,
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

  if (!args.quiet) {
    console.log(JSON.stringify({
      summary: registry.projectRelative(projectRoot, outFile),
      runId: summary.run.runId,
      steps: steps.length,
      failedSteps,
      page: summary.page,
      todos: todos.map((item) => item.count === undefined ? item.kind : item.kind + "=" + item.count),
      notices: notices.map((item) => item.kind),
      sources: Object.keys(sources).length,
      consumed: report.consumed.map((item) => item.path),
      unavailable: unavailable.map((item) => item.key)
    }));
  }
}

main();
