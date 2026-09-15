#!/usr/bin/env node
"use strict";

// 目标项目 .csproj 的读取与宿主路径推断：唯一实现。
// gen-mastergo-page-bundle.js 与 gen-mw-wpf-page.js 都调用这里；
// 这两处曾各写一份同样的算法，并已漂移过（ViewModel 目录匹配一处用 startsWith、一处用 includes）。
// scripts/tests/script-duplication.test.js 守护「同一个功能不许再复制一份」。

const fs = require("fs");
const path = require("path");
const { fail } = require("./script-helpers.js");

// .csproj 里已登记的 Page / Compile / Content（统一成 / 分隔）。
function csprojIncludes(csprojText) {
  const result = [];
  const re = /<(?:Page|Compile|Content)\s+Include=["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(csprojText)) !== null) result.push(match[1].replace(/\\/g, "/"));
  return result;
}

function existingProjectDirectory(projectRoot, relativePath) {
  return fs.existsSync(path.join(projectRoot, ...relativePath.split("/")));
}

// 推断新页面三件套的落盘目录（返回相对路径；校验由调用方按各自口径做）。
// 规则：显式清单优先 → 同区域 View 声明 → Pages/ 兜底 → UI/<area>/View。
// 依据见 references/adapters/mw-wpf/page-shell-generator.md。
function inferHostPaths(options) {
  const manifest = options.manifest || {};
  const projectRoot = options.projectRoot;
  const viewName = options.viewName;
  const viewModelName = options.viewModelName;
  const includes = csprojIncludes(options.csprojText || "");
  const explicitView = manifest.viewPath;
  const explicitCodeBehind = manifest.codeBehindPath;
  const explicitViewModel = manifest.viewModelPath;
  if ((explicitView && !explicitCodeBehind) || (!explicitView && explicitCodeBehind)) {
    fail("viewPath 与 codeBehindPath 必须同时提供");
  }
  if (explicitView || explicitCodeBehind || explicitViewModel) {
    return {
      view: explicitView || "UI/" + manifest.area + "/View/" + viewName + ".xaml",
      codeBehind: explicitCodeBehind || (explicitView + ".cs"),
      viewModel: explicitViewModel || "UI/" + manifest.area + "/ViewModel/" + viewModelName + ".cs"
    };
  }
  const area = String(manifest.area).replace(/\\/g, "/");
  const areaPrefix = "UI/" + area + "/View/";
  const viewMatch = includes.find(function (item) {
    return item.toLowerCase().startsWith(areaPrefix.toLowerCase()) && /\/View\/[^/]+\.xaml$/i.test(item);
  });
  const uiViewEvidence = includes.some(function (item) {
    return /^UI\/.+\/View\/[^/]+\.xaml$/i.test(item);
  });
  const pagesMatch = includes.find(function (item) {
    return /^Pages\/[^/]+\.xaml$/i.test(item) || /\/Pages\/[^/]+\.xaml$/i.test(item);
  });
  let viewDir;
  let viewModelDir;
  if (viewMatch) {
    viewDir = viewMatch.slice(0, viewMatch.lastIndexOf("/"));
    // 同区域（UI/<area>）下已登记的 ViewModel 声明优先，否则按同构目录推导。
    const areaRoot = viewDir.slice(0, viewDir.lastIndexOf("/View"));
    const vmMatch = includes.find(function (item) {
      return /\/ViewModel\/[^/]+\.cs$/i.test(item) &&
        item.toLowerCase().startsWith((areaRoot + "/ViewModel/").toLowerCase());
    });
    viewModelDir = vmMatch ? vmMatch.slice(0, vmMatch.lastIndexOf("/")) : viewDir.replace(/\/View$/i, "/ViewModel");
  } else if (pagesMatch) {
    viewDir = pagesMatch.slice(0, pagesMatch.lastIndexOf("/"));
    viewModelDir = viewDir;
  } else if (uiViewEvidence || existingProjectDirectory(projectRoot, "UI/" + area + "/View")) {
    viewDir = "UI/" + area + "/View";
    viewModelDir = existingProjectDirectory(projectRoot, "UI/" + area + "/ViewModel")
      ? "UI/" + area + "/ViewModel" : viewDir.replace(/\/View$/i, "/ViewModel");
  } else {
    viewDir = "Pages";
    viewModelDir = "Pages";
  }
  return {
    view: viewDir + "/" + viewName + ".xaml",
    codeBehind: viewDir + "/" + viewName + ".xaml.cs",
    viewModel: viewModelDir + "/" + viewModelName + ".cs"
  };
}

module.exports = { csprojIncludes: csprojIncludes, inferHostPaths: inferHostPaths };
