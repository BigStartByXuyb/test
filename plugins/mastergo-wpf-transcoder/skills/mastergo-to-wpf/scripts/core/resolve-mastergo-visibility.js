#!/usr/bin/env node
"use strict";

/*
 * Extract visibility facts from MasterGo DSL.
 *
 * This script does not generate IOContorl mapping. It produces an evidence
 * file for the mapper/AI: every discovered node gets the effective visibility
 * of a component slot only when its owning component exposes a boolean
 * display property. Text and PATH nodes are also indexed separately.
 */

const fs = require("fs");
const path = require("path");
// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const { readJson, failWithPrefix } = require(path.join(__dirname, "..", "lib", "script-helpers.js"));
const fail = failWithPrefix("MasterGo visibility audit failed");

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && (value === 0 || value === 1)) return value === 1;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "visible", "shown", "show"].includes(normalized)) return true;
  if (["false", "0", "hidden", "hide", "collapsed"].includes(normalized)) return false;
  return null;
}

function nodeRef(node, fallback) {
  for (const key of ["ref", "id", "layerId", "nodeId"]) {
    if (typeof node[key] === "string" && node[key]) return node[key];
  }
  return fallback;
}

function nodeType(node) {
  return node.type || node.nodeType || node.t || null;
}

function nodeName(node) {
  return node.name || node.nodeName || node.n || null;
}

function nodeText(node) {
  for (const key of ["text", "characters", "content"]) {
    if (typeof node[key] === "string") return node[key];
    if (Array.isArray(node[key])) {
      const parts = node[key].map(item => item && typeof item.text === "string" ? item.text : "").filter(Boolean);
      if (parts.length > 0) return parts.join("");
    }
  }
  return null;
}

function normalizedPropertyKey(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function componentProperties(node) {
  const componentInfo = node && node.componentInfo && node.componentInfo.properties;
  return componentInfo && typeof componentInfo === "object" ? componentInfo : null;
}

function slotVisibility(controller, target, isDirectChild) {
  const properties = componentProperties(controller);
  if (!properties) return null;
  const type = String(nodeType(target) || "").toUpperCase();
  const text = nodeText(target) || nodeName(target) || "";
  const isText = type === "TEXT";
  const isPath = type === "PATH";
  const entries = Object.entries(properties);
  const textKey = entries.find(([key]) => /显示(文案|文本|文字)/.test(normalizedPropertyKey(key)));
  const shortcutKey = entries.find(([key]) => /显示(f|快捷标记|快捷键)/.test(normalizedPropertyKey(key)));
  const titleKey = isDirectChild && entries.find(([key]) => /显示(主标题|左侧副标题)/.test(normalizedPropertyKey(key)));
  const iconKey = entries.find(([key]) => /显示(icon|图标)/.test(normalizedPropertyKey(key)));
  let preferred = null;
  if (isText && /^f\d+$/i.test(String(text).trim())) preferred = shortcutKey;
  else if (isText && titleKey) preferred = titleKey;
  else if (isText) preferred = textKey;
  else if (isPath) preferred = iconKey;
  if (preferred) {
    const parsed = parseBoolean(preferred[1]);
    if (parsed !== null) return { value: parsed, property: `componentInfo.properties.${preferred[0]}`, raw: preferred[1], sourceRef: nodeRef(controller, null) };
  }
  return null;
}

const CHILD_KEYS = ["children", "nodes", "c", "layers", "items"];

function childEntries(node) {
  const result = [];
  for (const key of CHILD_KEYS) {
    if (!Array.isArray(node[key])) continue;
    for (const child of node[key]) result.push({ key, child });
  }
  return result;
}

function looksLikeNode(value) {
  return value && typeof value === "object" && !Array.isArray(value) && (
    typeof value.type === "string" || typeof value.nodeType === "string" ||
    typeof value.t === "string" || typeof value.id === "string" ||
    typeof value.ref === "string" || typeof value.layerId === "string"
  );
}

function collectNodes(input) {
  const result = [];
  const visited = new Set();
  const source = input && input.dsl && Array.isArray(input.dsl.nodes) ? input.dsl : input;
  const root = source && Array.isArray(source.nodes) ? source.nodes : source;

  function visit(value, parent, containerPath, ancestors) {
    if (!value || typeof value !== "object") return;
    if (visited.has(value)) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, parent, containerPath + "[" + index + "]", ancestors));
      return;
    }
    if (!looksLikeNode(value)) {
      Object.keys(value).forEach(key => visit(value[key], parent, containerPath + "." + key, ancestors));
      return;
    }

    visited.add(value);
    const ref = nodeRef(value, containerPath);
    let slotControl = null;
    for (let index = ancestors.length - 1; index >= 0; index -= 1) {
      slotControl = slotVisibility(ancestors[index].raw, value, parent && ancestors[index].record.ref === parent.ref);
      if (slotControl) break;
    }
    const controller = slotControl;
    const record = {
      ref,
      parentRef: parent ? parent.ref : null,
      type: nodeType(value),
      name: nodeName(value),
      text: nodeText(value),
      explicitVisible: controller ? controller.value : null,
      visibilityProperty: controller ? controller.property : null,
      visibilityRaw: controller ? controller.raw : null,
      defaultVisible: controller === null,
      effectiveVisible: null,
      visibilitySourceRef: null,
      sourcePath: containerPath
    };
    record.effectiveVisible = controller ? controller.value : (parent ? parent.effectiveVisible : true);
    if (parent && parent.effectiveVisible === false) {
      record.effectiveVisible = false;
      record.visibilitySourceRef = parent.visibilitySourceRef || parent.ref;
    } else if (controller) {
      record.visibilitySourceRef = controller.sourceRef || record.ref;
    } else if (parent && parent.visibilitySourceRef) {
      record.visibilitySourceRef = parent.visibilitySourceRef;
    }
    result.push(record);
    const nextAncestors = ancestors.concat([{ raw: value, record }]);
    for (const entry of childEntries(value)) visit(entry.child, record, containerPath + "." + entry.key, nextAncestors);
  }

  visit(root, null, "$root", []);
  return result;
}

function main() {
  const argv = process.argv.slice(2);
  let inputPath = null;
  let outputPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") inputPath = argv[++index];
    else if (argv[index] === "--out") outputPath = argv[++index];
    else fail("usage: node resolve-mastergo-visibility.js --input <dsl.json> --out <visibility.json>");
  }
  if (!inputPath || !outputPath) fail("usage: node resolve-mastergo-visibility.js --input <dsl.json> --out <visibility.json>");

  const nodes = collectNodes(readJson(inputPath));
  const output = {
    schemaVersion: "mastergo-visibility-audit/1",
    input: path.resolve(inputPath),
    nodeCount: nodes.length,
    nodes,
    texts: nodes.filter(node => node.type === "TEXT" || node.type === "text"),
    paths: nodes.filter(node => node.type === "PATH" || node.type === "path")
  };
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ output: path.resolve(outputPath), nodeCount: output.nodeCount, textCount: output.texts.length, pathCount: output.paths.length }, null, 2));
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { collectNodes, parseBoolean };
