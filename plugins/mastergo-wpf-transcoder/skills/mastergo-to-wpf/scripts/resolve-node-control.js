#!/usr/bin/env node
"use strict";
/*
 * resolve-node-control.js —— 给"人工手写页面控件"用的一键查询：
 *   输入：MasterGo 容器链接（或 fileId + layerId，或本地 DSL 快照）
 *   输出：该容器内每个节点的 页面 ID（MX_…）；命中正式映射表的节点，**同时给出可直接粘贴的完整控件代码**。
 *
 * 用法:
 *   node resolve-node-control.js --short-link "https://mastergo.com/goto/xxx?file=…&layer_id=79:162125" 
 *   node resolve-node-control.js --file-id 181586559903927 --layer-id 79:162125 [--token mg_xxx]
 *   node resolve-node-control.js --snapshot <dsl.snapshot.json>          # 离线：已有快照时用
 *   [--out <node-controls.json>] [--work-dir <目录>] [--quiet]
 *
 * 依赖（全部在插件内，随插件分发）：
 *   call-mastergo-mcp.js          取 getDsl（仅链接模式需要；响应只落盘）
 *   mastergo-dsl-pipeline.ps1     固化快照（仅链接模式需要；需要 pwsh）
 *   resolve-mastergo-visibility.js + gen-mtslg-mapping-from-dsl.js + gen-iocontrol-xml.js
 *                                 → 命中映射表的节点给出完整控件代码（与正式转码同一套模板）
 *   lib/page-node-id.js           ID 口径的唯一实现（与 GUI/exe、生成器完全一致）
 *
 * 输出 JSON（{ pageKey, source, nodes: [ { ref, id, layerId, name, text, type, pageAbsX, pageAbsY,
 *   width, height, template, controlType, xml } ] }）；xml 为空字符串表示该控件不在正式映射表里
 *   （需要人工按设计稿手写，或先补映射登记）。
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const PAGE_NODE_ID = require(path.join(__dirname, "lib", "page-node-id.js"));
const { extractXmlChunk } = require(path.join(__dirname, "lib", "iocontrol-xml-chunk.js"));

const TEMPLATE_MAP = path.join(__dirname, "..", "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");

function fail(message) {
  console.error(message);
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) fail("无法识别的参数: " + token);
    const key = token.slice(2);
    if (key === "quiet") { out.quiet = true; continue; }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail("--" + key + " 缺少取值");
    i += 1;
    out[key] = value;
  }
  return out;
}

// 名字避开 gen-mastergo-page-bundle.js 里已有的 run()（插件有"同名函数必须复用"的硬门，见
// script-duplication.test.js；这里职责是"跑子脚本并失败即退出"，与编排器的 run 不同，故用独立名字）。
function runStep(command, args, label) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    fail(label + " 失败(exit=" + result.status + "):\n" + (result.stderr || "") + (result.stdout || ""));
  }
  return result;
}

// 从 MasterGo 链接里解析 fileId / layerId（也接受已经拆好的参数）
function parseLink(link) {
  const out = {};
  const file = /[?&]file=([0-9]+)/.exec(link);
  if (file) out.fileId = file[1];
  const layer = /[?&]layer_id=([^&]+)/.exec(link);
  if (layer) out.layerId = decodeURIComponent(layer[1]);
  return out;
}

function absOf(node, x, y) {
  const style = node.layoutStyle || {};
  const absX = x + (typeof style.relativeX === "number" ? style.relativeX : 0);
  const absY = y + (typeof style.relativeY === "number" ? style.relativeY : 0);
  return { absX, absY, width: style.width, height: style.height };
}

const args = parseArgs(process.argv.slice(2));
const workDir = path.resolve(args["work-dir"] || fs.mkdtempSync(path.join(require("os").tmpdir(), "node-control-")));
fs.mkdirSync(workDir, { recursive: true });
const outPath = path.resolve(args.out || path.join(workDir, "node-controls.json"));

let snapshotPath = args.snapshot ? path.resolve(args.snapshot) : null;
let source = "snapshot";
let fileId = args["file-id"] || null;
let layerId = args["layer-id"] || null;
if (!fileId && (args["short-link"] || args.url)) {
  const parsed = parseLink(args["short-link"] || args.url);
  fileId = fileId || parsed.fileId || null;
  layerId = layerId || parsed.layerId || null;
}

if (!snapshotPath) {
  if (!fileId || !layerId) {
    fail("用法: node resolve-node-control.js --short-link <MasterGo 链接> | --file-id <id> --layer-id <79:162125> | --snapshot <dsl.snapshot.json>");
  }
  const getDslPath = path.join(workDir, "getDsl.json");
  const callArgs = ["--tool", "getDsl", "--fileId", fileId, "--layerId", layerId, "--format", "json", "--out", getDslPath];
  if (args.token) callArgs.push("--token", args.token);
  runStep(process.execPath, [path.join(__dirname, "call-mastergo-mcp.js")].concat(callArgs), "取 MasterGo DSL");
  const pipeline = path.join(__dirname, "mastergo-dsl-pipeline.ps1");
  runStep("pwsh", ["-NoProfile", "-File", pipeline, "-Action", "Capture", "-InputFile", getDslPath,
    "-Out", workDir, "-FileId", fileId, "-LayerId", layerId, "-Ui", args.ui || "F2"], "固化 DSL 快照");
  snapshotPath = path.join(workDir, "dsl.snapshot.json");
  source = "mastergo";
}

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const pageKey = PAGE_NODE_ID.pageKeyOf(snapshot);

// 可见性 → mapping → 整页 XML（命中映射表的节点才能拿到完整控件代码）
const visibilityPath = path.join(workDir, "visibility.json");
runStep(process.execPath, [path.join(__dirname, "resolve-mastergo-visibility.js"),
  "--input", snapshotPath, "--out", visibilityPath], "解析显隐事实");
const mappingPath = path.join(workDir, "mapping.json");
runStep(process.execPath, [path.join(__dirname, "gen-mtslg-mapping-from-dsl.js"),
  "--dsl", snapshotPath, "--visibility", visibilityPath, "--template-map", TEMPLATE_MAP,
  "--out", mappingPath], "推导 mapping");
const pageXmlPath = path.join(workDir, "page.xml");
runStep(process.execPath, [path.join(__dirname, "gen-iocontrol-xml.js"),
  "--fresh", mappingPath, "--out", pageXmlPath, "--map", TEMPLATE_MAP], "发射控件代码");

const mapping = JSON.parse(fs.readFileSync(mappingPath, "utf8"));
const pageXml = fs.readFileSync(pageXmlPath, "utf8");
const mappingByRef = new Map((mapping.nodes || []).map((node) => [node.sourceRef, node]));

const nodes = [];
(function walk(node, x, y) {
  const box = absOf(node, x, y);
  const ref = String(node.id);
  const mapped = mappingByRef.get(ref) || null;
  const text = Array.isArray(node.text) ? node.text.map((part) => part.text || "").join("") : "";
  nodes.push({
    ref: ref,
    id: PAGE_NODE_ID.derivePageNodeId(pageKey, ref),
    layerId: ref.indexOf("/") >= 0 ? ref.slice(ref.lastIndexOf("/") + 1) : ref,
    name: node.name || "",
    text: text,
    type: node.type || "",
    pageAbsX: box.absX,
    pageAbsY: box.absY,
    width: typeof box.width === "number" ? box.width : null,
    height: typeof box.height === "number" ? box.height : null,
    template: mapped ? mapped.controlType + (mapped.attrs && mapped.attrs.Style ? " / " + mapped.attrs.Style : "") : "",
    controlType: mapped ? mapped.controlType : "",
    xml: mapped ? extractXmlChunk(pageXml, mapped.xmlId) : ""
  });
  for (const child of node.children || []) walk(child, box.absX, box.absY);
})(snapshot.dsl.nodes[0], 0, 0);

const result = { pageKey: pageKey, source: source, snapshot: snapshotPath, nodes: nodes };
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf8");
if (!args.quiet) {
  const mappedCount = nodes.filter((node) => node.xml).length;
  console.log(JSON.stringify({
    out: outPath,
    pageKey: pageKey,
    source: source,
    nodes: nodes.length,
    mappedNodes: mappedCount
  }, null, 2));
}
