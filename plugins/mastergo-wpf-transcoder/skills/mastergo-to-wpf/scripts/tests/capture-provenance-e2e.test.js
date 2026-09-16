#!/usr/bin/env node
"use strict";

// 端到端 provenance 回归：capture → 快照 → mapping 清单，三层必须指向同一份字节。
// 背景：同一 layerId 的 getDsl 响应逐次不一致（合并态/展开态两种下发形态），所以每页只允许
// 冻结一次 capture 作为基准。本用例把「基准有没有真的传下去」钉死，且全程零网络：
//   1) 用本地 MCP 桩（stdio）跑一次 call-mastergo-mcp.js，落盘 getDsl.json + provenance sidecar；
//   2) 断言 sidecar 的 sha256/bytes 就是该文件的真实字节哈希（Node 侧独立复算）；
//   3) 用 mastergo-dsl-pipeline.ps1 -Action Capture 固化同一份文件，断言 manifest/快照回指的
//      captureSha256 与 sidecar 的 sha256 相等——这同时验证 PowerShell 的 Get-FileHash 与
//      Node 的 SHA256 是同一口径（否则两侧永远对不上）；
//   4) 用该快照跑 gen-mtslg-mapping-from-dsl.js，断言 mapping.source 两份哈希分别等于
//      「原始 capture 文件」与「快照文件」的真实字节哈希，且出网链路标签原样带过来。
//
// 依赖 pwsh（PowerShell 7+）。本机没有 pwsh 时打印 SKIP 并以 0 退出——CI 与仓库的本地回归
// 命令都装了 pwsh（见 ARCHITECTURE.md「本地回归」），正常路径下这个用例会真跑。

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const scriptDir = path.join(__dirname, "..");
const mcpCaller = path.join(scriptDir, "call-mastergo-mcp.js");
const pipeline = path.join(scriptDir, "mastergo-dsl-pipeline.ps1");
const mappingScript = path.join(scriptDir, "gen-mtslg-mapping-from-dsl.js");
const templateMap = path.join(scriptDir, "..", "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");

const probe = spawnSync("pwsh", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.Major"], { encoding: "utf8" });
if (probe.error || probe.status !== 0) {
  console.log("SKIP 端到端 provenance 回归：本机没有可用的 pwsh（" +
    (probe.error ? probe.error.message : "退出码 " + probe.status + " " + String(probe.stderr).trim()) + "）");
  process.exit(0);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-provenance-e2e-"));
const EGRESS = "e2e-local-file";
const LAYER_ID = "provenance:root";
const payloadPath = path.join(root, "payload.json");
const stubPath = path.join(root, "stub-mcp.js");
const capturePath = path.join(root, "getDsl.json");
const runDir = path.join(root, "run");

try {
  // 桩：最小 MCP stdio 协议，只回一段合法 DSL（根节点 id 必须等于 -LayerId）
  fs.writeFileSync(payloadPath, JSON.stringify({
    dsl: {
      styles: {},
      nodes: [{
        type: "INSTANCE",
        id: LAYER_ID,
        name: "端到端例页",
        layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
        children: [
          { type: "TEXT", id: LAYER_ID + "/title", name: "标题", layoutStyle: { width: 80, height: 22, relativeX: 20, relativeY: 210 }, text: [{ text: "端到端" }] }
        ]
      }],
      components: []
    },
    componentDocumentLinks: [],
    rules: []
  }, null, 2), "utf8");
  fs.writeFileSync(stubPath, [
    "const fs = require('fs');",
    "const payload = fs.readFileSync(" + JSON.stringify(payloadPath) + ", 'utf8');",
    "let buffer = '';",
    "function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: id, result: result }) + '\\n'); }",
    "process.stdin.on('data', (chunk) => {",
    "  buffer += chunk.toString('utf8');",
    "  let index = buffer.indexOf('\\n');",
    "  while (index >= 0) {",
    "    const line = buffer.slice(0, index).trim();",
    "    buffer = buffer.slice(index + 1);",
    "    index = buffer.indexOf('\\n');",
    "    if (!line) continue;",
    "    const message = JSON.parse(line);",
    "    if (message.id === undefined) continue;",
    "    if (message.method === 'initialize') { reply(message.id, {}); continue; }",
    "    if (message.method === 'tools/list') { reply(message.id, { tools: [{ name: 'mcp__getDsl' }] }); continue; }",
    "    if (message.method === 'tools/call') { reply(message.id, { content: [{ type: 'text', text: payload }] }); continue; }",
    "    reply(message.id, {});",
    "  }",
    "});",
    ""
  ].join("\n"), "utf8");

  // 1) capture：响应只落盘，同时写 provenance sidecar（出网链路由调用方声明）
  const called = spawnSync(process.execPath, [mcpCaller,
    "--tool", "getDsl",
    "--fileId", "e2e-file",
    "--layerId", LAYER_ID,
    "--format", "json",
    "--out", capturePath,
    "--egress", EGRESS,
    "--token", "fake-token",
    "--mcp", process.execPath,
    "--mcp-arg", stubPath
  ], { encoding: "utf8" });
  assert.strictEqual(called.status, 0, "capture 必须成功：" + called.stderr);

  const captureSha256 = sha256File(capturePath);
  const captureBytes = fs.statSync(capturePath).size;
  const sidecar = JSON.parse(fs.readFileSync(capturePath + ".provenance.json", "utf8"));
  assert.strictEqual(sidecar.sha256, captureSha256, "sidecar 的 sha256 必须等于响应文件的字节哈希");
  assert.strictEqual(sidecar.bytes, captureBytes, "sidecar 必须记录响应字节数");
  assert.strictEqual(sidecar.egress, EGRESS, "sidecar 必须原样记录调用方声明的出网链路");

  // 2) 固化：manifest 与快照都必须回指同一份 capture 字节
  const captured = spawnSync("pwsh", ["-NoProfile", "-File", pipeline,
    "-Action", "Capture",
    "-InputFile", capturePath,
    "-Out", runDir,
    "-FileId", "e2e-file",
    "-LayerId", LAYER_ID,
    "-Ui", "F2",
    "-RunId", "e2e-run",
    "-Egress", EGRESS
  ], { encoding: "utf8" });
  assert.strictEqual(captured.status, 0, "Capture 必须成功：" + captured.stderr);

  const snapshotPath = path.join(runDir, "dsl.snapshot.json");
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(runDir, "manifest.json"), "utf8"));
  assert.strictEqual(manifest.captureSha256, sidecar.sha256,
    "PowerShell 侧 Get-FileHash 与 Node 侧 SHA256 必须同口径（同一份字节、同为小写十六进制）");
  assert.strictEqual(snapshot.captureSha256, captureSha256, "快照必须回指原始 capture 的字节哈希");
  assert.strictEqual(snapshot.captureBytes, captureBytes, "快照必须记录原始 capture 的字节数");
  assert.strictEqual(snapshot.egress, EGRESS, "快照必须记录调用方声明的出网链路");
  assert.strictEqual(manifest.captureBytes, captureBytes, "manifest 必须记录原始 capture 的字节数");
  assert.strictEqual(manifest.egress, EGRESS, "manifest 必须记录调用方声明的出网链路");

  // 3) mapping：provenance 随页面产物一起流转
  const visibilityPath = path.join(root, "visibility.json");
  const iconMapPath = path.join(root, "icon-map.json");
  const mappingPath = path.join(root, "mapping.json");
  fs.writeFileSync(visibilityPath, JSON.stringify({ nodes: [] }, null, 2), "utf8");
  fs.writeFileSync(iconMapPath, JSON.stringify({ icons: [] }, null, 2), "utf8");

  const mapped = spawnSync(process.execPath, [mappingScript,
    "--dsl", snapshotPath,
    "--visibility", visibilityPath,
    "--template-map", templateMap,
    "--icon-map", iconMapPath,
    "--out", mappingPath
  ], { encoding: "utf8" });
  assert.strictEqual(mapped.status, 0, "mapping 生成必须成功：" + mapped.stderr);

  const mapping = JSON.parse(fs.readFileSync(mappingPath, "utf8"));
  assert.strictEqual(mapping.source.sourceSha256, sidecar.sha256,
    "mapping 必须回指原始 capture 的哈希（与 capture 侧独立算出的值一致）");
  assert.strictEqual(mapping.source.sourceBytes, captureBytes, "mapping 必须记录原始 capture 的字节数");
  assert.strictEqual(mapping.source.egress, EGRESS, "mapping 必须带出出网链路标签");
  assert.strictEqual(mapping.source.snapshotSha256, sha256File(snapshotPath),
    "mapping 必须记录本次实际消费的快照自身哈希");
  assert.strictEqual(mapping.source.snapshotBytes, fs.statSync(snapshotPath).size, "mapping 必须记录快照字节数");
  assert.notStrictEqual(mapping.source.snapshotSha256, mapping.source.sourceSha256,
    "快照与原始 capture 是两份不同字节，两个哈希不应相等（相等说明记错了层）");

  console.log("PASS 端到端 capture provenance 回归（capture → 快照 → mapping 三层同源，零网络）");
}
finally {
  if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
}
