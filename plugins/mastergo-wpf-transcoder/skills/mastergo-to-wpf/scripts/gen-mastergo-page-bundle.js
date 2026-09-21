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
const CONTAINMENT_SCRIPT = path.join(SCRIPT_DIR, "apply-container-containment.js");
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

// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const { fail, xmlAttr, readJson, backupFile } = require(path.join(SCRIPT_DIR, "lib", "script-helpers.js"));
const { inferHostPaths } = require(path.join(SCRIPT_DIR, "lib", "project-csproj.js"));
// 运行登记表的唯一实现（见 scripts/lib/run-registry.js；禁止在本脚本再抄一份）。
const RUN_REGISTRY = require(path.join(SCRIPT_DIR, "lib", "run-registry.js"));

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
  // 页面名只有一个清单字段：name。同一含义不接受第二个字段名。
  if (manifest.pageName !== undefined) {
    fail("manifest 不接受 pageName 字段：页面名统一写在 name");
  }
  const name = manifest.name;
  if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    fail("manifest 必须提供合法页面 name");
  }
  if (typeof manifest.area !== "string" || !manifest.area.trim()) {
    fail("新页面必须提供 area");
  }

  // Bundle 的页面 XML 恒用 --fresh 发射，因此它没有"合并已有页面"这条路径。
  // 改已有页面的业务属性（IOName/IOCommand/IOEnable…）必须走 gen-iocontrol-xml.js --merge，
  // 不经 Bundle；这里只接受 operation=replace-existing（整套替换 + 备份）或不填（新建）。
  if (manifest.operation !== undefined && manifest.operation !== "replace-existing") {
    fail("manifest.operation 只接受 replace-existing（整套替换并备份）：修改已有页面的业务属性请走 gen-iocontrol-xml.js --merge，不经 Bundle");
  }
  const existingMode = manifest.operation === "replace-existing";
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
    // area 已在 validateManifest() 里 fail-closed 校验过（缺失直接报错），这里不得再给任何默认值：
    // 兜底默认值会让"清单漏字段"变成"写到另一个区域目录"的静默错误。
    "UI/" + String(manifest.area) + "/View",
    "UI/" + String(manifest.area) + "/ViewModel"
  ];
  dirs.forEach(relative => fs.mkdirSync(path.join(projectRoot, ...relative.split("/")), { recursive: true }));
  return { projectRoot, scaffold: true, frameworkConfigPath };
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

// alreadyBackedUp：调用方已提前备份过该文件（为了把这份备份也登记进统一文件登记表），
// 此时不要再备份一次，否则同一秒内会多出一份重复副本。
function writeAuditOutput(target, content, overwrite, backups, alreadyBackedUp) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    if (!overwrite) fail("审计文件已存在，未覆盖: " + target);
    if (!alreadyBackedUp) backups.push(backupFile(target));
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

// 组件级「运行时提供图标」（映射表 iconPolicy=runtime）：Icon 是目标项目已存在的资源键，
// 本页不生成该 Geometry；引用它们不算缺失，剔除明细记在 bundle 审计 runtimeIcons。
function collectRuntimeIconKeys(mapping) {
  const keys = new Set();
  (mapping && Array.isArray(mapping.nodes) ? mapping.nodes : []).forEach(function (node) {
    if (node && typeof node.runtimeIcon === "string" && node.runtimeIcon.trim()) {
      keys.add(node.runtimeIcon.trim());
    }
  });
  return keys;
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
      } else if (node.langRefPolicy === "none") {
        // 槽位级豁免（例：选择框的「默认选中的名称」）优先于显式 keys[]：该值不参与多语言，
        // 给它登记语言键是自相矛盾的输入，直接失败，不静默忽略、也不静默挂上 LangName。
        problems.push("LanguageKey " + entry.key + " 的 sourceRef " + ref +
          " 指向槽位豁免的节点（langRefPolicy=none：该值运行时由数据决定，不参与多语言）——" +
          "请删除该显式键，或先撤销映射表里该槽位的 langRefPolicy");
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
      // 槽位级 langRefPolicy=none：该值不参与多语言（例：选择框的"默认选中名"，运行时由数据决定）。
      if (node.langRefPolicy === "none") continue;
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

  // 强制门禁：生成页面里所有设计文本都必须挂 LangName，除非显式列入 noLangRefs，
  // 或该节点所在的槽位登记了 langRefPolicy=none（槽位豁免，见 SKILL 多语言一节）。
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
      // 同上：槽位登记 langRefPolicy=none 的值不要求 LangName。
      if (node.langRefPolicy === "none") continue;
      if (node.valueSource !== "dsl.text") continue;
      // 空文本节点（设计稿里的空 TEXT，valueSource 仍是 dsl.text）：没有可翻译的文案，
      // 派生器本来就跳过它（if (!text || !ref) continue），门禁必须同口径——否则这类节点
      // 会让整套生成失败，逼调用方为一句空字符串登记 noLangRefs。
      if (!String(node.sourceText || "").trim()) continue;
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
  const runtimeIconKeys = collectRuntimeIconKeys(info.mapping);
  const missingReferences = [...iconReferences].filter(function (key) {
    return !geometryInfo.keys.has(key) && !runtimeIconKeys.has(key);
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
    // 输出节点索引：读容器的 contentInset（内容区原点）用。
    const nodeByRef = new Map((mapping.nodes || []).map(function (node) { return [node.ref, node]; }));
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
      // 输出父节点是容器（GroupBox 等）时，子坐标从"内容区原点"量：父容器坐标 + 边框/标题条内边距
      // （mapping 节点的 contentInset，来自映射表 infoGroupTemplates.styleInsets）。与生成器、校验器同口径。
      const parentNode = outputParentRef ? nodeByRef.get(outputParentRef) : null;
      const parentInset = !parentIsRoot && parentNode && parentNode.contentInset ? parentNode.contentInset : null;
      const originX = (parentSource ? (Number(parentSource.pageAbsX) || 0) : 0) + (parentInset ? (Number(parentInset.left) || 0) : 0);
      const originY = (parentIsRoot ? 192 : (parentSource ? (Number(parentSource.pageAbsY) || 0) : 192)) +
        (parentInset ? (Number(parentInset.top) || 0) : 0);
      const isTextBlock = (node.controlType || (node.attrs && node.attrs.ControlType)) === "TextBlock";
      // 表格列定义（nodeKind=table-column）按映射表 columnTemplate 固定几何发射：Left=0 / Top=0 /
      // Height=45、不写 Width。核对输入的 x/y 因此取「父容器原点」本身，w 传 "NaN"（与 XML 无 Width 对应）。
      if (node.nodeKind === "table-column") {
        return {
          id: node.xmlId || node.id || node.ref,
          x: originX,
          y: originY,
          w: "NaN",
          h: node.expectedHeight,
          contentOriginX: originX,
          contentOriginY: originY
        };
      }
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
    // 坐标核对是硬门禁：必须每次都执行，禁止因为"度量不是严格数字"而整段跳过
    // （旧写法 Number.isFinite("292") === false 会让整段核对消失，而审计仍写 static: passed）。
    // 度量按与 provenance 相同的 Number() 口径归一化：数值字符串（"292"）算数值；
    // TextBlock 的宽按规则恒为 "NaN"（NaN 只与 NaN 匹配，见 check-iocontrol-coords.js）。
    // 归一化后仍取不到值的节点不再在这里静默跳过，而是照常交给核对器 —— 由核对器
    // 在结果里点名 MISMATCH（"缺少设计稿度量"），因此失败路径只有一条。
    const coordNumber = function (value) {
      if (value === undefined || value === null || value === "") return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };
    const normalizedCoordNodes = coordNodes.map(function (node) {
      return Object.assign({}, node, {
        x: coordNumber(node.x),
        y: coordNumber(node.y),
        w: node.w === "NaN" ? "NaN" : coordNumber(node.w),
        h: node.h === "NaN" ? "NaN" : coordNumber(node.h)
      });
    });
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

// 统一文件登记：本次运行涉及的全部文件按 kind 分类，随笔写进 bundle 审计。
// kind 口径（详见 references/adapters/mtslg-iocontrol/bundle-manifest.md「统一文件登记」）：
//   project —— 项目产物（页面 XML / Icon / View 三件套 / Layout / 语言文件 / csproj / framework.config.json），永不清理；
//   audit   —— 交付证据（mapping / icon-map / nesting-report / 译文与术语表 / 本审计文件），保留；
//   work    —— 本次运行的工作文件（<generatedRoot>/_work/** 下的输入清单、派生清单、校验脚本与日志），收尾删除；
//   backup  —— 覆盖前的 .bak-<时间戳> 副本，由 lib/script-helpers.js 只保留最近 2 份。
function bundleFileRegistry(info, options) {
  const entries = [];
  const seen = new Set();
  // 已经是项目相对路径的条目（如语言文件）直接登记，不能再过 projectRelative。
  function pushRelative(relativePath, kind) {
    if (!relativePath) return null;
    // 归一成 / 分隔：projectRelative 与本脚本生成的路径都已是 /，这里再兜一次反斜杠输入
    // （清单里手写的 `Resources\Pages\...` 不会被 path.sep 切分，只会漏掉归一）。
    const normalized = String(relativePath).replace(/\\/g, "/");
    if (seen.has(normalized)) return null;
    seen.add(normalized);
    const entry = { path: normalized, kind: kind };
    entries.push(entry);
    return entry;
  }
  function push(filePath, kind) {
    if (!filePath) return null;
    // 只登记项目内的文件；清单里指向项目外的输入（如放在别处的 DSL 快照）不属于项目产物，
    // 登记进来只会产生 ../ 这类越界路径。
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(info.projectRoot) + path.sep)) return null;
    return pushRelative(projectRelative(info.projectRoot, resolved), kind);
  }
  const hostPaths = info.hostPaths || [];
  [info.pageXmlPath, info.iconPath, info.layoutPath, info.csprojPath]
    .concat(hostPaths)
    .concat(info.scaffold && info.frameworkConfigPath ? [info.frameworkConfigPath] : [])
    .forEach(function (filePath) { push(filePath, "project"); });
  // 语言文件在清单里本来就是项目相对路径，必须原样登记（过 projectRelative 会按 CWD 解析出错路径）。
  (info.langPaths || []).forEach(function (relativePath) { pushRelative(relativePath, "project"); });
  // View 的 code-behind 在 .csproj 里以 <DependentUpon> 挂在同页 View.xaml 下，登记时标出该归属关系。
  if (hostPaths[0] && hostPaths[1]) {
    const master = projectRelative(info.projectRoot, hostPaths[0]);
    const codeBehind = entries.find(function (entry) {
      return entry.path === projectRelative(info.projectRoot, hostPaths[1]);
    });
    if (codeBehind) codeBehind.dependsOn = master;
  }
  [info.mappingAudit, info.iconMapAudit, info.bundleAudit,
    info.langTranslationAudit, info.langGlossaryAudit, info.nestingAudit]
    .forEach(function (filePath) { push(filePath, "audit"); });
  // DSL 采集来源证据（dsl.snapshot / visibility / extractSvg）与生成目录下未显式登记的其它文件
  // （getDsl.json / coverage-report.json / manifest.json / timing.json 等）：一律按证据登记，
  // 避免出现"项目里有这个文件、登记表里却没有"的漏项。
  // 备份只登记**本次运行新产生**的副本——含 Bundle 自身的 copyOutput/writeAuditOutput，以及子脚本
  // gen-mtslg-layout.js / gen-mw-wpf-page.js 各自备份的文件（由 main 用运行前后差集补齐）。
  // 历史副本不入表：登记表的口径是"这一次生成产生了什么"，不是"项目里现在有什么"——
  // 同一项目后续会有很多页面，全量登记会把别的页面的历史文件全拖进来。
  (options.backups || []).forEach(function (filePath) { push(filePath, "backup"); });
  (options.sourceFiles || []).forEach(function (filePath) { push(filePath, "audit"); });
  (options.generatedFiles || []).forEach(function (filePath) { push(filePath, "audit"); });
  (options.workFiles || []).forEach(function (filePath) { push(filePath, "work"); });
  return entries;
}

// 扫描 <generatedRoot> 顶层文件（不含子目录、不含 _work）：覆盖 DSL 采集阶段的产物。
// 备份（.bak-<时间戳>）跳过：它们由 backupFile 单独登记为 backup 类。
function scanGeneratedFiles(generatedDir) {
  let names;
  try {
    names = fs.readdirSync(generatedDir);
  } catch (error) {
    return [];
  }
  const collected = [];
  names.forEach(function (name) {
    if (/\.bak-\d{8,}/.test(name)) return;
    const full = path.join(generatedDir, name);
    try {
      if (fs.statSync(full).isFile()) collected.push(full);
    } catch (error) {
      // 跳过读不到的条目
    }
  });
  return collected;
}

// 备份文件名：<任意文件>.bak-<14 位时间戳>，同秒内多次备份再带 -2/-3 序号。
const BACKUP_NAME_RE = /\.bak-\d{8,}(-\d+)?$/;

// 递归扫描项目内全部 .bak-<时间戳> 副本（跳过版本库/编译/IDE 目录）。
function scanProjectBackups(projectRoot) {
  const skip = new Set([".git", ".svn", ".vs", "bin", "obj", "node_modules", "packages"]);
  const collected = [];
  (function walk(dir) {
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch (error) {
      return;
    }
    names.forEach(function (name) {
      const full = path.join(dir, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch (error) {
        return;
      }
      if (stat.isDirectory()) {
        if (!skip.has(name)) walk(full);
        return;
      }
      if (BACKUP_NAME_RE.test(name)) collected.push(full);
    });
  })(projectRoot);
  return collected;
}

// 扫描 <generatedRoot>/_work/**：本管线的中间工作目录（输入清单、派生清单、校验脚本与日志）。
function scanWorkFiles(generatedDir) {
  const collected = [];
  (function walk(dir) {
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch (error) {
      return;
    }
    names.forEach(function (name) {
      const full = path.join(dir, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch (error) {
        return;
      }
      if (stat.isDirectory()) walk(full);
      else collected.push(full);
    });
  })(path.join(generatedDir, "_work"));
  return collected;
}

// 收尾清理：只删「登记为 work、路径里确实有 _work/ 段、且解析后仍在项目内」的文件。
// 任何一步校验不过就跳过；清理失败只记录不抛错（清理不足以中断生成）。
function cleanupWorkFiles(entries, projectRoot) {
  const removed = [];
  const rootPrefix = path.resolve(projectRoot) + path.sep;
  entries.forEach(function (entry) {
    if (entry.kind !== "work") return;
    const segments = String(entry.path).split("/");
    if (segments.indexOf("_work") === -1) return;
    const full = path.resolve(projectRoot, ...segments);
    if (!full.startsWith(rootPrefix)) return;
    try {
      fs.unlinkSync(full);
      entry.removed = true;
      removed.push(entry.path);
    } catch (error) {
      // 忽略：清理失败时保留文件比中断生成更安全。
    }
  });
  return removed;
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
  const existingMode = manifest.operation === "replace-existing";
  const scaffoldInfo = ensureScaffold(manifest);
  const projectRoot = scaffoldInfo.projectRoot;
  // 运行开始时的既有 .bak 快照：只用于事后算"本次运行新产生了哪些副本"。
  // 它不影响登记表内容——登记表仍然只记本次运行的文件。
  const backupsAtStart = new Set(scanProjectBackups(projectRoot));
  // 译文清单与术语表属于**本页生成产物**（每次生成来自当前页面的输入），不是插件固定资产：
  // 生成时同步落到该页审计目录 Generated/<Page>.lang-translations.json / .lang-glossary.json。
  const langTranslationsInput = resolveLangTranslations(manifestDir, projectRoot, manifest);
  const langGlossaryInput = resolveLangGlossary(manifestDir, projectRoot, manifest);
  const csprojPath = resolvePath(projectRoot, manifest.csproj, "csproj");
  if (!fs.existsSync(csprojPath)) fail("csproj 不存在: " + csprojPath);
  const csprojText = fs.readFileSync(csprojPath, "utf8");
  const hostPaths = inferHostPaths({
    manifest: manifest,
    projectRoot: projectRoot,
    csprojText: csprojText,
    viewName: manifest.viewName || manifest.pageName + "View",
    viewModelName: manifest.viewModelName || manifest.pageName + "ViewModel"
  });

  const pageXmlPath = resolvePath(projectRoot, manifest.pageXmlPath, "pageXmlPath");
  const iconPath = resolvePath(projectRoot, manifest.iconPath, "iconPath");
  const layoutPath = resolvePath(projectRoot, manifest.layoutPath || DEFAULT_LAYOUT_PATH, "layoutPath");
  // mappingPath 是所有模式必填的 mapping 工作落盘路径。缺失时 resolveInput 内部会抛裸
  // TypeError（path.isAbsolute(undefined)），这里先给出可读的失败信息；口径见
  // references/adapters/mtslg-iocontrol/bundle-manifest.md §3.1。
  if (typeof manifest.mappingPath !== "string" || !manifest.mappingPath.trim()) {
    fail("必须提供 mappingPath：它是 mapping 的工作落盘路径（新建页面时由本次生成写入、随后被重新生成覆盖），" +
      "不要指向 Generated/<页面名>.mapping.json（审计产物）");
  }
  const mappingPath = resolveInput(manifestDir, projectRoot, manifest.mappingPath, "mappingPath");
  // 运行登记表（可选，清单里以 runRegistry.path 给出）：
  //   采集输入（DSL 快照 / 可见性 / extractSvg）**只按登记表解析**，并逐项复校 sha256；
  //   同时拒绝"未登记的旧同名文件"（legacy shadow：Generated/dsl.snapshot.json 这类），
  //   避免上一次运行的旧文件被静默当成本次输入。
  let runRegistryFile = null;
  let runRegistryData = null;
  if (manifest.runRegistry && manifest.runRegistry.path) {
    runRegistryFile = path.isAbsolute(manifest.runRegistry.path)
      ? path.resolve(manifest.runRegistry.path)
      : path.resolve(projectRoot, manifest.runRegistry.path);
    runRegistryData = RUN_REGISTRY.loadRegistry(runRegistryFile);
    if (manifest.runRegistry.runId && runRegistryData.runId !== manifest.runRegistry.runId) {
      fail("Bundle 清单与运行登记表不是同一次运行：清单 runId=" + manifest.runRegistry.runId +
        "，登记表 runId=" + runRegistryData.runId + "（" + manifest.runRegistry.path + "）");
    }
    const expectedDigests = manifest.runRegistry.digests || {};
    const bound = {};
    for (const [key, field] of [["snapshot", "dslPath"], ["visibility", "visibilityPath"], ["extractSvg", "svgPath"]]) {
      const abs = RUN_REGISTRY.resolveArtifact(runRegistryData, key, { projectRoot });
      const entry = runRegistryData.artifacts[key];
      if (expectedDigests[key] && expectedDigests[key] !== entry.sha256) {
        fail("Bundle 清单登记的 " + key + " sha256 与运行登记表不一致：清单=" + expectedDigests[key] +
          "，登记表=" + entry.sha256 + "（清单被改写，或与登记表不是同一次运行）");
      }
      RUN_REGISTRY.assertNoLegacyShadow(runRegistryData, key, { projectRoot });
      manifest[field] = RUN_REGISTRY.projectRelative(projectRoot, abs);
      bound[field] = manifest[field];
    }
    console.log("运行登记表: runId=" + runRegistryData.runId + "，采集输入按登记表绑定：" + JSON.stringify(bound));
  }
  // 审计产物路径（与下方 generatedDir/mappingAudit 同口径，定义提前以便在这里前置校验）。
  const mappingAuditPath = path.join(projectRoot, "Generated", manifest.pageName + ".mapping.json");
  if (path.resolve(mappingPath) === path.resolve(mappingAuditPath)) {
    fail("mappingPath 不能与审计产物同路径: " + mappingAuditPath +
      "；新建模式会因“目标文件已存在”失败，请改用独立工作路径（例如 Generated/_work/<页面名>.mapping.json）");
  }
  const svgPath = resolveInput(manifestDir, projectRoot, manifest.svgPath, "svgPath");
  // DSL 采集输入路径提前解析：既给映射生成器用，也给统一文件登记表用（登记为 audit 来源证据）。
  const dslInputPath = manifest.dslPath
    ? resolveInput(manifestDir, projectRoot, manifest.dslPath, "dslPath") : null;
  const visibilityInputPath = manifest.visibilityPath
    ? resolveInput(manifestDir, projectRoot, manifest.visibilityPath, "visibilityPath") : null;
  const iconMapPath = resolveInput(manifestDir, projectRoot, manifest.iconMapPath, "iconMapPath");
  const templateMapPath = manifest.templateMapPath
    ? resolveInput(manifestDir, projectRoot, manifest.templateMapPath, "templateMapPath")
    : DEFAULT_TEMPLATE_MAP;
  const autoMapping = Boolean(manifest.dslPath || manifest.visibilityPath);
  // New pages always create their page-specific mapping from the current
  // design snapshot. Replace-existing runs may provide an explicit mapping
  // because they retain existing runtime/business data.
  if (!existingMode && (!manifest.dslPath || !manifest.visibilityPath)) {
    fail("新建页面必须提供当前页面的 dslPath 和 visibilityPath；mapping 将在本次生成中创建");
  }
  [svgPath, iconMapPath, templateMapPath].concat(autoMapping ? [] : [mappingPath]).forEach(function (filePath) {
    if (!fs.existsSync(filePath)) fail("输入文件不存在: " + filePath);
  });
  if (manifest.dslPath || manifest.visibilityPath) {
    if (!manifest.dslPath || !manifest.visibilityPath) fail("启用 DSL 自动映射时必须同时提供 dslPath 和 visibilityPath");
    const dslPath = dslInputPath;
    const visibilityPath = visibilityInputPath;
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
  const mappingAudit = mappingAuditPath;
  const iconMapAudit = path.join(generatedDir, manifest.pageName + ".icon-map.json");
  const bundleAudit = path.join(generatedDir, manifest.pageName + ".bundle.manifest.json");
  const auditTargets = [mappingAudit, iconMapAudit, bundleAudit];
  const nestingAudit = path.join(generatedDir, manifest.pageName + ".nesting-report.json");
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
  if (args.overwrite && manifest.operation !== "replace-existing") {
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
  // 组件级「运行时提供图标」的剔除审计（无此类登记时为 null，不进审计文件）。
  let runtimeIconAudit = null;
  const originalCsproj = fs.readFileSync(csprojPath, "utf8");
  const snapshots = snapshotFiles(outputTargets.concat(langTargets).concat([layoutPath, mappingAudit, iconMapAudit, bundleAudit, csprojPath])
    .concat([nestingAudit])
    .concat(scaffoldInfo.frameworkConfigPath ? [scaffoldInfo.frameworkConfigPath] : []));

  try {
    run(TEMPLATE_RESOLVER_SCRIPT, [
      "--mapping", mappingPath,
      "--map", templateMapPath,
      "--out", tempMapping
    ]);
    let mapping = readJson(tempMapping);
    // 容器嵌套（默认开启，manifest.nesting.enabled === false 可关）：
    // 已登记容器（变体 childPolicy=nested-page-templates）按「坐标完全包含」把平级子控件重挂为子节点，
    // 后续的语言绑定 / XML 发射 / provenance / 坐标核对都以重挂后的 mapping 为准。
    const nestingEnabled = !(manifest.nesting && manifest.nesting.enabled === false);
    let nestingReport = null;
    const nestingReportPath = path.join(tempRoot, "nesting-report.json");
    if (nestingEnabled) {
      run(CONTAINMENT_SCRIPT, [
        "--mapping", tempMapping,
        "--template-map", templateMapPath,
        "--out", tempMapping,
        "--report", nestingReportPath
      ]);
      nestingReport = readJson(nestingReportPath);
      mapping = readJson(tempMapping);
    }
    const contentOriginY = mapping.contentOriginY === undefined
      ? 192 : Number(mapping.contentOriginY);
    if (contentOriginY !== 192) {
      fail("contentOriginY 必须固定为 192");
    }
    // 自动产键：从当前页 DSL/mapping/Layout 菜单项机械派生 LanguageKey，显式登记项优先。
    if (autoLang) {
      // 复用上面已解析的 dslInputPath：同一个输入不重复解析（路径解析口径只保留一处）。
      const langDsl = dslInputPath ? readJson(dslInputPath) : null;
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
        locales: langLocales,
        // 按钮族清单的唯一真值源是模板表 buttonFamily.controlTypes：这里按表传入，
        // 派生器只在没拿到该参数时才退回自己的内置默认（与表内容一致）。
        buttonControlTypes: (function () {
          const buttonFamily = readJson(templateMapPath, "template map").buttonFamily;
          return buttonFamily && Array.isArray(buttonFamily.controlTypes) ? buttonFamily.controlTypes : null;
        })()
      });
      manifest.languages = mergeAutoLangKeys(derived.languages, manifest.languages);
      autoLangReport = derived.report;
      // 报告与最终语言清单必须一致：显式 keys[] 覆盖掉的临时键已不在最终清单里，
      // 不能再留在"待工程师改名"的 provisionalKeys 清单里（否则交付说明会列出不存在的键）。
      if (autoLangReport && Array.isArray(autoLangReport.provisionalKeys)) {
        const finalKeys = new Set(manifest.languages.keys.map(function (entry) { return entry.key; }));
        autoLangReport.provisionalKeys = autoLangReport.provisionalKeys.filter(function (item) {
          return finalKeys.has(item.key);
        });
      }
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
    // 传入 DSL 快照：extractSvg 因几何完全相同的复用而漏条目时，图标生成器可从 DSL 合成补上；
    // discover 也用它给候选补台账提示（祖先朝向 bakeAncestorTransform）。
    // 同上：复用 dslInputPath，避免 dslPath 被解析三次。
    const iconDslPath = dslInputPath;
    run(ICON_DISCOVERY_SCRIPT, [
      "--svg", svgPath,
      "--mapping", mappingPath,
      "--confirmed", iconMapPath,
      "--out", tempIconMap
    ].concat(iconDslPath ? ["--dsl", iconDslPath] : []));
    // 组件级「运行时提供图标」（映射表 iconPolicy=runtime）：Icon 是目标项目已存在的资源键，
    // 本页不生成该 Geometry —— 把这些节点的台账条目从三个桶里剔除并单独记审计；未登记的图标不动。
    const runtimeIconOwners = new Set();
    for (const node of (Array.isArray(mapping.nodes) ? mapping.nodes : [])) {
      if (node && typeof node.runtimeIcon === "string" && node.runtimeIcon !== "" &&
          typeof node.sourceRef === "string" && node.sourceRef !== "") {
        runtimeIconOwners.add(node.sourceRef);
      }
    }
    if (runtimeIconOwners.size > 0) {
      const ledger = readJson(tempIconMap);
      const ownedByRuntime = function (entry) {
        if (!entry || typeof entry !== "object") return false;
        for (const ref of runtimeIconOwners) {
          if (entry.ownerRef === ref) return true;
          if (typeof entry.sourceId === "string" && entry.sourceId.indexOf(ref + "/") === 0) return true;
          if (typeof entry.sourceRef === "string" && entry.sourceRef.indexOf(ref + "/") === 0) return true;
        }
        return false;
      };
      const runtimeIcons = [];
      for (const bucket of ["icons", "candidates", "unmapped"]) {
        if (!Array.isArray(ledger[bucket])) continue;
        const kept = [];
        for (const entry of ledger[bucket]) {
          if (ownedByRuntime(entry)) runtimeIcons.push({ bucket, icon: entry.name || null, ownerRef: entry.ownerRef || null });
          else kept.push(entry);
        }
        ledger[bucket] = kept;
      }
      ledger.runtimeIcons = runtimeIcons;
      fs.writeFileSync(tempIconMap, JSON.stringify(ledger, null, 2) + "\n", "utf8");
      runtimeIconAudit = { owners: [...runtimeIconOwners], removed: runtimeIcons.length };
    }
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
    // 容器嵌套审计：容器清单 / 重挂明细 / 冲突清单（关闭 nesting 时不产出该文件）。
    if (nestingReport) {
      writeAuditOutput(nestingAudit, fs.readFileSync(nestingReportPath, "utf8"), args.overwrite, backups);
    }
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
      langGlossaryAudit,
      nestingAudit: nestingReport ? nestingAudit : null
    };
    // 统一文件登记：本次运行涉及的全部文件按 kind 分类；收尾按 kind 清理 work
    // （manifest.cleanup.work === false 可关闭，默认开启——重跑本来就要重新走一遍）。
    const workCleanupEnabled = !(manifest.cleanup && manifest.cleanup.work === false);
    const workFiles = scanWorkFiles(generatedDir);
    // 收尾清理是破坏性的：先确认审计文件可写。审计已存在且未加 --overwrite 时在这里就失败，
    // 避免"先删掉 work、再报错退出"的顺序（那时 work 已经回不来了）。
    if (fs.existsSync(bundleAudit) && !args.overwrite) fail("审计文件已存在，未覆盖: " + bundleAudit);
    // 审计文件自身的旧版本在登记表之前备份：否则它是"登记表写完之后才产生的备份"，必然漏项。
    const auditBackup = fs.existsSync(bundleAudit) ? backupFile(bundleAudit) : null;
    if (auditBackup) backups.push(auditBackup);
    const fileRegistry = bundleFileRegistry(bundleInfo, {
      sourceFiles: [dslInputPath, visibilityInputPath, svgPath].filter(Boolean),
      generatedFiles: scanGeneratedFiles(generatedDir),
      workFiles: workFiles,
      // 本次运行新产生的副本 = Bundle 自己记录的 ∪ 运行前后差集（差集覆盖子脚本产生的那些）。
      backups: backups.concat(scanProjectBackups(projectRoot).filter(function (filePath) {
        return !backupsAtStart.has(filePath);
      }))
    });
    const removedWorkFiles = workCleanupEnabled ? cleanupWorkFiles(fileRegistry, projectRoot) : [];
    // 运行登记表：把本次运行的产物（files[]）并回 outputs，让"输入登记"和"输出登记"共用同一个 runId 身份。
    if (runRegistryData && runRegistryFile) {
      const outputCount = RUN_REGISTRY.recordOutputs(runRegistryData, fileRegistry, { projectRoot });
      RUN_REGISTRY.saveRegistry(runRegistryFile, runRegistryData);
      console.log("运行登记表已登记 " + outputCount + " 个输出文件: " + RUN_REGISTRY.projectRelative(projectRoot, runRegistryFile));
    }
    writeAuditOutput(bundleAudit, JSON.stringify({
      adapter: "mtslg-iocontrol",
      hostShell: "maxwell-wpf",
      projectMode: scaffoldInfo.scaffold ? "scaffold" : "target-project",
      contentOriginY: 192,
      // 统一文件登记（唯一文件清单）：每条带 kind（project / audit / work / backup），收尾清理按它执行。
      // 不再单列 generated[]：它与 files[] 完全重叠，保留两份会漂移。
      files: fileRegistry,
      // 输入快照：即使 <generatedRoot>/_work/ 被收尾删除，本次运行的输入清单也能从这里复原。
      inputs: manifest,
      cleanup: { work: { enabled: workCleanupEnabled, removed: removedWorkFiles } },
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
      // 组件级「运行时提供图标」：被剔除的页面 Icon 条目（Icon 由目标项目提供，本页不生成）。
      runtimeIcons: runtimeIconAudit,
      // 容器嵌套：默认开启；记录容器数/重挂数/冲突数（明细见 Generated/<Page>.nesting-report.json）。
      nesting: {
        enabled: nestingEnabled,
        report: nestingReport ? path.relative(projectRoot, nestingAudit).split(path.sep).join("/") : null,
        containers: nestingReport ? nestingReport.containers.length : 0,
        reparented: nestingReport ? nestingReport.reparented.length : 0,
        conflicts: nestingReport ? nestingReport.conflicts.length : 0
      },
      // 表格：结构签名命中后发射的 DataGrid（列定义来自表头，行按数据登记不发射控件）。
      // valuePending=true 表示该表根节点的 Value 仍是当前阶段的空串占位（数据源待工程师/运行时绑定）。
      tables: (Array.isArray(mapping.tableAudits) ? mapping.tableAudits : []).map(function (table) {
        return {
          ref: table.ref,
          name: table.name,
          xmlId: table.xmlId,
          columns: Array.isArray(table.columns) ? table.columns.length : 0,
          columnControlTypes: (Array.isArray(table.columns) ? table.columns : []).map(function (column) { return column.controlType; }),
          rows: Array.isArray(table.rows) ? table.rows.length : 0,
          valueAttr: table.valueAttr,
          valuePending: table.valuePending === true,
          declaredBoxCoversContent: table.geometry ? table.geometry.declaredBoxCoversContent : null
        };
      }),
      layout: {
        status: manifest.layoutStatus,
        evidence: manifest.layoutEvidence,
        menuItemCount: manifest.menuItems.length
      }
    }, null, 2) + "\n", args.overwrite, backups, true);
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
    identicalTextKeys: autoLangReport ? autoLangReport.identicalTextKeys.length : 0
      } : null,
      languagesDefaulted: langDefaulted,
      languageDisabled: langDisabled,
      languageDisabledReason: langDisabledReason,
      languageWarning: langSpec
        ? null
        : (langDisabled
          ? null
          : "manifest 未提供 languages：本次未生成语言字典，页面不会挂 LangName（多语言默认开启，请检查 languages 是否被显式关闭）"),
      files: {
        project: fileRegistry.filter(function (entry) { return entry.kind === "project"; }).length,
        audit: fileRegistry.filter(function (entry) { return entry.kind === "audit"; }).length,
        work: fileRegistry.filter(function (entry) { return entry.kind === "work"; }).length,
        backup: fileRegistry.filter(function (entry) { return entry.kind === "backup"; }).length
      },
      workRemoved: removedWorkFiles.length,
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
