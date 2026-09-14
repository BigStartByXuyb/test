#!/usr/bin/env node
"use strict";

// 一次编排 MTSLG 页面 XML、页面 Icon、Layout 和 MaxWell WPF 宿主壳。
// 具体控件、文本、坐标、Icon 名称和 Layout 字段必须已经在输入清单中确认。

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT_DIR = __dirname;
const XML_SCRIPT = path.join(SCRIPT_DIR, "gen-iocontrol-xml.js");
const ICON_SCRIPT = path.join(SCRIPT_DIR, "gen-mtslg-page-icons.js");
const LAYOUT_SCRIPT = path.join(SCRIPT_DIR, "gen-mtslg-layout.js");
const HOST_SCRIPT = path.join(SCRIPT_DIR, "gen-mw-wpf-page.js");
const PROVENANCE_SCRIPT = path.join(SCRIPT_DIR, "validate-iocontrol-provenance.js");
const COORDS_SCRIPT = path.join(SCRIPT_DIR, "check-iocontrol-coords.js");
const MAPPING_SCRIPT = path.join(SCRIPT_DIR, "gen-mtslg-mapping-from-dsl.js");
const TEMPLATE_RESOLVER_SCRIPT = path.join(SCRIPT_DIR, "resolve-mtslg-template-mapping.js");
const ICON_DISCOVERY_SCRIPT = path.join(SCRIPT_DIR, "discover-mtslg-page-icon-map.js");
const LANG_SCRIPT = path.join(SCRIPT_DIR, "gen-mtslg-page-lang.js");
const LANG = require("./gen-mtslg-page-lang");
const LANG_KEYS_SCRIPT = path.join(SCRIPT_DIR, "gen-mtslg-lang-keys-from-dsl.js");
const LANG_KEYS = require("./gen-mtslg-lang-keys-from-dsl");
const DEFAULT_TEMPLATE_MAP = path.resolve(SCRIPT_DIR, "..", "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
const NEW_PAGE_MAPPING_TAG = "新页面完整DSL映射";

// MTSLG 页面产物路径约定（与目标项目真实结构一致）：
//   Resources/Pages/<页面名>/<页面名>Page.xml
//   Resources/Pages/<页面名>/<页面名>Icons.xaml
//   Resources/Layout/Layout.xml
// 每个页面独占一个目录，页面 XML 与页面 Icon 同目录；View/ViewModel 仍在 UI/<区域>/ 下。
const PAGE_ROOT = "Resources/Pages";
const LAYOUT_DIR = "Resources/Layout";
const DEFAULT_LAYOUT_PATH = LAYOUT_DIR + "/Layout.xml";
function pageFolderFor(pageName) { return PAGE_ROOT + "/" + pageName; }
function defaultPageXmlPath(pageName) { return pageFolderFor(pageName) + "/" + pageName + "Page.xml"; }
function defaultIconPath(pageName) { return pageFolderFor(pageName) + "/" + pageName + "Icons.xaml"; }
function defaultLangPath(pageName, locale) { return pageFolderFor(pageName) + "/" + pageName + "_" + locale + ".xaml"; }
function pageLangPaths(pageName, locales) {
  return locales.map(function (locale) { return defaultLangPath(pageName, locale); });
}

function fail(message) { throw new Error(message); }

// 坐标度量的数值归一化：与 validate-iocontrol-provenance.js 的 num() 同为 Number() 口径（比
// check-iocontrol-coords.js 的 parseFloat() 更严格）——数值字符串（如 "100"）视为数值，
// 空值或无法归一化的值返回 null（= 缺度量）；归一化后的数值再交给坐标核对器。
function coordNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseArgs(argv) {
  let manifestPath = null;
  let overwrite = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--manifest") manifestPath = argv[++i];
    else if (argv[i] === "--overwrite") overwrite = true;
    else {
      console.error("用法: node gen-mastergo-page-bundle.js --manifest <bundle.json> [--overwrite]");
      process.exit(2);
    }
  }
  if (!manifestPath) {
    console.error("用法: node gen-mastergo-page-bundle.js --manifest <bundle.json> [--overwrite]");
    process.exit(2);
  }
  return { manifestPath, overwrite };
}

function normalizePageManifest(manifest) {
  const name = manifest.name || manifest.pageName;
  if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    fail("manifest 必须提供合法页面 name（或兼容字段 pageName）");
  }
  if (manifest.name && manifest.pageName && manifest.name !== manifest.pageName) {
    fail("manifest.name 与 manifest.pageName 必须一致");
  }
  if (typeof manifest.area !== "string" || !manifest.area.trim()) {
    fail("新页面必须提供 area");
  }

  const existingMode = ["modify-existing", "replace-existing"].includes(manifest.operation);
  const expected = {
    pageXmlPath: defaultPageXmlPath(name),
    iconPath: defaultIconPath(name),
    viewPath: "UI/" + manifest.area.replace(/\\/g, "/") + "/View/" + name + "View.xaml",
    codeBehindPath: "UI/" + manifest.area.replace(/\\/g, "/") + "/View/" + name + "View.xaml.cs",
    viewModelPath: "UI/" + manifest.area.replace(/\\/g, "/") + "/ViewModel/" + name + "ViewModel.cs"
  };
  if (!existingMode) {
    for (const field of Object.keys(expected)) {
      if (manifest[field] && manifest[field].replace(/\\/g, "/") !== expected[field]) {
        fail("新建页面的 " + field + " 必须使用约定路径: " + expected[field]);
      }
    }
  }
  manifest.name = name;
  manifest.pageName = name;
  manifest.viewName = manifest.viewName || name + "View";
  manifest.viewModelName = manifest.viewModelName || name + "ViewModel";
  manifest.xmlPageName = manifest.xmlPageName || name + "Page";
  manifest.pageXmlPath = manifest.pageXmlPath || expected.pageXmlPath;
  manifest.iconPath = manifest.iconPath || expected.iconPath;
  manifest.viewPath = manifest.viewPath || expected.viewPath;
  manifest.codeBehindPath = manifest.codeBehindPath || expected.codeBehindPath;
  manifest.viewModelPath = manifest.viewModelPath || expected.viewModelPath;
  manifest.layoutPath = manifest.layoutPath || DEFAULT_LAYOUT_PATH;
  return manifest;
}

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch (error) { fail("读取 JSON 失败: " + filePath + " - " + error.message); }
}

function resolvePath(base, value, field) {
  if (typeof value !== "string" || !value.trim()) fail(field + " 必须提供");
  const result = path.resolve(base, value);
  const root = path.resolve(base) + path.sep;
  if (result !== path.resolve(base) && !result.startsWith(root)) {
    fail(field + " 必须位于项目根目录内: " + value);
  }
  return result;
}

function resolveInput(manifestDir, projectRoot, value, field) {
  if (path.isAbsolute(value)) return path.resolve(value);
  const fromManifest = path.resolve(manifestDir, value);
  if (fs.existsSync(fromManifest)) return fromManifest;
  return resolvePath(projectRoot, value, field);
}

function xmlAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function projectRelative(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function scaffoldName(value, fallback) {
  const candidate = String(value || fallback || "Project").replace(/[^A-Za-z0-9_.-]/g, "_");
  return /^[A-Za-z_]/.test(candidate) ? candidate : "Project_" + candidate;
}

function scaffoldCsproj(rootNamespace, assemblyName) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Project ToolsVersion="15.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">',
    '  <Import Project="$(MSBuildExtensionsPath)\\$(MSBuildToolsVersion)\\Microsoft.Common.props" Condition="Exists(\'$(MSBuildExtensionsPath)\\$(MSBuildToolsVersion)\\Microsoft.Common.props\')" />',
    '  <PropertyGroup>',
    '    <Configuration Condition=" \'$(Configuration)\' == \'\' ">Debug</Configuration>',
    '    <Platform Condition=" \'$(Platform)\' == \'\' ">AnyCPU</Platform>',
    '    <OutputType>Library</OutputType>',
    '    <RootNamespace>' + xmlAttr(rootNamespace) + '</RootNamespace>',
    '    <AssemblyName>' + xmlAttr(assemblyName) + '</AssemblyName>',
    '    <TargetFrameworkVersion>v4.6.1</TargetFrameworkVersion>',
    '    <FileAlignment>512</FileAlignment>',
    '    <Deterministic>true</Deterministic>',
    '  </PropertyGroup>',
    '  <ItemGroup>',
    '    <Reference Include="PresentationCore" />',
    '    <Reference Include="PresentationFramework" />',
    '    <Reference Include="System" />',
    '    <Reference Include="System.Core" />',
    '    <Reference Include="System.Xaml" />',
    '    <Reference Include="WindowsBase" />',
    '  </ItemGroup>',
    '  <Import Project="$(MSBuildToolsPath)\\Microsoft.CSharp.targets" />',
    '</Project>',
    ''
  ].join('\n');
}

function scaffoldFrameworkConfig(manifest) {
  return JSON.stringify({
    schemaVersion: "mastergo-project-config/1",
    mode: "mtslg-iocontrol",
    scaffold: true,
    source_root: manifest.sourceRoot || "",
    index_root: manifest.indexRoot || "",
    pages_root: manifest.pagesRoot || PAGE_ROOT,
    icons_root: manifest.iconsRoot || PAGE_ROOT,
    resource_roots: Array.isArray(manifest.resourceRoots) ? manifest.resourceRoots : [],
    layout_file: manifest.layoutPath || DEFAULT_LAYOUT_PATH,
    key_catalog: manifest.keyCatalog || "",
    generated_root: manifest.generatedRoot || "Generated",
    runtime_bindings: "pending"
  }, null, 2) + "\n";
}

function ensureScaffold(manifest) {
  const scaffold = manifest.scaffold === true || manifest.projectMode === "scaffold";
  if (typeof manifest.projectRoot !== "string" || !manifest.projectRoot.trim()) {
    fail("projectRoot 必须提供；脚手架模式也必须明确指定要创建的目标目录");
  }
  const projectRoot = path.resolve(manifest.projectRoot);
  if (!fs.existsSync(projectRoot)) {
    if (!scaffold) fail("projectRoot 不存在: " + projectRoot);
    fs.mkdirSync(projectRoot, { recursive: true });
  }
  if (!scaffold) return { projectRoot, scaffold: false, frameworkConfigPath: null };

  const projectName = scaffoldName(manifest.projectName || path.basename(projectRoot), "MasterGoProject");
  const rootNamespace = manifest.rootNamespace || projectName;
  const csprojRelative = manifest.csproj || projectName + ".csproj";
  const csprojPath = resolvePath(projectRoot, csprojRelative, "csproj");
  if (!fs.existsSync(csprojPath)) {
    fs.mkdirSync(path.dirname(csprojPath), { recursive: true });
    fs.writeFileSync(csprojPath, scaffoldCsproj(rootNamespace, projectName), "utf8");
  }
  manifest.csproj = csprojRelative;
  manifest.rootNamespace = rootNamespace;
  const configRelative = manifest.frameworkConfigPath || "framework.config.json";
  const frameworkConfigPath = resolvePath(projectRoot, configRelative, "frameworkConfigPath");
  if (!fs.existsSync(frameworkConfigPath)) {
    fs.mkdirSync(path.dirname(frameworkConfigPath), { recursive: true });
    fs.writeFileSync(frameworkConfigPath, scaffoldFrameworkConfig(manifest), "utf8");
  }
  manifest.frameworkConfigPath = configRelative;
  const dirs = [
    PAGE_ROOT, LAYOUT_DIR, pageFolderFor(manifest.name), "Generated",
    "UI/" + String(manifest.area || "F2-Manual") + "/View",
    "UI/" + String(manifest.area || "F2-Manual") + "/ViewModel"
  ];
  dirs.forEach(relative => fs.mkdirSync(path.join(projectRoot, ...relative.split("/")), { recursive: true }));
  return { projectRoot, scaffold: true, frameworkConfigPath };
}

function csprojIncludes(csprojText) {
  const result = [];
  const re = /<(?:Page|Compile|Content)\s+Include=["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(csprojText)) !== null) result.push(match[1].replace(/\\/g, "/"));
  return result;
}

function inferHostPaths(manifest, projectRoot, csprojText) {
  const viewName = manifest.viewName || manifest.pageName + "View";
  const viewModelName = manifest.viewModelName || manifest.pageName + "ViewModel";
  if ((manifest.viewPath && !manifest.codeBehindPath) || (!manifest.viewPath && manifest.codeBehindPath)) {
    fail("viewPath 与 codeBehindPath 必须同时提供");
  }
  if (manifest.viewPath || manifest.codeBehindPath || manifest.viewModelPath) {
    return {
      view: manifest.viewPath || "UI/" + manifest.area + "/View/" + viewName + ".xaml",
      codeBehind: manifest.codeBehindPath || manifest.viewPath + ".cs",
      viewModel: manifest.viewModelPath || "UI/" + manifest.area + "/ViewModel/" + viewModelName + ".cs"
    };
  }
  const includes = csprojIncludes(csprojText);
  const areaPrefix = "UI/" + String(manifest.area).replace(/\\/g, "/") + "/View/";
  const viewMatch = includes.find(item => item.toLowerCase().startsWith(areaPrefix.toLowerCase()) && /\/View\/[^/]+\.xaml$/i.test(item));
  const uiViewEvidence = includes.some(item => /^UI\/.+\/View\/[^/]+\.xaml$/i.test(item));
  const pagesMatch = includes.find(item => /^Pages\/[^/]+\.xaml$/i.test(item) || /\/Pages\/[^/]+\.xaml$/i.test(item));
  let viewDir;
  let viewModelDir;
  if (viewMatch) {
    viewDir = viewMatch.slice(0, viewMatch.lastIndexOf("/"));
    const prefix = viewDir.slice(0, viewDir.lastIndexOf("/View"));
    const vmMatch = includes.find(item => /\/ViewModel\/[^/]+\.cs$/i.test(item) && item.toLowerCase().startsWith(prefix.toLowerCase()));
    viewModelDir = vmMatch ? vmMatch.slice(0, vmMatch.lastIndexOf("/")) : viewDir.replace(/\/View$/i, "/ViewModel");
  } else if (pagesMatch) {
    viewDir = pagesMatch.slice(0, pagesMatch.lastIndexOf("/"));
    viewModelDir = viewDir;
  } else if (uiViewEvidence || fs.existsSync(path.join(projectRoot, "UI", manifest.area, "View"))) {
    viewDir = "UI/" + manifest.area + "/View";
    viewModelDir = fs.existsSync(path.join(projectRoot, "UI", manifest.area, "ViewModel"))
      ? "UI/" + manifest.area + "/ViewModel" : viewDir.replace(/\/View$/i, "/ViewModel");
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

function backupFile(filePath) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  let backup = filePath + ".bak-" + stamp;
  let index = 2;
  while (fs.existsSync(backup)) backup = filePath + ".bak-" + stamp + "-" + index++;
  fs.copyFileSync(filePath, backup);
  return backup;
}

function copyOutput(source, target, overwrite, created, backups, allowExisting) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    if (!overwrite && !allowExisting) fail("页面目标文件已存在，未覆盖: " + target + "；请停止并确认是否修改已有页面");
    backups.push(backupFile(target));
  } else {
    created.push(target);
  }
  fs.copyFileSync(source, target);
}

function copyLayoutOutput(source, target, overwrite, created, backups) {
  // Layout 支持新增 Page 的增量注册；相同 pageTarget 的替换不由新页面
  // Bundle 自动执行，避免把共享 Layout 当作普通页面文件覆盖。
  copyOutput(source, target, overwrite, created, backups, true);
}

function writeAuditOutput(target, content, overwrite, backups) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    if (!overwrite) fail("审计文件已存在，未覆盖: " + target);
    backups.push(backupFile(target));
  }
  fs.writeFileSync(target, content, "utf8");
}

function snapshotFiles(filePaths) {
  const snapshots = new Map();
  filePaths.forEach(function (filePath) {
    snapshots.set(filePath, fs.existsSync(filePath) ? fs.readFileSync(filePath) : null);
  });
  return snapshots;
}

function restoreSnapshots(snapshots) {
  snapshots.forEach(function (content, filePath) {
    if (content === null) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  });
}

function run(command, args) {
  const result = spawnSync(process.execPath, [command].concat(args), { encoding: "utf8" });
  if (result.status !== 0) {
    fail("生成步骤失败: " + path.basename(command) + "\n" + (result.stderr || result.stdout || ""));
  }
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) fail(label + " 未生成: " + filePath);
  return fs.readFileSync(filePath, "utf8");
}

function readGeometryKeys(iconText) {
  const keys = new Set();
  const duplicateKeys = new Set();
  const geometryTag = /<Geometry\b([^>]*)>/gi;
  let match;
  while ((match = geometryTag.exec(iconText)) !== null) {
    const keyMatch = match[1].match(/\bx:Key=["']([^"']+)["']/i);
    if (!keyMatch) continue;
    const key = keyMatch[1];
    if (keys.has(key)) duplicateKeys.add(key);
    keys.add(key);
  }
  return { keys, duplicateKeys };
}

function collectIconReferences(mapping, layoutMenuItems) {
  const references = new Set();
  (mapping.nodes || []).forEach(function (node) {
    const icon = node && node.attrs && node.attrs.Icon;
    if (typeof icon === "string" && icon.trim()) references.add(icon.trim());
  });
  (layoutMenuItems || []).forEach(function (item) {
    const icon = item && item.icon;
    if (typeof icon === "string" && icon.trim()) references.add(icon.trim());
  });
  return references;
}

// 右下角“右侧底部-常驻button”分组内的实例不生成 MenuItem（见 feishu-layout-mapping.md）。
// 只匹配常驻分组本身（“右侧底部-常驻button”这类名字）；页面上的“背景常驻信息”等不在此列。
const RESIDENT_GROUP_PATTERN = /常驻(button|按钮|分组)/i;

function residentGroupRefs(mapping) {
  return (mapping && Array.isArray(mapping.sourceNodes) ? mapping.sourceNodes : [])
    .filter(function (node) {
      return node && node.type === "INSTANCE" &&
        typeof node.name === "string" && RESIDENT_GROUP_PATTERN.test(node.name);
    })
    .map(function (node) { return String(node.ref); });
}

function isUnderRef(ref, parentRefs) {
  return parentRefs.some(function (parentRef) {
    return ref === parentRef || ref.indexOf(parentRef + "/") === 0;
  });
}

function countResidentGroupItems(mapping, parentRefs) {
  if (parentRefs.length === 0) return 0;
  return (mapping.sourceNodes || []).filter(function (node) {
    if (!node || node.type !== "INSTANCE") return false;
    if (typeof node.name === "string" && /背景|分割/.test(node.name)) return false;
    return parentRefs.indexOf(String(node.parentRef)) >= 0;
  }).length;
}

function validateResidentGroupEvidence(mapping, manifest) {
  const parentRefs = residentGroupRefs(mapping);
  const evidence = manifest.layoutEvidence || {};
  const declared = evidence.residentGroupItems === undefined || evidence.residentGroupItems === null
    ? 0
    : Number(evidence.residentGroupItems);
  const expected = countResidentGroupItems(mapping, parentRefs);
  if (declared !== expected) {
    fail("layoutEvidence.residentGroupItems=" + declared +
      "，但 mapping 中右下角常驻分组内的底部栏实例数为 " + expected +
      "（分组: " + (parentRefs.join(", ") || "无") + "）");
  }
  const offenders = (manifest.menuItems || []).filter(function (item) {
    return item && typeof item.sourceRef === "string" &&
      parentRefs.length > 0 && isUnderRef(item.sourceRef, parentRefs);
  });
  if (offenders.length > 0) {
    fail("MenuItems 不得包含右下角常驻分组内的实例：" +
      offenders.map(function (item) { return item.sourceRef || item.name || "(未命名)"; }).join(", ") +
      "；请从 menuItems 移除并计入 layoutEvidence.residentGroupItems");
  }
}

// 多语言绑定：语言清单是 LanguageKey 的唯一真值源，控件与菜单只“引用”它，不另写一份 key。
// 引用方式：sourceRef（页面节点）、menuIndex（Layout MenuItem）、role=page-title（页面标题键）。
// 目标项目已登记语言字典：返回文件路径列表，由语言键派生器按文件名主干配对 CN/EN。
function resolveLangCatalogPaths(manifestDir, projectRoot, manifest) {
  // 语言字典既可以写在顶层 keyCatalog（与扫描器审计字段一致），也可以写在 languages.keyCatalog。
  const raw = [manifest.keyCatalog, manifest.languages && manifest.languages.keyCatalog];
  const items = [];
  for (const value of raw) {
    if (!value) continue;
    for (const item of (Array.isArray(value) ? value : [value])) {
      if (typeof item === "string" && item.trim() && items.indexOf(item) === -1) items.push(item);
    }
  }
  if (items.length === 0) return [];
  return items.map(function (item) {
    const file = resolveInput(manifestDir, projectRoot, item, "keyCatalog");
    if (!fs.existsSync(file)) fail("keyCatalog 文件不存在: " + file);
    return file;
  });
}

function resolveLangGlossary(manifestDir, projectRoot, manifest) {
  const value = manifest.langGlossary;
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") fail("langGlossary 必须是术语表对象或 JSON 文件路径");
  const file = resolveInput(manifestDir, projectRoot, value, "langGlossary");
  if (!fs.existsSync(file)) fail("langGlossary 文件不存在: " + file);
  return readJson(file);
}

// 英文（及其它语言）译文清单：{ 中文文案: 译文 }，可由 AI/工程师产出后以文件或内联对象给出。
// 脚本不翻译，只机械套用；缺译文的条目仍按中文占位并在审计里标记待翻译。
function resolveLangTranslations(manifestDir, projectRoot, manifest) {
  const value = manifest.languages && manifest.languages.translations;
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") {
    fail("languages.translations 必须是 { 中文文案: 译文 } 对象或 JSON 文件路径");
  }
  const file = resolveInput(manifestDir, projectRoot, value, "languages.translations");
  if (!fs.existsSync(file)) fail("languages.translations 文件不存在: " + file);
  return readJson(file);
}

// 自动产键与显式登记项合并：显式项按 key / sourceRef / menuIndex 覆盖机械派生结果。
function mergeAutoLangKeys(derived, explicit) {
  const spec = Object.assign({}, derived);
  const explicitKeys = explicit && Array.isArray(explicit.keys) ? explicit.keys : [];
  const noLangRefs = Array.isArray(spec.noLangRefs) ? spec.noLangRefs.slice() : [];
  if (explicit && Array.isArray(explicit.noLangRefs)) {
    for (const ref of explicit.noLangRefs) {
      if (noLangRefs.indexOf(ref) === -1) noLangRefs.push(ref);
    }
  }
  spec.noLangRefs = noLangRefs;
  if (explicitKeys.length === 0) return spec;
  const explicitKeyNames = new Set();
  const explicitRefs = new Set();
  const explicitMenus = new Set();
  for (const entry of explicitKeys) {
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.key === "string" && entry.key) explicitKeyNames.add(entry.key);
    if (typeof entry.sourceRef === "string" && entry.sourceRef) explicitRefs.add(entry.sourceRef);
    if (Array.isArray(entry.sourceRefs)) {
      entry.sourceRefs.forEach(function (ref) {
        if (typeof ref === "string" && ref) explicitRefs.add(ref);
      });
    }
    if (entry.menuIndex !== undefined && entry.menuIndex !== null) explicitMenus.add(Number(entry.menuIndex));
  }
  const kept = spec.keys.filter(function (entry) {
    if (explicitKeyNames.has(entry.key)) return false;
    if (entry.sourceRef && explicitRefs.has(entry.sourceRef)) return false;
    if (Array.isArray(entry.sourceRefs) &&
        entry.sourceRefs.some(function (ref) { return explicitRefs.has(ref); })) return false;
    if (entry.menuIndex !== undefined && explicitMenus.has(Number(entry.menuIndex))) return false;
    return true;
  });
  spec.keys = kept.concat(explicitKeys);
  return spec;
}

function applyLangBindings(mapping, manifest, langSpec) {
  const applied = [];
  const problems = [];
  const nodes = Array.isArray(mapping.nodes) ? mapping.nodes : [];
  const menuItems = Array.isArray(manifest.menuItems) ? manifest.menuItems : [];
  const ambiguous = new Set();
  const entryByKey = new Map(langSpec.keys.map(function (entry) { return [entry.key, entry]; }));
  const isShared = function (entry) { return entry && entry.scope === "shared"; };
  // LanguageKey 命名约定：页面内容 {页面名}{名称}、菜单项 MenuItem{名称}、
  // 页面标题 {页面名}PageTitle（由 Layout <Page LangName> 引用）。
  const checkNodeKey = function (entry, ref) {
    if (isShared(entry) || entry.key === langSpec.titleKey ||
        entry.key.indexOf(langSpec.pageName) === 0) return;
    problems.push("LanguageKey " + entry.key + " 不符合页面内容命名约定（应为 " +
      langSpec.pageName + "<名称>）: 节点 " + ref);
  };
  const checkMenuKey = function (entry, index) {
    if (isShared(entry) || entry.key.indexOf(LANG.MENU_PREFIX) === 0) return;
    problems.push("LanguageKey " + entry.key + " 不符合菜单项命名约定（应为 " +
      LANG.MENU_PREFIX + "<名称>）: MenuItem Index=" + index);
  };
  if (langSpec.requireLangName) {
    if (!entryByKey.has(langSpec.titleKey)) {
      problems.push("缺少页面标题 LanguageKey：" + langSpec.titleKey +
        "（Layout <Page LangName> 必须引用该 key）");
    } else if (manifest.pageLangName && manifest.pageLangName !== langSpec.titleKey) {
      problems.push("页面标题键冲突：manifest.pageLangName=\"" + manifest.pageLangName +
        "\" 与命名约定 \"" + langSpec.titleKey + "\" 不一致");
    } else if (!manifest.pageLangName) {
      manifest.pageLangName = langSpec.titleKey;
      applied.push(langSpec.titleKey + " -> Layout <Page LangName>");
    }
  }
  for (const entry of langSpec.keys) {
    // 一个 key 可以绑定多个节点：sourceRef 单数用于普通节点，sourceRefs 用于同文案多节点复用同一 key。
    const boundRefs = [];
    if (entry.sourceRef) boundRefs.push(entry.sourceRef);
    if (Array.isArray(entry.sourceRefs)) {
      for (const ref of entry.sourceRefs) {
        if (boundRefs.indexOf(ref) === -1) boundRefs.push(ref);
      }
    }
    for (const ref of boundRefs) {
      const node = nodes.find(function (n) { return (n.sourceRef || n.ref) === ref; });
      if (!node) {
        problems.push("LanguageKey " + entry.key + " 的 sourceRef 未命中页面节点：" + ref);
      } else {
        const current = node.attrs && node.attrs.LangName;
        if (typeof current === "string" && current !== "" && current !== entry.key) {
          problems.push("节点 " + ref + " 已有 LangName=\"" + current +
            "\"，与语言清单 \"" + entry.key + "\" 冲突");
        } else {
          node.attrs = Object.assign({}, node.attrs, { LangName: entry.key });
          applied.push(entry.key + " -> 节点 " + ref);
        }
      }
    }
    if (entry.menuIndex !== undefined) {
      const item = menuItems.find(function (menuItem) {
        return Number(menuItem.index) === entry.menuIndex;
      });
      if (!item) {
        problems.push("LanguageKey " + entry.key + " 的 menuIndex 未命中菜单项：" + entry.menuIndex);
      } else if (typeof item.langName === "string" && item.langName !== "" && item.langName !== entry.key) {
        problems.push("MenuItem Index=" + entry.menuIndex + " 已有 LangName=\"" + item.langName +
          "\"，与语言清单 \"" + entry.key + "\" 冲突");
      } else {
        item.langName = entry.key;
        applied.push(entry.key + " -> MenuItem Index=" + entry.menuIndex);
      }
    }
  }

  // 自动绑定：设计稿是中文，LanguageKey 的 CN 文案与节点设计文本逐字相等才绑定。
  // 同一文案对应多个 key 属于歧义，必须由 sourceRef 显式指定，脚本不猜。
  if (langSpec.bindByText) {
    const byText = LANG.indexKeysByText(langSpec);
    const bindOne = function (text, ref, describe, assign) {
      const candidates = byText.get(text) || [];
      if (candidates.length === 1) {
        assign(candidates[0]);
        applied.push(candidates[0] + " -> " + describe + "（按文案匹配）");
      } else if (candidates.length > 1) {
        ambiguous.add(ref);
        problems.push("文案 \"" + text + "\"（" + describe + "）对应多个 LanguageKey: " +
          candidates.join(", ") + "；请用 sourceRef 显式指定");
      }
    };
    for (const node of nodes) {
      if (node.valueSource !== "dsl.text" || typeof node.sourceText !== "string") continue;
      if (node.attrs && typeof node.attrs.LangName === "string" && node.attrs.LangName !== "") continue;
      const ref = node.sourceRef || node.ref;
      bindOne(node.sourceText, ref, "节点 " + ref, function (key) {
        node.attrs = Object.assign({}, node.attrs, { LangName: key });
      });
    }
    for (const item of menuItems) {
      if (!item || typeof item.name !== "string" || item.name === "") continue;
      if (typeof item.langName === "string" && item.langName !== "") continue;
      bindOne(item.name, "menu:" + item.index, "MenuItem Index=" + item.index, function (key) {
        item.langName = key;
      });
    }
  }

  // 强制门禁：生成页面里所有设计文本都必须挂 LangName，除非显式列入 noLangRefs。
  if (langSpec.requireLangName) {
    // 命名约定复核：所有最终 LangName 都必须落在 页面标题/菜单项/页面内容 三类里，
    // 包括 mapping 自带或 merge 保留下来的 LangName。
    for (const node of nodes) {
      const key = node.attrs && node.attrs.LangName;
      if (typeof key !== "string" || key === "") continue;
      const entry = entryByKey.get(key);
      if (entry) checkNodeKey(entry, node.sourceRef || node.ref);
    }
    for (const item of menuItems) {
      if (!item || typeof item.langName !== "string" || item.langName === "") continue;
      const entry = entryByKey.get(item.langName);
      if (entry) checkMenuKey(entry, item.index);
    }
    const exempt = new Set(langSpec.noLangRefs);
    const missing = [];
    for (const node of nodes) {
      if (node.valueSource !== "dsl.text") continue;
      if (node.attrs && typeof node.attrs.LangName === "string" && node.attrs.LangName !== "") continue;
      const ref = node.sourceRef || node.ref;
      if (exempt.has(ref) || ambiguous.has(ref)) continue;
      missing.push("节点 " + ref + " \"" + String(node.sourceText || "") + "\"");
    }
    for (const item of menuItems) {
      if (!item || typeof item.name !== "string" || item.name === "") continue;
      if (typeof item.langName === "string" && item.langName !== "") continue;
      if (ambiguous.has("menu:" + item.index)) continue;
      missing.push("MenuItem Index=" + item.index + " \"" + item.name + "\"");
    }
    if (missing.length > 0) {
      problems.push("以下文本没有可引用的 LanguageKey，而生成页面要求文本控件必须挂 LangName：\n      " +
        missing.join("\n      ") +
        "\n    处理方式：把文案登记到 manifest.languages.keys；动态值等不需要翻译的节点写入 languages.noLangRefs 豁免。");
    }
  }

  if (problems.length > 0) {
    fail("多语言绑定失败：\n  - " + problems.join("\n  - "));
  }
  return applied;
}

// 多语言交付门禁：各语言 key 必须完全一致；页面/菜单引用的 LangName 必须存在于本页字典。
function validateLangOutputs(info) {
  if (!info.langSpec) return null;
  const dictionaries = info.langPaths.map(function (relative) {
    const absolute = path.join(info.projectRoot, ...relative.split("/"));
    const text = requireFile(absolute, "页面多语言文件");
    return { relative, keys: LANG.readDictionaryKeys(text) };
  });
  const reference = dictionaries[0];
  if (reference.keys.length !== info.langSpec.keys.length) {
    fail("多语言文件 key 数量与语言清单不一致: " + reference.relative + "，期望 " +
      info.langSpec.keys.length + "，实际 " + reference.keys.length);
  }
  for (const dictionary of dictionaries.slice(1)) {
    const same = dictionary.keys.length === reference.keys.length &&
      dictionary.keys.every(function (key, index) { return key === reference.keys[index]; });
    if (!same) {
      fail("各语言 key 必须完全一致（含顺序）: " + reference.relative + " vs " + dictionary.relative);
    }
  }
  const known = new Set(reference.keys);
  const referenced = new Set();
  const langNameRe = /\bLangName="([^"]*)"/g;
  let match;
  while ((match = langNameRe.exec(info.pageXml)) !== null) {
    if (match[1]) referenced.add(match[1]);
  }
  (info.layoutMenuItems || []).forEach(function (item) {
    if (item && typeof item.langName === "string" && item.langName) referenced.add(item.langName);
  });
  if (typeof info.pageLangName === "string" && info.pageLangName) referenced.add(info.pageLangName);
  const missing = [...referenced].filter(function (key) { return !known.has(key); });
  if (missing.length > 0) {
    fail("LangName 引用了本页多语言文件中不存在的 key：" + missing.join(", ") +
      "（LanguageKey 必须先登记在 manifest.languages.keys 中）");
  }
  return {
    locales: info.langSpec.locales,
    keyCount: reference.keys.length,
    referencedKeys: [...referenced].length
  };
}

function validateBundleOutputs(info) {
  const pageXml = requireFile(info.pageXmlPath, "页面 XML");
  if (!/<IOContorl\b/.test(pageXml) || !/<\/IOContorl>\s*$/.test(pageXml)) {
    fail("页面 XML 根节点不符合 IOContorl 格式: " + info.pageXmlPath);
  }
  const icon = requireFile(info.iconPath, "页面 Icon");
  if (!/<ResourceDictionary\b/.test(icon) || !/<\/ResourceDictionary>/.test(icon)) {
    fail("页面 Icon 不是完整 ResourceDictionary: " + info.iconPath);
  }
  if (/<(?:PathGeometry|GeometryGroup)\b|<MatrixTransform\b/.test(icon)) {
    fail("页面 Icon 使用了不兼容的几何结构；必须只使用 Geometry 内联路径: " + info.iconPath);
  }
  const geometryResources = icon.match(/<Geometry\b[^>]*>[\s\S]*?<\/Geometry>/g) || [];
  if (geometryResources.some(function (resource) {
    return !/\bo:Freeze=["']True["']/i.test(resource) || !/\bx:Key=["'][^"']+["']/i.test(resource);
  })) {
    fail("页面 Icon 的 Geometry 缺少 o:Freeze=True 或 x:Key: " + info.iconPath);
  }
  const geometryInfo = readGeometryKeys(icon);
  if (geometryInfo.duplicateKeys.size > 0) {
    fail("页面 Icon 存在重复 Geometry 资源键: " + [...geometryInfo.duplicateKeys].join(", "));
  }
  const iconReferences = collectIconReferences(info.mapping, info.layoutMenuItems);
  const missingReferences = [...iconReferences].filter(function (key) {
    return !geometryInfo.keys.has(key);
  });
  if (missingReferences.length > 0) {
    fail("页面实际引用了未生成的 Geometry: " + missingReferences.join(", "));
  }
  const iconMapAudit = readJson(info.iconMapAudit, "页面 Icon mapping 审计");
  if (!Array.isArray(iconMapAudit.icons) || !Array.isArray(iconMapAudit.candidates) || !Array.isArray(iconMapAudit.unmapped)) {
    fail("页面 Icon mapping 审计缺少 icons/candidates/unmapped 数组: " + info.iconMapAudit);
  }
  const layout = requireFile(info.layoutPath, "Layout.xml");
  if (!/<Layout\b/.test(layout)) {
    fail("Layout.xml 格式无效: " + info.layoutPath);
  }
  if (info.layoutStatus !== "none" && !new RegExp("<Page\\s+[^>]*Target=[\\\"']" +
    String(info.pageTarget).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&") + "[\\\"']", "i").test(layout)) {
    fail("Layout.xml 缺少当前页面注册: " + info.pageTarget);
  }
  const view = requireFile(info.hostPaths[0], "View XAML");
  if (!/<UserControl\b/.test(view) || !/<uidesign:PageDesign\b/.test(view)) {
    fail("View XAML 缺少 MaxWell PageDesign 宿主: " + info.hostPaths[0]);
  }
  // View 不再合并页面 Icon 资源字典（宿主壳只输出 UserControl 头 + PageDesign）；
  // 页面 Icon 文件本身仍要求存在并在 .csproj 注册，因此这里不再校验 View 里的引用。
  requireFile(info.hostPaths[1], "View.xaml.cs");
  requireFile(info.hostPaths[2], "ViewModel");
  if (info.scaffold) {
    requireFile(info.frameworkConfigPath, "framework.config.json");
  }

  run(PROVENANCE_SCRIPT, ["--xml", info.pageXmlPath, "--mapping", info.mappingAudit]
    .concat(info.templateMapPath ? ["--map", info.templateMapPath] : []));
  const mapping = info.mapping;
  if (Array.isArray(mapping.nodes) && mapping.nodes.length > 0) {
    const sourceByRef = new Map((mapping.sourceNodes || []).map(function (node) { return [node.ref, node]; }));
    const rootRef = mapping.rootRef || null;
    const coordNodes = mapping.nodes.map(function (node) {
      const source = sourceByRef.get(node.sourceRef || node.ref) || {};
      // 坐标核对的原点 = 该节点「输出父节点」（XML 里的父容器）的页面绝对坐标，与生成器口径一致：
      //   根级节点（父容器是页面根）→ (0, 192)，顶层公共栏 126 + 示例标题 66 只在根级扣一次；
      //   嵌套节点 → 父容器的 (pageAbsX, pageAbsY)，生成器按父容器相对发射、不再扣 192。
      // 注意必须用输出父节点（layoutParent / parent / DSL parentRef 的优先级，与 provenance 校验一致），
      // 不能用 DSL 父节点：mapping 允许把语义槽位展开为同级节点，两者可能不同。
      const outputParentRef = node.layoutParent !== undefined
        ? node.layoutParent
        : (node.parent !== undefined ? node.parent : (source.parentRef || null));
      const parentSource = outputParentRef ? (sourceByRef.get(outputParentRef) || null) : null;
      const parentIsRoot = !parentSource || (rootRef !== null && parentSource.ref === rootRef);
      const originX = parentSource ? (Number(parentSource.pageAbsX) || 0) : 0;
      const originY = parentIsRoot ? 192 : (parentSource ? (Number(parentSource.pageAbsY) || 0) : 192);
      const isTextBlock = (node.controlType || (node.attrs && node.attrs.ControlType)) === "TextBlock";
      return {
        id: node.xmlId || node.id || node.ref,
        x: source.pageAbsX !== undefined ? source.pageAbsX : node.absX,
        y: source.pageAbsY !== undefined ? source.pageAbsY : node.absY,
        w: isTextBlock
          ? "NaN"
          : (node.expectedWidth !== undefined
            ? node.expectedWidth
            : (source.width !== undefined ? source.width : node.w)),
        h: node.expectedHeight !== undefined
          ? node.expectedHeight
          : (source.height !== undefined ? source.height : node.h),
        contentOriginX: originX,
        contentOriginY: originY
      };
    });
    // TextBlock 的宽度按规则固定为 NaN（自适应），此时 w 传 "NaN" 是合法的：
    // 只要求 x/y 必须是数值，w/h 允许是数值或 "NaN"（NaN 只与 NaN 匹配，见 check-iocontrol-coords.js）。
    // 度量先按 coordNumber() 归一化（数值字符串算数值，与 provenance / 坐标核对器一致），
    // 归一化后仍为 null 才算「缺度量」；**不允许静默跳过**——坐标核对是硬门禁，
    // 缺度量必须报错，否则审计里会出现 "static: passed" 而实际根本没跑核对。
    const unusableCoordNodes = [];
    const normalizedCoordNodes = coordNodes.map(function (node) {
      const meters = {
        x: coordNumber(node.x),
        y: coordNumber(node.y),
        w: node.w === "NaN" ? "NaN" : coordNumber(node.w),
        h: node.h === "NaN" ? "NaN" : coordNumber(node.h)
      };
      if (meters.x === null || meters.y === null || meters.w === null || meters.h === null) {
        unusableCoordNodes.push(node.id + "(x=" + node.x + ",y=" + node.y +
          ",w=" + node.w + ",h=" + node.h + ")");
      }
      return Object.assign({}, node, meters);
    });
    if (unusableCoordNodes.length > 0) {
      fail("坐标核对无法执行：以下节点的度量表缺少数值（x/y 必须是数值，w/h 必须是数值或 TextBlock 的 NaN）—— " +
        unusableCoordNodes.join("、") +
        "；请补齐 mapping/sourceNodes 的 bbox 后重跑，不要跳过坐标门禁");
    }
    const coordsPath = path.join(info.tempRoot, "coords.json");
    fs.writeFileSync(coordsPath, JSON.stringify(normalizedCoordNodes), "utf8");
    run(COORDS_SCRIPT, ["--xml", info.pageXmlPath, "--nodes", coordsPath]);
  }

  // 多语言：各语言 key 必须完全一致，且 LangName 必须命中本页字典。
  validateLangOutputs({
    projectRoot: info.projectRoot,
    langSpec: info.langSpec,
    langPaths: info.langPaths || [],
    pageXml,
    layoutMenuItems: info.layoutMenuItems,
    pageLangName: info.pageLangName
  });

  const csproj = fs.readFileSync(info.csprojPath, "utf8").replace(/\\/g, "/");
  const langAbsolute = (info.langPaths || []).map(function (relative) {
    return path.join(info.projectRoot, ...relative.split("/"));
  });
  [info.pageXmlPath, info.iconPath].concat(info.hostPaths).concat([info.layoutPath]).concat(langAbsolute).forEach(function (filePath) {
    const include = projectRelative(info.projectRoot, filePath).replace(/\\/g, "/");
    if (!csproj.toLowerCase().includes(include.toLowerCase())) {
      fail("csproj 未注册生成文件: " + include);
    }
  });
}

function bundleGeneratedPaths(info) {
  const files = [
    info.pageXmlPath,
    info.iconPath,
    info.hostPaths[0],
    info.hostPaths[1],
    info.hostPaths[2],
    info.layoutPath,
    info.mappingAudit,
    info.iconMapAudit,
    info.bundleAudit,
    info.csprojPath
  ];
  if (info.scaffold) files.push(info.frameworkConfigPath);
  if (info.langTranslationAudit) files.push(info.langTranslationAudit);
  if (info.langGlossaryAudit) files.push(info.langGlossaryAudit);
  // 语言文件在清单里本来就是项目相对路径，不能再过 projectRelative（否则按 CWD 解析出错路径）。
  return files.map(function (filePath) {
    return projectRelative(info.projectRoot, filePath);
  }).concat(info.langPaths || []);
}

function ensureLayoutContent(csprojPath, layoutPath) {
  let text = fs.readFileSync(csprojPath, "utf8");
  const include = projectRelative(path.dirname(csprojPath), layoutPath).replace(/\//g, "\\");
  const escaped = include.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  if (new RegExp("<Content\\s+Include=[\"']" + escaped + "[\"']", "i").test(text)) return false;
  const groupRegex = /<ItemGroup>[\s\S]*?<\/ItemGroup>/gi;
  let match;
  while ((match = groupRegex.exec(text)) !== null) {
    if (!/<Content\s+Include=/i.test(match[0])) continue;
    const block = match[0];
    const at = block.lastIndexOf("\n");
    const item = "    <Content Include=\"" + include + "\" />";
    const replacement = block.slice(0, at) + "\n" + item + block.slice(at);
    text = text.slice(0, match.index) + replacement + text.slice(match.index + block.length);
    fs.writeFileSync(csprojPath, text, "utf8");
    return true;
  }
  const close = text.lastIndexOf("</Project>");
  if (close < 0) fail("csproj 缺少 </Project>");
  const itemGroup = "\n  <ItemGroup>\n    <Content Include=\"" + include + "\" />\n  </ItemGroup>\n";
  fs.writeFileSync(csprojPath, text.slice(0, close) + itemGroup + text.slice(close), "utf8");
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestFile = path.resolve(args.manifestPath);
  const manifestDir = path.dirname(manifestFile);
  const manifest = normalizePageManifest(readJson(manifestFile));
  // 多语言是**默认能力**，不是可选项：
  //   - manifest 未提供 languages → 默认按 languages.auto=true + CN/EN 生成字典并强制 LangName 闭环；
  //   - 只有显式声明 languages=false 或 languages.disabled=true 才关闭，且必须给出 reason，
  //     关闭原因写入审计（languageDisabled/languageDisabledReason），避免"忘了写"被当成"成功"。
  // languages.auto=true 时，LanguageKey 在读到 resolved mapping 后由 DSL 机械派生，
  // 不再要求调用方逐条登记键；显式提供的 keys 仍然优先。
  const langDisabled = manifest.languages === false ||
    (Boolean(manifest.languages) && typeof manifest.languages === "object" && !Array.isArray(manifest.languages)
      && manifest.languages.disabled === true);
  const langDisabledReason = langDisabled
    ? String((manifest.languages && manifest.languages.reason) || manifest.languageDisabledReason
      || "manifest 显式声明不生成语言字典").trim()
    : null;
  const langDefaulted = !langDisabled && (manifest.languages === undefined || manifest.languages === null);
  if (langDefaulted) {
    manifest.languages = { auto: true, locales: ["CN", "EN"], bindByText: true, requireLangName: true };
  }
  if (langDisabled) manifest.languages = null;
  const autoLang = Boolean(manifest.languages) && typeof manifest.languages === "object"
    && !Array.isArray(manifest.languages) && manifest.languages.auto === true;
  let langSpec = null;
  let autoLangReport = null;
  // 本次页面标题文案的来源（写入审计，避免“静默回退成画板框名”再次无人发现）。
  let autoLangTitleSource = null;
  let langLocales = [];
  if (autoLang) {
    langLocales = LANG_KEYS.localesFrom(manifest.languages.locales);
  } else if (manifest.languages !== undefined && manifest.languages !== null) {
    langSpec = LANG.normalizeSpec(manifest.languages, manifest.name);
    langLocales = langSpec.locales;
  }
  const langPaths = langLocales.length > 0 ? pageLangPaths(manifest.name, langLocales) : [];
  // 明确隔离的组件实例（正式模板与设计结构不匹配时只隔离该组件，其余照常生成）。
  const excludeInstances = Array.isArray(manifest.excludeInstances)
    ? manifest.excludeInstances.map(String)
    : (typeof manifest.excludeInstances === "string" && manifest.excludeInstances.trim()
      ? manifest.excludeInstances.split(/[,\s]+/).filter(Boolean)
      : []);
  const existingMode = ["modify-existing", "replace-existing"].includes(manifest.operation);
  const scaffoldInfo = ensureScaffold(manifest);
  const projectRoot = scaffoldInfo.projectRoot;
  // 译文清单与术语表属于**本页生成产物**（每次生成来自当前页面的输入），不是插件固定资产：
  // 生成时同步落到该页审计目录 Generated/<Page>.lang-translations.json / .lang-glossary.json。
  const langTranslationsInput = resolveLangTranslations(manifestDir, projectRoot, manifest);
  const langGlossaryInput = resolveLangGlossary(manifestDir, projectRoot, manifest);
  const csprojPath = resolvePath(projectRoot, manifest.csproj, "csproj");
  if (!fs.existsSync(csprojPath)) fail("csproj 不存在: " + csprojPath);
  const csprojText = fs.readFileSync(csprojPath, "utf8");
  const hostPaths = inferHostPaths(manifest, projectRoot, csprojText);

  const pageXmlPath = resolvePath(projectRoot, manifest.pageXmlPath, "pageXmlPath");
  const iconPath = resolvePath(projectRoot, manifest.iconPath, "iconPath");
  const layoutPath = resolvePath(projectRoot, manifest.layoutPath || DEFAULT_LAYOUT_PATH, "layoutPath");
  const mappingPath = resolveInput(manifestDir, projectRoot, manifest.mappingPath, "mappingPath");
  const svgPath = resolveInput(manifestDir, projectRoot, manifest.svgPath, "svgPath");
  const iconMapPath = resolveInput(manifestDir, projectRoot, manifest.iconMapPath, "iconMapPath");
  const templateMapPath = manifest.templateMapPath
    ? resolveInput(manifestDir, projectRoot, manifest.templateMapPath, "templateMapPath")
    : DEFAULT_TEMPLATE_MAP;
  const autoMapping = Boolean(manifest.dslPath || manifest.visibilityPath);
  // New pages always create their page-specific mapping from the current
  // design snapshot. Existing-page merge/replace workflows may provide an
  // explicit mapping because they retain existing runtime/business data.
  if (!existingMode && (!manifest.dslPath || !manifest.visibilityPath)) {
    fail("新建页面必须提供当前页面的 dslPath 和 visibilityPath；mapping 将在本次生成中创建");
  }
  [svgPath, iconMapPath, templateMapPath].concat(autoMapping ? [] : [mappingPath]).forEach(function (filePath) {
    if (!fs.existsSync(filePath)) fail("输入文件不存在: " + filePath);
  });
  if (manifest.dslPath || manifest.visibilityPath) {
    if (!manifest.dslPath || !manifest.visibilityPath) fail("启用 DSL 自动映射时必须同时提供 dslPath 和 visibilityPath");
    const dslPath = resolveInput(manifestDir, projectRoot, manifest.dslPath, "dslPath");
    const visibilityPath = resolveInput(manifestDir, projectRoot, manifest.visibilityPath, "visibilityPath");
    if (!fs.existsSync(dslPath) || !fs.existsSync(visibilityPath)) fail("dslPath/visibilityPath 输入文件不存在");
    run(MAPPING_SCRIPT, [
      "--dsl", dslPath,
      "--visibility", visibilityPath,
      "--template-map", templateMapPath,
      "--icon-map", iconMapPath,
      "--out", mappingPath
    ].concat(excludeInstances.length ? ["--exclude-instances", excludeInstances.join(",")] : []));
    const generatedMapping = readJson(mappingPath);
    if (generatedMapping.mappingTag !== NEW_PAGE_MAPPING_TAG) {
      fail("本次生成的 mapping 缺少算法 Tag：\"" + NEW_PAGE_MAPPING_TAG + "\"");
    }
  }

  const outputTargets = [pageXmlPath, iconPath,
    resolvePath(projectRoot, hostPaths.view, "viewPath"),
    resolvePath(projectRoot, hostPaths.codeBehind, "codeBehindPath"),
    resolvePath(projectRoot, hostPaths.viewModel, "viewModelPath")];
  const langTargets = langPaths.map(function (relative) {
    return resolvePath(projectRoot, relative, "langPath");
  });
  const generatedDir = path.join(projectRoot, "Generated");
  const mappingAudit = path.join(generatedDir, manifest.pageName + ".mapping.json");
  const iconMapAudit = path.join(generatedDir, manifest.pageName + ".icon-map.json");
  const bundleAudit = path.join(generatedDir, manifest.pageName + ".bundle.manifest.json");
  const auditTargets = [mappingAudit, iconMapAudit, bundleAudit];
  const langTranslationAudit = Object.keys(langTranslationsInput).length
    ? path.join(generatedDir, manifest.pageName + ".lang-translations.json") : null;
  const langGlossaryAudit = Object.keys(langGlossaryInput).length
    ? path.join(generatedDir, manifest.pageName + ".lang-glossary.json") : null;
  if (langTranslationAudit) auditTargets.push(langTranslationAudit);
  if (langGlossaryAudit) auditTargets.push(langGlossaryAudit);
  const blocked = outputTargets.concat(langTargets).concat(auditTargets).filter(fs.existsSync);
  if (!args.overwrite && blocked.length) {
    fail("目标文件已存在，未覆盖: " + blocked.join(", ") + "；请停止并确认是否修改已有页面");
  }
  if (args.overwrite && !["modify-existing", "replace-existing"].includes(manifest.operation)) {
    fail("--overwrite 仅允许用于用户明确确认的已有页面替换；请在 manifest 中设置 operation=replace-existing");
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-page-bundle-"));
  const tempXml = path.join(tempRoot, "page.xml");
  const tempMapping = path.join(tempRoot, "resolved.mapping.json");
  const tempIconMap = path.join(tempRoot, "resolved.icon-map.json");
  const tempIcon = path.join(tempRoot, "icon.xaml");
  const tempLayout = path.join(tempRoot, "Layout.xml");
  const layoutInput = path.join(tempRoot, "layout.json");
  const hostManifest = path.join(tempRoot, "host.json");
  const created = [];
  const backups = [];
  let langBindings = [];
  const originalCsproj = fs.readFileSync(csprojPath, "utf8");
  const snapshots = snapshotFiles(outputTargets.concat(langTargets).concat([layoutPath, mappingAudit, iconMapAudit, bundleAudit, csprojPath])
    .concat(scaffoldInfo.frameworkConfigPath ? [scaffoldInfo.frameworkConfigPath] : []));

  try {
    run(TEMPLATE_RESOLVER_SCRIPT, [
      "--mapping", mappingPath,
      "--map", templateMapPath,
      "--out", tempMapping
    ]);
    const mapping = readJson(tempMapping);
    const contentOriginY = mapping.contentOriginY === undefined
      ? 192 : Number(mapping.contentOriginY);
    if (contentOriginY !== 192) {
      fail("contentOriginY 必须固定为 192");
    }
    // 自动产键：从当前页 DSL/mapping/Layout 菜单项机械派生 LanguageKey，显式登记项优先。
    if (autoLang) {
      const langDsl = manifest.dslPath
        ? readJson(resolveInput(manifestDir, projectRoot, manifest.dslPath, "dslPath"))
        : null;
      // 页面标题文案取值链（与单脚本 CLI 一致）：
      //   manifest.pageTitleText（显式覆盖）→ mapping.textAudit 的 page-title → DSL 根节点名 → 页面名。
      // textAudit 是 DSL 的机械产物，属于可靠来源；缺省时不再静默落到画板框名，
      // 本次实际用的来源写入审计 languages.titleSource。
      const manifestTitleText = typeof manifest.pageTitleText === "string"
        ? manifest.pageTitleText.trim() : "";
      const auditTitleText = LANG_KEYS.titleFromMapping(mapping);
      autoLangTitleSource = manifestTitleText
        ? "manifest.pageTitleText"
        : (auditTitleText ? "mapping.textAudit" : "dslRoot");
      const derived = LANG_KEYS.deriveLangSpec({
        pageName: manifest.name,
        mapping,
        dsl: langDsl,
        menuItems: Array.isArray(manifest.menuItems) ? manifest.menuItems : [],
        keyCatalog: LANG_KEYS.buildKeyCatalogFromFiles(resolveLangCatalogPaths(manifestDir, projectRoot, manifest)),
        glossary: resolveLangGlossary(manifestDir, projectRoot, manifest),
        translations: resolveLangTranslations(manifestDir, projectRoot, manifest),
        titleText: manifestTitleText || auditTitleText,
        locales: langLocales
      });
      manifest.languages = mergeAutoLangKeys(derived.languages, manifest.languages);
      autoLangReport = derived.report;
      langSpec = LANG.normalizeSpec(manifest.languages, manifest.name);
    }
    // 多语言绑定必须发生在 XML/Layout 生成之前：LangName 是页面节点与 MenuItem 的业务属性。
    if (langSpec) {
      langBindings = applyLangBindings(mapping, manifest, langSpec);
      fs.writeFileSync(tempMapping, JSON.stringify(mapping, null, 2) + "\n", "utf8");
    }
    run(XML_SCRIPT, ["--fresh", tempMapping, "--out", tempXml].concat(
      templateMapPath ? ["--map", templateMapPath] : []));
    run(PROVENANCE_SCRIPT, ["--xml", tempXml, "--mapping", tempMapping].concat(
      templateMapPath ? ["--map", templateMapPath] : []));
    run(ICON_DISCOVERY_SCRIPT, [
      "--svg", svgPath,
      "--mapping", mappingPath,
      "--confirmed", iconMapPath,
      "--out", tempIconMap
    ]);
    // 传入 DSL 快照：extractSvg 因几何完全相同的复用而漏条目时，图标生成器可从 DSL 合成补上。
    const iconDslPath = manifest.dslPath
      ? resolveInput(manifestDir, projectRoot, manifest.dslPath, "dslPath")
      : null;
    run(ICON_SCRIPT, [svgPath, tempIconMap, tempIcon].concat(iconDslPath ? [iconDslPath] : []));

    const tempLang = path.join(tempRoot, "lang.json");
    const tempLangDir = path.join(tempRoot, "lang");
    if (langSpec) {
      fs.writeFileSync(tempLang, JSON.stringify(manifest.languages, null, 2), "utf8");
      run(LANG_SCRIPT, ["--page", manifest.name, "--manifest", tempLang, "--out-dir", tempLangDir]);
    }

    let layoutSource = null;
    if (fs.existsSync(layoutPath)) {
      layoutSource = fs.readFileSync(layoutPath, "utf8");
      fs.writeFileSync(tempLayout, layoutSource, "utf8");
    }
    validateResidentGroupEvidence(mapping, manifest);
    const layoutManifest = {
      layoutPath: tempLayout,
      pageTarget: manifest.pageTarget,
      mappingTag: mapping.mappingTag || null,
      pageLangName: manifest.pageLangName,
      layoutStatus: manifest.layoutStatus,
      layoutEvidence: manifest.layoutEvidence,
      menuItems: manifest.menuItems
    };
    fs.writeFileSync(layoutInput, JSON.stringify(layoutManifest, null, 2), "utf8");
    run(LAYOUT_SCRIPT, ["--manifest", layoutInput]
      .concat(args.overwrite ? ["--overwrite"] : [])
      .concat(templateMapPath ? ["--map", templateMapPath] : []));

    const host = {
      projectRoot,
      csproj: path.relative(projectRoot, csprojPath),
      operation: manifest.operation,
      rootNamespace: manifest.rootNamespace,
      area: manifest.area,
      pageName: manifest.pageName,
      viewName: manifest.viewName,
      viewModelName: manifest.viewModelName,
      xmlPageName: manifest.xmlPageName,
      includeIcon: true,
      iconPath: manifest.iconPath,
      pageXmlPath: manifest.pageXmlPath,
      viewPath: hostPaths.view,
      codeBehindPath: hostPaths.codeBehind,
      viewModelPath: hostPaths.viewModel,
      langPaths,
      // 底部按钮名（Layout Menu 的 MenuItem）→ ViewModel 里 switch (message.ButtonName) 的 case 骨架
      menuItems: Array.isArray(manifest.menuItems) ? manifest.menuItems : []
    };
    fs.writeFileSync(hostManifest, JSON.stringify(host, null, 2), "utf8");
    run(HOST_SCRIPT, ["--manifest", hostManifest].concat(args.overwrite ? ["--overwrite"] : []));

    copyOutput(tempXml, pageXmlPath, args.overwrite, created, backups);
    copyOutput(tempIcon, iconPath, args.overwrite, created, backups);
    langPaths.forEach(function (relative) {
      copyOutput(path.join(tempLangDir, path.basename(relative)),
        resolvePath(projectRoot, relative, "langPath"), args.overwrite, created, backups);
    });
    copyLayoutOutput(tempLayout, layoutPath, args.overwrite, created, backups);

    const changedCsproj = ensureLayoutContent(csprojPath, layoutPath);
    fs.mkdirSync(generatedDir, { recursive: true });
    copyOutput(tempMapping, mappingAudit, args.overwrite, created, backups);
    copyOutput(tempIconMap, iconMapAudit, args.overwrite, created, backups);
    // 页面级多语言输入产物：本页的译文清单与术语表随生成一起落盘（便于逐页复核/回滚）。
    if (langTranslationAudit) {
      const tempTranslations = path.join(tempRoot, "lang-translations.json");
      fs.writeFileSync(tempTranslations, JSON.stringify(langTranslationsInput, null, 2) + "\n", "utf8");
      copyOutput(tempTranslations, langTranslationAudit, args.overwrite, created, backups);
    }
    if (langGlossaryAudit) {
      const tempGlossary = path.join(tempRoot, "lang-glossary.json");
      fs.writeFileSync(tempGlossary, JSON.stringify(langGlossaryInput, null, 2) + "\n", "utf8");
      copyOutput(tempGlossary, langGlossaryAudit, args.overwrite, created, backups);
    }

    validateBundleOutputs({
      projectRoot,
      csprojPath,
      scaffold: scaffoldInfo.scaffold,
      frameworkConfigPath: scaffoldInfo.frameworkConfigPath,
      pageXmlPath,
      iconPath,
      layoutPath,
      pageTarget: manifest.pageTarget,
      hostPaths: outputTargets.slice(2),
      mappingAudit,
      iconMapAudit,
      mapping,
      layoutMenuItems: manifest.menuItems,
      layoutStatus: manifest.layoutStatus,
      langPaths,
      langSpec,
      pageLangName: manifest.pageLangName,
      tempRoot,
      templateMapPath
    });

    const bundleInfo = {
      projectRoot,
      csprojPath,
      scaffold: scaffoldInfo.scaffold,
      frameworkConfigPath: scaffoldInfo.frameworkConfigPath,
      pageXmlPath,
      iconPath,
      layoutPath,
      hostPaths: outputTargets.slice(2),
      mappingAudit,
      iconMapAudit,
      bundleAudit,
      langPaths,
      langTranslationAudit,
      langGlossaryAudit
    };
    writeAuditOutput(bundleAudit, JSON.stringify({
      adapter: "mtslg-iocontrol",
      hostShell: "maxwell-wpf",
      projectMode: scaffoldInfo.scaffold ? "scaffold" : "target-project",
      contentOriginY: 192,
      generated: bundleGeneratedPaths(bundleInfo),
      verification: scaffoldInfo.scaffold
        ? { static: "passed", compile: "skipped", wpfLoad: "skipped", runtimeLoad: "skipped" }
        : { static: "passed", compile: "not-run-by-bundle", wpfLoad: "not-run-by-bundle", runtimeLoad: "not-run-by-bundle" },
      csprojChanged: changedCsproj,
      pageTarget: manifest.pageTarget,
      mappingTag: mapping.mappingTag || null,
      languages: langSpec ? {
        auto: autoLang,
        locales: langSpec.locales,
        keyCount: langSpec.keys.length,
        paths: langPaths,
        bindings: langBindings,
        // 页面标题文案来源：manifest.pageTitleText | mapping.textAudit | dslRoot（非自动派生时为 null）。
        titleSource: autoLangTitleSource,
        derivation: autoLangReport
      } : null,
      // 多语言默认开启（manifest 未写 languages 时自动按 auto + CN/EN 生成）；
      // 只有显式 disabled 才会没有字典，且必须记录原因，避免“忘了写”被当成成功。
      languagesDefaulted: langDefaulted,
      languageDisabled: langDisabled,
      languageDisabledReason: langDisabledReason,
      languageWarning: langSpec
        ? null
        : (langDisabled
          ? null
          : "manifest 未提供 languages：本次未生成语言字典，页面不会挂 LangName（多语言默认开启，请检查 languages 是否被显式关闭）"),
      excludedInstances: excludeInstances,
      layout: {
        status: manifest.layoutStatus,
        evidence: manifest.layoutEvidence,
        menuItemCount: manifest.menuItems.length
      }
    }, null, 2) + "\n", args.overwrite, backups);
    console.log(JSON.stringify({
      adapter: "mtslg-iocontrol",
      hostShell: "maxwell-wpf",
      projectMode: scaffoldInfo.scaffold ? "scaffold" : "target-project",
      languages: langSpec ? {
        auto: autoLang,
        locales: langSpec.locales,
        keyCount: langSpec.keys.length,
        titleSource: autoLangTitleSource,
        translated: autoLangReport
          ? {
              fromCatalog: autoLangReport.translatedFromCatalog,
              fromInput: autoLangReport.translatedFromInput
            }
          : null,
        provisionalKeys: autoLangReport ? autoLangReport.provisionalKeys.length : 0,
        pendingTranslations: autoLangReport ? autoLangReport.pendingTranslations.length : 0,
        autoNoLangRefs: autoLangReport ? autoLangReport.autoNoLangRefs.length : 0
      } : null,
      languagesDefaulted: langDefaulted,
      languageDisabled: langDisabled,
      languageDisabledReason: langDisabledReason,
      languageWarning: langSpec
        ? null
        : (langDisabled
          ? null
          : "manifest 未提供 languages：本次未生成语言字典，页面不会挂 LangName（多语言默认开启，请检查 languages 是否被显式关闭）"),
      generated: bundleGeneratedPaths(bundleInfo),
      backups
    }, null, 2));
  } catch (error) {
    restoreSnapshots(snapshots);
    // Keep the original byte-for-byte csproj even if a child generator changed line endings.
    fs.writeFileSync(csprojPath, originalCsproj, "utf8");
    throw error;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

try { main(); } catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
