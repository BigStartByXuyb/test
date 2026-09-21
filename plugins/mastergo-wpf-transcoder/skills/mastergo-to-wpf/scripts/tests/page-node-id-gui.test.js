#!/usr/bin/env node
"use strict";
// GUI（tools/page-node-id-gui）回归：链接解析 / 页面帧发现 / 控件定位 / 离线端到端。
// 硬约束：GUI 给出的 ID 必须等于 lib/page-node-id.js 的派生值（与转码器同一份公式），
// 且控件链接只有在已知页面帧时才能给出页面一致的 ID。

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { pageKeyOf, derivePageNodeId } = require("../lib/page-node-id.js");
const { extractXmlChunk } = require("../lib/iocontrol-xml-chunk.js");
const {
  parseLink,
  findNodesByLayerId,
  isPageLevelLink,
  describeCaptureFailure,
  discoverFrames
} = require("../../../../tools/page-node-id-gui/lib/resolve-target.js");

const GUI_DIR = path.resolve(__dirname, "..", "..", "..", "..", "tools", "page-node-id-gui");
const SERVER = path.join(GUI_DIR, "server.js");

// 1) 链接解析：真实链接形态
{
  const full = parseLink("https://mastergo.com/goto/Webz0369?page_id=4:4&layer_id=79:162125&file=181586559903927");
  assert.deepStrictEqual(full, { fileId: "181586559903927", layerId: "79:162125", pageId: "4:4" });
  const pageOnly = parseLink("https://mastergo.com/goto/WebD2PLd?page_id=4:0&file=181586559903927");
  assert.strictEqual(pageOnly.layerId, "", "只有 page_id 时不得编造 layer_id");
  assert.strictEqual(pageOnly.pageId, "4:0");
  const bare = parseLink(" 1158:251921 ");
  assert.strictEqual(bare.layerId, "1158:251921", "允许直接贴 layer_id");
  const encoded = parseLink("https://mastergo.com/goto/x?file=1&layer_id=79%3A162125");
  assert.strictEqual(encoded.layerId, "79:162125", "layer_id 需要 URL 解码");
}

// 1.1) 页面链接要能被识别；引擎的"空节点"失败要能翻译成给人看的原因（按 ASCII 标记匹配，中文乱码也不失效）
{
  const pageLink = parseLink("https://mastergo.com/goto/x?page_id=4:0&layer_id=4:0&file=181586559903927");
  assert.ok(isPageLevelLink(pageLink), "page_id == layer_id 必须判定为页面链接");
  const frameLink = parseLink("https://mastergo.com/goto/x?page_id=4:4&layer_id=79:162125&file=181586559903927");
  assert.ok(!isPageLevelLink(frameLink), "容器链接不得被误判成页面链接");

  const garbled = "MasterGo getDsl " + String.fromCharCode(0xFFFD) + "Ӧ" + String.fromCharCode(0xFFFD)
    + " dsl.nodes[] " + String.fromCharCode(0xFFFD) + "Ϊ" + String.fromCharCode(0xFFFD);
  const failure = describeCaptureFailure(garbled, "4:0");
  assert.strictEqual(failure.code, "EMPTY_DSL", "空节点失败必须被识别（中文乱码也要能匹配）");
  assert.ok(failure.hint.indexOf("页面") > 0, "提示必须点出「页面链接」这个最常见原因");
  assert.strictEqual(describeCaptureFailure("boom: network down", "x").code, "CAPTURE_FAILED");
}

// 2) 控件定位：同 layer_id 多个命中时取最靠上层
{
  const nodes = [
    { ref: "1158:250712/261:131374", layerId: "261:131374" },
    { ref: "261:131374", layerId: "261:131374" },
    { ref: "1158:251921", layerId: "1158:251921" }
  ];
  assert.strictEqual(findNodesByLayerId(nodes, "261:131374")[0].ref, "261:131374");
  assert.strictEqual(findNodesByLayerId(nodes, "不存在").length, 0);
}

// 2.1) 控件代码片段：自闭合控件只取自己（不得吞掉相邻控件），容器控件整棵子树完整
{
  const pageXml = [
    "    <IOContorl",
    '        ID="MX_a"',
    '        ControlType="IconButton"',
    '        Width="170" />',
    "    <IOContorl",
    '        ID="MX_b"',
    '        ControlType="DataGrid">',
    "        <IOContorl",
    '            ID="MX_b1"',
    '            ControlType="NumberBox" />',
    "        <IOContorl",
    '            ID="MX_b2"',
    '            ControlType="NumberBox" />',
    "    </IOContorl>",
    "    <IOContorl",
    '        ID="MX_c"',
    '        ControlType="TextBlock" />'
  ].join("\n");
  const selfClosing = extractXmlChunk(pageXml, "MX_a");
  assert.ok(selfClosing.startsWith("<IOContorl"), "片段必须从控件自己的标签开始");
  assert.ok(selfClosing.endsWith('Width="170" />'), "自闭合控件必须只取它自己");
  assert.ok(selfClosing.indexOf("MX_b") < 0, "不得吞掉后面的相邻控件");
  const container = extractXmlChunk(pageXml, "MX_b");
  assert.ok(container.startsWith("<IOContorl"), "容器片段也必须从自己的标签开始");
  assert.ok(container.indexOf("MX_b2") > 0, "容器控件必须带全部子节点");
  assert.ok(container.endsWith("</IOContorl>"), "容器控件必须以自己的闭合标签结束");
  assert.strictEqual(extractXmlChunk(pageXml, "MX_none"), "", "取不到时必须给空串");
}

// 3) 页面帧发现：从工程里的 page-registry.json / manifest.json 找
{
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "gui-project-"));
  fs.mkdirSync(path.join(project, "docs"), { recursive: true });
  fs.mkdirSync(path.join(project, "Generated"), { recursive: true });
  fs.writeFileSync(path.join(project, "docs", "page-registry.json"), JSON.stringify({
    schemaVersion: "mastergo-page-registry/1",
    pages: [{ target: "F2ContinuousRunData", designSource: { fileId: "181586559903927", pageId: "4:4", layerId: "79:162125", designPageName: "连续运行数据（3.1.8.NS）" } }]
  }), "utf8");
  fs.writeFileSync(path.join(project, "Generated", "dsl.snapshot.json"), "{}", "utf8");
  const frames = discoverFrames([project], { maxDepth: 3 });
  assert.strictEqual(frames.length, 1, "应发现 1 个页面帧: " + JSON.stringify(frames));
  assert.strictEqual(frames[0].fileId, "181586559903927");
  assert.strictEqual(frames[0].layerId, "79:162125");
  assert.ok(frames[0].snapshotPath.endsWith("dsl.snapshot.json"), "应带上本地快照路径（离线优先）");
}

// 4) 离线端到端：起服务（--snapshot）→ 控件链接 / 容器链接 / 只有 page_id
const PAGE_KEY = "79:162125";
const fixture = {
  schemaVersion: "mastergo-dsl-run/2",
  runId: "gui-test",
  captureMode: "mcp.getDsl",
  fileId: "181586559903927",
  layerId: PAGE_KEY,
  pageName: "连续运行数据（3.1.8.NS）",
  ui: "F2",
  format: "json",
  nodeCount: 3,
  dsl: {
    styles: {},
    nodes: [{
      type: "COMPONENT",
      id: PAGE_KEY,
      name: "连续运行数据（3.1.8.NS）",
      layoutStyle: { width: 1280, height: 1028, relativeX: 0, relativeY: 0 },
      children: [{
        type: "INSTANCE",
        id: "1158:251921",
        name: "右侧栏",
        layoutStyle: { width: 170, height: 80, relativeX: 1090, relativeY: 606 },
        children: [{
          type: "TEXT",
          id: "1158:251921/2221:228393/1066:249745",
          name: "固定文本框",
          layoutStyle: { width: 82, height: 24, relativeX: 72, relativeY: 29 },
          text: [{ text: "ENTER" }]
        }]
      }]
    }],
    components: []
  },
  componentDocumentLinks: [],
  rules: []
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gui-e2e-"));
const snapshotPath = path.join(dir, "dsl.snapshot.json");
fs.writeFileSync(snapshotPath, JSON.stringify(fixture), "utf8");

function postJson(port, body) {
  return new Promise(function (resolve, reject) {
    const data = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port: port,
      path: "/api/resolve",
      method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) }
    }, function (response) {
      let text = "";
      response.on("data", function (chunk) { text += chunk; });
      response.on("end", function () {
        try {
          resolve({ status: response.statusCode, body: text ? JSON.parse(text) : null });
        } catch (error) {
          reject(new Error("响应不是 JSON: " + text.slice(0, 200)));
        }
      });
    });
    request.on("error", reject);
    request.write(data);
    request.end();
  });
}

async function main() {
  const server = spawn(process.execPath, [SERVER, "--snapshot", snapshotPath, "--port", "0", "--no-open"], { encoding: "utf8" });
  let stdout = "";
  try {
    const port = await new Promise(function (resolve, reject) {
      const timer = setTimeout(function () { reject(new Error("GUI 服务启动超时：" + stdout)); }, 30000);
      server.stdout.on("data", function (chunk) {
        stdout += chunk;
        const match = /listening (\d+)/.exec(stdout);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      server.on("exit", function (code) { reject(new Error("GUI 服务提前退出 code=" + code + "：" + stdout)); });
    });

    // 4.1 控件链接（嵌套 TEXT）→ 单控件，ID 必须等于页面帧口径
    const single = await postJson(port, {
      link: "https://mastergo.com/goto/x?page_id=4:4&layer_id=1066:249745&file=181586559903927"
    });
    assert.strictEqual(single.status, 200, JSON.stringify(single.body));
    assert.strictEqual(single.body.mode, "single", "已知页面帧时必须直接给这一个控件");
    assert.strictEqual(single.body.target.ref, "1158:251921/2221:228393/1066:249745");
    assert.strictEqual(single.body.target.id, derivePageNodeId(PAGE_KEY, "1158:251921/2221:228393/1066:249745"));
    assert.strictEqual(single.body.target.xml, "", "未登记映射的控件只给 ID，不给代码");

    // 4.2 控件链接（顶层 INSTANCE）= 与真实工程产物一致的 ID
    const instance = await postJson(port, {
      link: "https://mastergo.com/goto/x?page_id=4:4&layer_id=1158:251921&file=181586559903927"
    });
    assert.strictEqual(instance.body.mode, "single");
    assert.strictEqual(instance.body.target.id, "MX_87871d1bac7e30e9361d15bd5b28d4a4", "右侧栏的 ID 必须与 F2 工程产物一致");

    // 4.3 容器（页面帧）链接 → 列出容器内控件
    const container = await postJson(port, {
      link: "https://mastergo.com/goto/x?page_id=4:4&layer_id=" + PAGE_KEY + "&file=181586559903927"
    });
    assert.strictEqual(container.body.mode, "container");
    assert.strictEqual(container.body.capture.pageKey, pageKeyOf(fixture));
    assert.strictEqual(container.body.nodes.length, 3);
    assert.strictEqual(container.body.nodes[1].id, "MX_87871d1bac7e30e9361d15bd5b28d4a4");

    // 4.4 只有 page_id → 必须报错，不得猜
    const bad = await postJson(port, { link: "https://mastergo.com/goto/x?page_id=4:4&file=181586559903927" });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual(bad.body.error.code, "NEED_LAYER");

    // 4.5 页面链接（page_id 被当成 layer_id）→ 必须在取设计稿之前就拦住，给出可执行的提示
    const pageLink = await postJson(port, { link: "https://mastergo.com/goto/x?page_id=4:4&layer_id=4:4&file=181586559903927" });
    assert.strictEqual(pageLink.status, 400);
    assert.strictEqual(pageLink.body.error.code, "PAGE_LINK");
    assert.ok(pageLink.body.error.hint.indexOf("容器") > 0, "提示要告诉用户该选容器/控件");
    server.kill();
  } catch (error) {
    server.kill();
    throw error;
  }
}

main().then(function () {
  for (const name of ["index.html", "style.css", "app.js"]) {
    assert.ok(fs.existsSync(path.join(GUI_DIR, "public", name)), "缺少 public/" + name);
  }
  assert.ok(fs.readFileSync(path.join(GUI_DIR, "public", "index.html"), "utf8").indexOf("/app.js") > 0);
  console.log("PASS 控件 ID 查询 GUI（链接解析 + 页面帧发现 + 离线端到端）");
}).catch(function (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
