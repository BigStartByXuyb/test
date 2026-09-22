#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { collectNodes } = require("../core/resolve-mastergo-visibility.js");

const nodes = collectNodes({
  type: "INSTANCE",
  id: "button",
  visible: false,
  componentInfo: { properties: { "显示文案": true, "显示F": false, "显示icon": true } },
  children: [
    { type: "TEXT", id: "label", text: "按钮", properties: { visible: false } },
    { type: "TEXT", id: "f", text: "F1", properties: { visible: true } },
    { type: "PATH", id: "icon", properties: { visible: false } },
    { type: "TEXT", id: "title", text: "标题", properties: { visible: false } }
  ]
});

const byId = new Map(nodes.map(node => [node.ref, node]));
assert.strictEqual(byId.get("label").effectiveVisible, true);
assert.strictEqual(byId.get("f").effectiveVisible, false);
assert.strictEqual(byId.get("icon").effectiveVisible, true);
assert.strictEqual(byId.get("title").effectiveVisible, true);

const inherited = collectNodes({
  type: "INSTANCE",
  id: "hidden-parent",
  componentInfo: { properties: { "显示文案": false } },
  children: [{ type: "TEXT", id: "child", text: "仍然隐藏" }]
});
assert.strictEqual(inherited.find(node => node.ref === "child").effectiveVisible, false);

const ignoredNodeVisibility = collectNodes({
  type: "INSTANCE",
  id: "plain-node",
  visible: false,
  children: [{ type: "TEXT", id: "plain-text", text: "仍然显示", visible: false }]
});
assert.strictEqual(ignoredNodeVisibility.find(node => node.ref === "plain-text").effectiveVisible, true);

const snapshotNodes = collectNodes({
  schemaVersion: "mastergo-dsl-snapshot/2",
  layerId: "page",
  dsl: {
    nodes: [{ type: "INSTANCE", id: "page", children: [{ type: "TEXT", id: "page-title", text: [{ text: "页面" }] }] }]
  }
});
assert.deepStrictEqual(snapshotNodes.map(node => node.ref), ["page", "page-title"]);

console.log("PASS MasterGo visibility resolver regression test");
