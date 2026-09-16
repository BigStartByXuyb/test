#!/usr/bin/env node
"use strict";

// 通过 stdio 调用 MasterGo MCP，并把响应内容直接落盘。
// 设计目的：整页 DSL / SVG 响应绝不进入模型上下文——stdout 只打印一行摘要 JSON。
//
// 用法:
//   node call-mastergo-mcp.js --tool getDsl --fileId <fileId> --layerId <layerId> [--format json] \
//        --out <runDir>/getDsl.json --egress <出网链路标签> [--token mg_xxx] [--url https://mastergo.com]
//
//   node call-mastergo-mcp.js --tool extractSvg --fileId <fileId> --layerId <layerId> \
//        --page 0 --pageSize 100 --out <runDir>/extractSvg.json --egress <出网链路标签>
//
//   node call-mastergo-mcp.js --list-tools          # 只列出服务端可用工具名（不落盘）
//
// 约定:
//   - token 优先取 --token，其次取环境变量 MASTERGO_MCP_TOKEN；绝不写入产物。
//   - 只用 --out 指定文件承载响应内容；脚本不把响应打到 stdout/stderr。
//   - 需要比对服务端工具名时，脚本会先 tools/list，匹配 "getDsl" / "mcp__getDsl" 等前缀形式。
//   - --egress 是**必填**的「出网链路标签」（如 direct / corp-proxy / 内网网关名）：
//     本次请求实际走哪条链路，在本进程内不可知（环境变量、代理配置都可能被外层改写），
//     因此只能由调用方声明，**脚本绝不自行探测**。缺省即拒绝落盘，避免把来源不明的
//     capture 记成有 provenance 的基线。
//   - 落盘响应后额外写一份 sidecar `<out>.provenance.json`：sha256 + bytes + fileId/layerId
//     + egress + fetchedAt。哈希口径是「文件字节的 SHA256、十六进制小写」，与
//     mastergo-dsl-pipeline.ps1 的 Get-FileHash 一致，两侧可独立互校。
//   - sidecar 只记哈希与元数据，绝不夹带响应内容。

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { sha256Text } = require(path.join(__dirname, "lib", "script-helpers.js"));

const TOOL_ARG_KEYS = [
  ["fileId", "fileId"],
  ["layerId", "layerId"],
  ["format", "format"],
  ["page", "page"],
  ["pageSize", "pageSize"],
  ["sectionIndex", "sectionIndex"],
  ["shortLink", "shortLink"],
  ["sourceLayerId", "sourceLayerId"],
  ["contentId", "contentId"],
  ["documentId", "documentId"],
  ["codeFile", "codeFile"],
  ["outDir", "outDir"],
  ["outputFileName", "outputFileName"],
  ["targetLang", "targetLang"],
  ["rootPath", "rootPath"],
  ["featureName", "featureName"],
];

function parseArgs(argv) {
  const out = { mcpArgs: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) throw new Error("无法识别的参数: " + token);
    const key = token.slice(2);
    if (key === "list-tools") { out.listTools = true; continue; }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Error("--" + key + " 缺少取值");
    i += 1;
    if (key === "mcp-arg") out.mcpArgs.push(value);
    else out[key] = value;
  }
  return out;
}

// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const fail = require(require("path").join(__dirname, "lib", "script-helpers.js")).failAndExit(2);

let args;
try { args = parseArgs(process.argv.slice(2)); }
catch (error) { fail(error.message + "\n用法见脚本头部注释"); }

if (!args.listTools) {
  if (!args.tool) fail("缺少 --tool（例如 getDsl / extractSvg）");
  if (!args.out) fail("缺少 --out（响应落盘路径）");
  // 出网链路只能由调用方声明：本进程内探测不到，也不允许猜一个默认值充数。
  if (!args.egress) fail("缺少 --egress（出网链路标签）：本次请求实际走哪条链路在脚本内不可知，必须由调用方声明");
}

const token = args.token || process.env.MASTERGO_MCP_TOKEN || "";
if (!token && !args.listTools) {
  fail("缺少 MasterGo token：请传 --token 或设置环境变量 MASTERGO_MCP_TOKEN（不得写入产物）");
}
const baseUrl = args.url || process.env.MASTERGO_MCP_URL || "https://mastergo.com";

const mcpCommand = args.mcp || (process.platform === "win32" ? "npx.cmd" : "npx");
const mcpArgs = args.mcpArgs.length ? args.mcpArgs.slice() : ["-y", "@mastergo/magic-mcp"];
if (token) mcpArgs.push("--token=" + token);
if (baseUrl) mcpArgs.push("--url=" + baseUrl);

const toolArgs = {};
for (const [flag, field] of TOOL_ARG_KEYS) {
  let value = args[flag];
  if (value === undefined && flag === "codeFile") {
    // --code 直接给代码字符串时也允许
    value = args.code;
    if (value !== undefined) { toolArgs.code = value; continue; }
  }
  if (value === undefined) continue;
  if (flag === "codeFile") toolArgs.code = fs.readFileSync(path.resolve(value), "utf8");
  else if (flag === "page" || flag === "pageSize" || flag === "sectionIndex") toolArgs[field] = Number(value);
  else toolArgs[field] = value;
}

// shell:true 时含空格的命令（如 C:\Program Files\nodejs\node.exe）必须自行加引号，否则无法启动
const launchCommand = /\s/.test(mcpCommand) && !/^".*"$/.test(mcpCommand) ? '"' + mcpCommand + '"' : mcpCommand;
const child = spawn(launchCommand, mcpArgs, {
  shell: true,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

let stdoutBuffer = "";
let stderrText = "";
const pending = new Map();
let nextId = 1;

function send(message) {
  child.stdin.write(JSON.stringify(message) + "\n");
}

function request(method, params) {
  const id = nextId;
  nextId += 1;
  return new Promise(function (resolve, reject) {
    pending.set(id, { resolve: resolve, reject: reject });
    send({ jsonrpc: "2.0", id: id, method: method, params: params });
  });
}

child.stderr.on("data", function (chunk) { stderrText += chunk.toString("utf8"); });
child.stdout.on("data", function (chunk) {
  stdoutBuffer += chunk.toString("utf8");
  let index = stdoutBuffer.indexOf("\n");
  while (index >= 0) {
    const line = stdoutBuffer.slice(0, index).trim();
    stdoutBuffer = stdoutBuffer.slice(index + 1);
    if (line) {
      let message = null;
      try { message = JSON.parse(line); } catch (error) { message = null; }
      if (message && message.id !== undefined && pending.has(message.id)) {
        const entry = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) entry.reject(new Error("MCP 调用失败: " + JSON.stringify(message.error)));
        else entry.resolve(message);
      }
    }
    index = stdoutBuffer.indexOf("\n");
  }
});

const timeoutMs = Number(args.timeoutMs || 240000);
const timer = setTimeout(function () {
  console.error("MCP 调用超时 " + timeoutMs + "ms" + (stderrText ? "；服务端 stderr: " + stderrText.slice(-400) : ""));
  try { child.kill(); } catch (error) { /* ignore */ }
  process.exit(3);
}, timeoutMs);

function toTextContent(result) {
  const content = result && Array.isArray(result.content) ? result.content : [];
  const textPart = content.find(function (item) { return item && item.type === "text"; });
  if (!textPart) return null;
  return textPart.text;
}

// 结束子进程并保证本进程一定退出（shell:true 时子进程可能持有管道，导致事件循环不空）
function shutdown(exitCode) {
  clearTimeout(timer);
  try { child.stdin.end(); } catch (error) { /* ignore */ }
  try { child.stdout.destroy(); } catch (error) { /* ignore */ }
  try { child.stderr.destroy(); } catch (error) { /* ignore */ }
  try { child.kill(); } catch (error) { /* ignore */ }
  setTimeout(function () { process.exit(exitCode); }, 120).unref();
}

(async function main() {
  await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "mastergo-wpf-transcoder", version: "1.0.0" },
  });
  send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });

  if (args.listTools) {
    const listed = await request("tools/list", {});
    clearTimeout(timer);
    const names = ((listed.result && listed.result.tools) || []).map(function (tool) { return tool.name; });
    console.log(JSON.stringify({ tools: names }));
    shutdown(0);
    return;
  }

  // 服务端工具名可能是 getDsl / mcp__getDsl 等前缀形式：先列一遍再精确匹配
  let serverToolName = args.tool;
  try {
    const listed = await request("tools/list", {});
    const names = ((listed.result && listed.result.tools) || []).map(function (tool) { return String(tool.name); });
    const matched = names.find(function (name) { return name === args.tool; }) ||
      names.find(function (name) { return name.endsWith("__" + args.tool); }) ||
      names.find(function (name) { return name.endsWith(args.tool); });
    if (matched) serverToolName = matched;
  } catch (error) {
    // tools/list 不可用时退回原名调用
  }

  const response = await request("tools/call", { name: serverToolName, arguments: toolArgs });
  clearTimeout(timer);

  const text = toTextContent(response && response.result);
  if (text === null) {
    console.error("响应里没有 text content（工具 " + serverToolName + "）");
    console.error(JSON.stringify(response).slice(0, 2000));
    child.kill();
    process.exit(4);
  }

  const absolute = path.resolve(args.out);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, text, "utf8");

  const isError = Boolean(response.result && response.result.isError);
  const bytes = Buffer.byteLength(text, "utf8");
  const sha256 = sha256Text(text);
  // provenance sidecar：与响应文件同一份字节算出哈希，随响应一起落盘（每次调用各写一份）。
  // egress 一律取调用方声明的值（见头部「约定」），脚本不探测、不设默认。
  const sidecarPath = absolute + ".provenance.json";
  fs.writeFileSync(sidecarPath, JSON.stringify({
    schemaVersion: "mastergo-mcp-capture-provenance/1",
    tool: args.tool,
    serverTool: serverToolName,
    fileId: args.fileId || null,
    layerId: args.layerId || null,
    out: absolute,
    sha256: sha256,
    bytes: bytes,
    egress: args.egress,
    fetchedAt: new Date().toISOString(),
    isError: isError,
  }, null, 2) + "\n", "utf8");

  // 只输出摘要：内容是整页 DSL / SVG，绝不进上下文
  console.log(JSON.stringify({
    tool: args.tool,
    serverTool: serverToolName,
    out: absolute,
    bytes: bytes,
    sha256: sha256,
    provenance: sidecarPath,
    isError: isError,
  }));
  shutdown(isError ? 5 : 0);
})().catch(function (error) {
  console.error(error && error.message ? error.message : String(error));
  if (stderrText) console.error("服务端 stderr: " + stderrText.slice(-400));
  shutdown(4);
});
