#!/usr/bin/env node
"use strict";

// 通过 stdio 调用 MasterGo MCP，并把响应内容直接落盘。
// 设计目的：整页 DSL / SVG 响应绝不进入模型上下文——stdout 只打印一行摘要 JSON。
//
// 用法:
//   node call-mastergo-mcp.js --tool getDsl --fileId <fileId> --layerId <layerId> [--format json] \
//        --out <runDir>/getDsl.json [--token mg_xxx] [--url https://mastergo.com]
//
//   node call-mastergo-mcp.js --tool extractSvg --fileId <fileId> --layerId <layerId> \
//        --page 0 --pageSize 100 --out <runDir>/extractSvg.json
//
//   node call-mastergo-mcp.js --list-tools          # 只列出服务端可用工具名（不落盘）
//
// 约定:
//   - token 优先取 --token，其次取环境变量 MASTERGO_MCP_TOKEN；绝不写入产物。
//   - 只用 --out 指定文件承载响应内容；脚本不把响应打到 stdout/stderr。
//   - 需要比对服务端工具名时，脚本会先 tools/list，匹配 "getDsl" / "mcp__getDsl" 等前缀形式。

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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
  armTimeout();
  const id = nextId;
  nextId += 1;
  return new Promise(function (resolve, reject) {
    pending.set(id, { resolve: resolve, reject: reject });
    send({ jsonrpc: "2.0", id: id, method: method, params: params });
  });
}

// 管道分块不保证落在字符边界；让流解码器保留跨块的 UTF-8 字节。
// 逐块 Buffer.toString 会把被拆开的中文/补充平面字符永久替换成 U+FFFD。
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stderr.on("data", function (chunk) { stderrText += chunk; });
child.stdout.on("data", function (chunk) {
  stdoutBuffer += chunk;
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
        if (message.error) entry.reject(new Error("MCP 调用失败（JSON-RPC error）"));
        else entry.resolve(message);
      }
    }
    index = stdoutBuffer.indexOf("\n");
  }
});

const timeoutMs = Number(args.timeoutMs || 240000);
// A fresh timeout budget for each RPC, including every SVG page. Never log server payloads.
let timer = null;
function armTimeout() {
  clearTimeout(timer);
  timer = setTimeout(function () {
    console.error("MCP 调用超时 " + timeoutMs + "ms");
    try { child.kill(); } catch (error) { /* ignore */ }
    process.exit(3);
  }, timeoutMs);
}

// extractSvg 是分页接口（服务端 pageSize 上限 100）：只取第一页会让 >100 个图标的页面静默漏条目。
// 这里把上限做成显式常量，防御服务端 hasMore 永真的情况（宁可失败，也不无限拉）。
const MAX_SVG_PAGES = 100;

function toTextContent(result) {
  const content = result && Array.isArray(result.content) ? result.content : [];
  const textParts = content.filter(function (item) { return item && item.type === "text"; });
  // 多个 text 块没有本地拼接协议：不能只取第一块、也不能猜测如何拼接 JSON。
  if (textParts.length !== 1 || typeof textParts[0].text !== "string") return null;
  return textParts[0].text;
}

// 结束子进程并保证本进程一定退出（shell:true 时子进程可能持有管道，导致事件循环不空）
function shutdown(exitCode) {
  clearTimeout(timer);
  try { child.stdin.end(); } catch (error) { /* ignore */ }
  try { child.stdout.destroy(); } catch (error) { /* ignore */ }
  try { child.stderr.destroy(); } catch (error) { /* ignore */ }
  try { child.kill(); } catch (error) { /* ignore */ }
  // 不能 unref：unref 的定时器不阻止事件循环退出，进程会在定时器触发前以 0 退出，
  // 于是 isError / payloadError 的失败码被吞掉（run-all 会把"取数失败"当成成功）。
  setTimeout(function () { process.exit(exitCode); }, 120);
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

  const text = toTextContent(response && response.result);
  if (text === null) {
    console.error("响应必须包含且仅包含一个字符串 text content（工具 " + serverToolName + "）；响应形态不受本地采集契约支持，未覆盖输出文件");
    // 错误分支也不得把 DSL、图像或资源内容回显到模型上下文。
    shutdown(4);
    return;
  }

  function responseError(result, payload) {
    if (result && result.isError) return "MCP result.isError=true";
    let data;
    try { data = JSON.parse(payload); } catch (_) { return null; }
    if (!data || data.code === undefined || data.code === null) return null;
    const code = String(data.code).trim();
    if (["", "0", "200"].includes(code)) return null;
    return "MCP 返回错误码 " + (/^-?[0-9]{1,12}$/.test(code) ? code : "invalid");
  }
  const isError = Boolean(response.result && response.result.isError);
  const payloadError = responseError(response.result, text);
  const absolute = path.resolve(args.out);
  if (payloadError) {
    console.error(payloadError + "（未覆盖输出文件）");
    console.log(JSON.stringify({ tool: args.tool, out: absolute, isError, payloadError }));
    shutdown(5);
    return;
  }

  let outputText = text;
  let svgPaging = null;
  if (args.tool === "extractSvg") {
    const pageSize = Number(toolArgs.pageSize || 100);
    let page = Number(toolArgs.page || 0);
    if (page !== 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new Error("extractSvg 完整采集要求 page=0，pageSize 是 1..100 的整数");
    }
    let current = response;
    let payload = text;
    let merged = null;
    const ids = new Set();
    let pagesFetched = 0;
    for (;;) {
      const error = responseError(current.result, payload);
      if (error) throw new Error(error + "（分页失败，未覆盖输出文件）");
      let data;
      try { data = JSON.parse(payload); } catch (_) { throw new Error("extractSvg 返回无效 JSON"); }
      if (!data || !Array.isArray(data.svgs) || typeof data.hasMore !== "boolean" ||
          !Number.isSafeInteger(data.totalCount) || data.totalCount < 0) {
        throw new Error("extractSvg 必须提供 svgs、boolean hasMore 和非负整数 totalCount");
      }
      if (data.page !== undefined && data.page !== page) throw new Error("extractSvg 响应 page 与请求不一致");
      if (data.count !== undefined && data.count !== data.svgs.length) throw new Error("extractSvg count 与 svgs 条数不一致");
      if (!merged) merged = { ...data, svgs: [] };
      if (data.totalCount !== merged.totalCount) throw new Error("extractSvg 分页 totalCount 变化，需重新采集");
      for (const svg of data.svgs) {
        if (!svg || typeof svg.id !== "string" || !svg.id || ids.has(svg.id)) {
          throw new Error("extractSvg 条目缺少唯一 id 或分页重复");
        }
        ids.add(svg.id);
        merged.svgs.push(svg);
      }
      pagesFetched += 1;
      if (merged.svgs.length > merged.totalCount || (data.hasMore && data.svgs.length === 0)) {
        throw new Error("extractSvg 分页状态无进展或超过 totalCount");
      }
      if (!data.hasMore) break;
      if (pagesFetched >= MAX_SVG_PAGES) throw new Error("extractSvg 分页超过上限 " + MAX_SVG_PAGES);
      page += 1;
      current = await request("tools/call", { name: serverToolName, arguments: { ...toolArgs, page } });
      payload = toTextContent(current && current.result);
      if (payload === null) throw new Error("extractSvg 分页必须包含一个字符串 text content");
    }
    if (merged.svgs.length !== merged.totalCount) throw new Error("extractSvg 分页聚合不完整");
    Object.assign(merged, { count: merged.svgs.length, page: 0, pageSize, hasMore: false, pagesFetched });
    outputText = JSON.stringify(merged);
    svgPaging = { pages: pagesFetched, entries: merged.svgs.length, totalCount: merged.totalCount };
  }

  // Existing getDsl bytes are immutable. Identical replay is harmless; replacement requires archival.
  const bytes = Buffer.from(outputText, "utf8");
  const immutable = args.tool === "getDsl";
  if (immutable && fs.existsSync(absolute)) {
    if (!fs.readFileSync(absolute).equals(bytes)) throw new Error("原始 getDsl 采集已存在且内容不同；请归档旧运行，未覆盖输出文件");
  } else {
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    const temp = absolute + ".tmp-" + require("crypto").randomUUID();
    try {
      fs.writeFileSync(temp, bytes, { flag: "wx" });
      if (immutable) fs.linkSync(temp, absolute); // atomic create, never replace a competing capture
      else fs.renameSync(temp, absolute);
    } finally {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
  }
  // 只输出摘要：内容是整页 DSL / SVG，绝不进上下文
  console.log(JSON.stringify({
    tool: args.tool,
    serverTool: serverToolName,
    out: absolute,
    bytes: Buffer.byteLength(outputText, "utf8"),
    isError: isError,
    payloadError: payloadError || null,
    svgPaging: svgPaging,
  }));
  shutdown(isError || payloadError ? 5 : 0);
})().catch(function (error) {
  console.error(error && error.message ? error.message : String(error));

  shutdown(4);
});
