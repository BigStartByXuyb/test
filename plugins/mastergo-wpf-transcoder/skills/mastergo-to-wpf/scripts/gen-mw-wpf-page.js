#!/usr/bin/env node
"use strict";

// 生成一个独立 MW WPF 页面：View、code-behind、ViewModel，并注册到旧式 csproj。
// 页面 XML 与 Icon Geometry 仍由各自生成器负责，本脚本只生成 WPF 宿主壳。

const fs = require("fs");
const path = require("path");
// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const { fail, xmlAttr, xmlDocText, backupFile } = require(path.join(__dirname, "lib", "script-helpers.js"));
const { inferHostPaths: inferHostPathsShared } = require(path.join(__dirname, "lib", "project-csproj.js"));

function usage() {
  console.error("用法: node gen-mw-wpf-page.js --manifest <page.json> [--overwrite]");
  process.exit(2);
}

function parseArgs(argv) {
  let manifestPath = null;
  let overwrite = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--manifest") manifestPath = argv[++i];
    else if (argv[i] === "--overwrite") overwrite = true;
    else usage();
  }
  if (!manifestPath) usage();
  return { manifestPath, overwrite };
}

function isIdentifier(value) {
  return typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function safeRelativePath(value, field) {
  if (typeof value !== "string" || !value.trim()) fail(field + " 不能为空");
  const normalized = value.replace(/\\/g, "/");
  if (path.posix.isAbsolute(normalized) || normalized.split("/").includes("..")) {
    fail(field + " 必须是项目根目录下的相对路径: " + value);
  }
  return normalized.replace(/^\.\//, "");
}

function projectPath(projectRoot, relativePath, field) {
  const rel = safeRelativePath(relativePath, field);
  const result = path.resolve(projectRoot, ...rel.split("/"));
  const root = path.resolve(projectRoot) + path.sep;
  if (result !== path.resolve(projectRoot) && !result.startsWith(root)) {
    fail(field + " 超出项目根目录: " + relativePath);
  }
  return result;
}

function projectInclude(relativePath) {
  return safeRelativePath(relativePath, "项目文件路径").replace(/\//g, "\\");
}

function namespaceSegment(value) {
  const segment = String(value).replace(/[^A-Za-z0-9_]/g, "_");
  if (!isIdentifier(segment)) fail("area 不能转换为有效 C# 命名空间段: " + value);
  return segment;
}

function readRootNamespace(csprojText) {
  const match = csprojText.match(/<RootNamespace>\s*([^<]+?)\s*<\/RootNamespace>/i);
  return match ? match[1].trim() : null;
}

// 宿主路径推断的唯一实现在 lib/project-csproj.js（本脚本只做 safeRelativePath 校验）。
// 无项目路径证据时才落 Pages/ 兜底，避免给同一页面生成第二套 UI/Pages。
function inferHostPaths(manifest, projectRoot, csprojText, viewName, viewModelName) {
  const paths = inferHostPathsShared({
    manifest: manifest,
    projectRoot: projectRoot,
    csprojText: csprojText,
    viewName: viewName,
    viewModelName: viewModelName
  });
  return {
    viewRelative: safeRelativePath(paths.view, "viewPath"),
    codeBehindRelative: safeRelativePath(paths.codeBehind, "codeBehindPath"),
    viewModelRelative: safeRelativePath(paths.viewModel, "viewModelPath")
  };
}

function findCsproj(projectRoot, requested) {
  if (requested) return projectPath(projectRoot, requested, "csproj");
  const candidates = fs.readdirSync(projectRoot).filter(function (name) {
    return name.toLowerCase().endsWith(".csproj");
  });
  if (candidates.length !== 1) {
    fail("无法唯一确定 csproj，请在 manifest 中指定 csproj（发现 " + candidates.length + " 个）");
  }
  return path.join(projectRoot, candidates[0]);
}

function loadManifest(manifestPath) {
  const manifestFile = path.resolve(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const projectRoot = path.resolve(manifest.projectRoot || path.dirname(manifestFile));
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    fail("projectRoot 不存在或不是目录: " + projectRoot);
  }
  const csprojPath = findCsproj(projectRoot, manifest.csproj);
  const csprojText = fs.readFileSync(csprojPath, "utf8");
  const rootNamespace = manifest.rootNamespace || readRootNamespace(csprojText);
  if (!rootNamespace) fail("manifest 或 csproj 必须提供 RootNamespace");
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(rootNamespace)) {
    fail("RootNamespace 无效: " + rootNamespace);
  }

  const pageName = manifest.name || manifest.pageName;
  if (!isIdentifier(pageName)) fail("pageName 必须是有效 C# 标识符: " + pageName);
  if (manifest.name && manifest.pageName && manifest.name !== manifest.pageName) {
    fail("manifest.name 与 manifest.pageName 必须一致");
  }
  const viewName = manifest.viewName || pageName + "View";
  const viewModelName = manifest.viewModelName || pageName + "ViewModel";
  const xmlPageName = manifest.xmlPageName || pageName + "Page";
  [["viewName", viewName], ["viewModelName", viewModelName], ["xmlPageName", xmlPageName]]
    .forEach(function (item) {
      if (!isIdentifier(item[1])) fail(item[0] + " 必须是有效 C# 标识符: " + item[1]);
    });

  const area = safeRelativePath(manifest.area, "area");
  if (area.split("/").some(function (part) { return !part || part === "."; })) {
    fail("area 无效: " + manifest.area);
  }
  const namespaceArea = area.split("/").map(namespaceSegment).join(".");
  // 页面多语言资源字典：与页面 XML/Icon 同目录，形如 Resources/Pages/<页面名>/<页面名>_<语言>.xaml。
  const langPaths = (Array.isArray(manifest.langPaths) ? manifest.langPaths : [])
    .map(function (relative) { return safeRelativePath(relative, "langPath"); });
  // 只有真正的新建页面才强制约定路径；modify-existing / replace-existing 必须沿用项目已声明的真实路径。
  if (!["modify-existing", "replace-existing"].includes(manifest.operation)) {
    const expectedPaths = {
      iconPath: "Resources/Pages/" + pageName + "/" + pageName + "Icons.xaml",
      pageXmlPath: "Resources/Pages/" + pageName + "/" + pageName + "Page.xml",
      viewPath: "UI/" + area + "/View/" + pageName + "View.xaml",
      codeBehindPath: "UI/" + area + "/View/" + pageName + "View.xaml.cs",
      viewModelPath: "UI/" + area + "/ViewModel/" + pageName + "ViewModel.cs"
    };
    Object.keys(expectedPaths).forEach(function (field) {
      if (manifest[field] && manifest[field].replace(/\\/g, "/") !== expectedPaths[field]) {
        fail("新建页面的 " + field + " 必须使用约定路径: " + expectedPaths[field]);
      }
    });
    const langPrefix = "Resources/Pages/" + pageName + "/" + pageName + "_";
    langPaths.forEach(function (relative) {
      if (relative.indexOf(langPrefix) !== 0 || !/\.xaml$/i.test(relative)) {
        fail("新建页面的多语言文件必须使用约定路径: " + langPrefix + "<语言>.xaml");
      }
    });
  }
  const includeIcon = Boolean(manifest.includeIcon || manifest.iconPath);
  const iconPath = includeIcon
    ? safeRelativePath(manifest.iconPath || "Resources/Pages/" + pageName + "/" + pageName + "Icons.xaml", "iconPath")
    : null;
  const pageXmlPath = safeRelativePath(
    manifest.pageXmlPath || "Resources/Pages/" + pageName + "/" + xmlPageName + ".xml", "pageXmlPath");
  const hostPaths = inferHostPaths(manifest, projectRoot, csprojText, viewName, viewModelName);
  const viewRelative = hostPaths.viewRelative;
  const codeBehindRelative = hostPaths.codeBehindRelative;
  const viewModelRelative = hostPaths.viewModelRelative;
  const files = [
    { kind: "Page", relative: viewRelative },
    { kind: "Compile", relative: codeBehindRelative },
    { kind: "Compile", relative: viewModelRelative }
  ];
  if (iconPath) files.push({ kind: "Page", relative: iconPath });
  langPaths.forEach(function (relative) { files.push({ kind: "Page", relative }); });
  files.push({ kind: "Content", relative: pageXmlPath });
  // 底部按钮（Layout MenuItem）→ ViewModel 的 case 列表与按钮处理方法名。
  const buttonNames = normalizeButtonNames(manifest);
  const buttonHandlers = resolveButtonHandlers(manifest, buttonNames, viewModelName);
  return {
    projectRoot, csprojPath, csprojText, rootNamespace, area, namespaceArea,
    operation: manifest.operation || "new",
    pageName, viewName, viewModelName, xmlPageName, iconPath, pageXmlPath,
    langPaths,
    viewRelative, codeBehindRelative, viewModelRelative,
    buttonNames,
    buttonHandlers,
    designWidth: manifest.designWidth || 1280, designHeight: manifest.designHeight || 1024,
    files
  };
}

function renderView(config) {
  const className = config.rootNamespace + "." + config.namespaceArea + ".View." + config.viewName;
  const lines = [
    "<UserControl x:Class=\"" + className + "\"",
    "    xmlns=\"http://schemas.microsoft.com/winfx/2006/xaml/presentation\"",
    "    xmlns:x=\"http://schemas.microsoft.com/winfx/2006/xaml\"",
    "    xmlns:s=\"http://www.maxwell-gp.com/\"",
    "    xmlns:uidesign=\"clr-namespace:MaxWell.UIDesign;assembly=MaxWell.UIDesign\"",
    "    xmlns:d=\"http://schemas.microsoft.com/expression/blend/2008\"",
    "    xmlns:mc=\"http://schemas.openxmlformats.org/markup-compatibility/2006\"",
    "    d:DesignHeight=\"" + xmlAttr(config.designHeight) + "\" d:DesignWidth=\"" +
      xmlAttr(config.designWidth) + "\" mc:Ignorable=\"d\">"
  ];
  // 不生成 <UserControl.Resources>：宿主壳只保留 UserControl 头 + PageDesign。
  // 页面 Icon 文件仍照常生成并按 Icon Page 注册进 .csproj；
  // 宿主脚本不写页面级资源合并声明。
  lines.push("  <Grid>");
  lines.push("    <uidesign:PageDesign x:Name=\"pageDesign\" XmlPagePath=\"" +
    xmlAttr(config.xmlPageName) + "\" Loaded=\"{s:Action PageDesign_Loaded}\" />");
  lines.push("  </Grid>");
  lines.push("</UserControl>");
  return lines.join("\n") + "\n";
}

function renderCodeBehind(config) {
  const ns = config.rootNamespace + "." + config.namespaceArea + ".View";
  return [
    "using System.Windows.Controls;", "",
    "namespace " + ns, "{",
    "    public partial class " + config.viewName + " : UserControl", "    {",
    "        public " + config.viewName + "()", "        {",
    "            InitializeComponent();", "        }", "    }", "}", ""
  ].join("\n");
}

function renderViewModel(config) {
  const ns = config.rootNamespace + "." + config.namespaceArea + ".ViewModel";
  // switch (message.ButtonName) 的 case：本页底部（Layout Menu）全部按钮名，
  // 逐个生成 case 骨架供工程师填业务；空名称按钮不生成 case。
  // 能解析出英文方法名的按钮：case 只负责调用该按钮的处理函数（一钮一方法），
  // 函数体只留 TODO 注释；方法名解析不出来的按钮退回内联 TODO（不猜名字）。
  const handlers = (config.buttonHandlers && config.buttonHandlers.methods) || [];
  const methodByName = new Map(handlers.map(function (item) { return [item.name, item.method]; }));
  const caseLines = [];
  (config.buttonNames || []).forEach(function (name) {
    // case 相对 switch 的 { 再缩进一层（4 空格），case 体再缩进一层。
    caseLines.push("                    case \"" + csString(name) + "\":");
    const method = methodByName.get(name);
    if (method) caseLines.push("                        " + method + "();");
    else caseLines.push("                        // TODO: " + name + " 按钮处理");
    caseLines.push("                        break;");
  });
  const head = [
    "using MaxWell.UIDesign;",
    "using MaxwellFramework.Core.Events;",
    "using MaxwellFramework.Core.Interfaces;",
    "using MaxwellFramework.Core.Layout;",
    "using System.Windows;", "",
    "namespace " + ns, "{",
    "    public class " + config.viewModelName + " : IOScreen, IPage", "    {",
    "        public PageDesign pageDesign { get; set; }", "",
    "        public " + config.viewModelName + "()", "        {",
    "            Name = \"" + config.pageName + "\";", "        }", "",
    "        protected override void OnViewLoaded()", "        {",
    "            base.OnViewLoaded();", "        }", "",
    "        public void PageDesign_Loaded(object sender, RoutedEventArgs e)", "        {",
    "            pageDesign = sender as PageDesign;", "        }", "",
    "        /// <summary>", "        /// 按钮配置", "        /// </summary>",
    "        /// <param name=\"message\"></param>",
    "        public override void HandleButtonEvent(ButtonEvent message)", "        {",
    "            if (message.IsMouseDown)", "            {",
    "                switch (message.ButtonName)", "                {"
  ];
  // 按钮处理方法：一钮一方法，方法体只留 TODO，业务由工程师填。
  // <summary> 写设计稿按钮文案（中文），方法名写英文语义名。
  const handlerLines = [];
  handlers.forEach(function (item) {
    if (handlerLines.length) handlerLines.push("");
    handlerLines.push("        /// <summary>");
    handlerLines.push("        /// " + xmlDocText(item.name));
    handlerLines.push("        /// </summary>");
    handlerLines.push("        private void " + item.method + "()");
    handlerLines.push("        {");
    handlerLines.push("            // TODO: " + item.name + " 按钮处理");
    handlerLines.push("        }");
  });
  const tail = [
    "                }", "            }", "        }"
  ].concat(handlerLines.length ? [""].concat(handlerLines) : []).concat([
    "",
    "        /// <summary>", "        /// 确认按钮", "        /// </summary>",
    "        public void OKCmd()", "        {",
    "            pageDesign.SaveXml();", "        }", "    }", "}", ""
  ]);
  return head.concat(caseLines).concat(tail).join("\n");
}

// C# 字符串字面量转义（按钮名可能含引号/反斜杠）。
function csString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

// 底部按钮名列表：优先 manifest.buttonNames；否则从 manifest.menuItems[].name 派生；去重、跳过空名。
function normalizeButtonNames(manifest) {
  const list = [];
  const push = function (value) {
    const name = String(value === undefined || value === null ? "" : value).trim();
    if (name && list.indexOf(name) === -1) list.push(name);
  };
  if (Array.isArray(manifest.buttonNames)) manifest.buttonNames.forEach(push);
  if (Array.isArray(manifest.menuItems)) manifest.menuItems.forEach(function (item) { if (item) push(item.name); });
  return list;
}

// C# 关键字：派生出的按钮方法名命中关键字时不可直接使用，退回内联 TODO（不猜、不改名）。
const CSHARP_KEYWORDS = new Set([
  "abstract", "as", "base", "bool", "break", "byte", "case", "catch", "char", "checked", "class",
  "const", "continue", "decimal", "default", "delegate", "do", "double", "else", "enum", "event",
  "explicit", "extern", "false", "finally", "fixed", "float", "for", "foreach", "goto", "if",
  "implicit", "in", "int", "interface", "internal", "is", "lock", "long", "namespace", "new",
  "null", "object", "operator", "out", "override", "params", "private", "protected", "public",
  "readonly", "ref", "return", "sbyte", "sealed", "short", "sizeof", "stackalloc", "static",
  "string", "struct", "switch", "this", "throw", "true", "try", "typeof", "uint", "ulong",
  "unchecked", "unsafe", "ushort", "using", "virtual", "void", "volatile", "while"
]);

// 菜单项 LanguageKey 命名空间 = MenuItem + 语义英文名（见 gen-mtslg-lang-keys-from-dsl.js）。
// MenuItemIndex<n> 是语言键派生器在拿不到语义名时写的临时键，不能当作按钮英文名使用。
const MENU_KEY_PREFIX = "MenuItem";
const PROVISIONAL_MENU_KEY = /^MenuItemIndex\d+$/;

// ViewModel 固定成员：按钮处理方法与它们同名会生成重复的 C# 成员，直接失败。
const RESERVED_VIEWMODEL_MEMBERS = ["pageDesign", "OnViewLoaded", "PageDesign_Loaded", "HandleButtonEvent", "OKCmd"];

// 由菜单项 LanguageKey 派生按钮处理方法名：MenuItemFocus -> Focus。
// 取不到语义名（临时键 / 前缀不符 / 非法标识符 / C# 关键字）返回空串，由调用方退回内联 TODO。
function methodNameFromLangName(langName) {
  const key = typeof langName === "string" ? langName.trim() : "";
  if (key === "" || PROVISIONAL_MENU_KEY.test(key)) return "";
  if (key.indexOf(MENU_KEY_PREFIX) !== 0) return "";
  const suffix = key.slice(MENU_KEY_PREFIX.length);
  if (!isIdentifier(suffix) || CSHARP_KEYWORDS.has(suffix)) return "";
  return suffix;
}

// 按钮处理方法解析（机械、可审计，不推断语义）：
//   取值链 1：menuItems[].methodName（工程师显式登记，优先）
//   取值链 2：menuItems[].langName 去掉 MenuItem 前缀
// 一个按钮对应一个 case、一个处理方法；解析不出方法名的按钮退回内联 TODO 并记录原因。
// 硬约束（fail-closed，不静默改名、也不退回）：算出的方法名与 ViewModel 固定成员/类名同名，
// 或两个按钮算出同一方法名时，直接失败——这类输入会生成重复的 C# 成员，编译必然失败。
function resolveButtonHandlers(manifest, buttonNames, viewModelName) {
  const itemByName = new Map();
  (Array.isArray(manifest.menuItems) ? manifest.menuItems : []).forEach(function (item) {
    if (!item) return;
    const name = String(item.name === undefined || item.name === null ? "" : item.name).trim();
    if (!name || itemByName.has(name)) return;
    itemByName.set(name, item);
  });
  const methods = [];
  const inlineTodoCases = [];
  buttonNames.forEach(function (name) {
    const item = itemByName.get(name) || {};
    const declared = typeof item.methodName === "string" ? item.methodName.trim() : "";
    let method = "";
    let reason = "";
    if (declared) {
      if (isIdentifier(declared) && !CSHARP_KEYWORDS.has(declared)) method = declared;
      else reason = "menuItems[].methodName 不是可用的 C# 方法名: \"" + declared + "\"";
    } else {
      method = methodNameFromLangName(item.langName);
      if (!method) {
        reason = item.langName
          ? "LangName \"" + item.langName + "\" 无法派生方法名（临时键、前缀不符或非法标识符）"
          : "该菜单项没有 LangName";
      }
    }
    if (method) {
      if (RESERVED_VIEWMODEL_MEMBERS.indexOf(method) !== -1 || method === viewModelName) {
        fail("按钮处理方法名与 ViewModel 成员同名，会生成重复成员: " + method +
          "（按钮 \"" + name + "\"）；请修改该按钮的 menuItems[].methodName 或 LanguageKey，或改名页面");
      }
      const owner = methods.find(function (item) { return item.method === method; });
      if (owner) {
        fail("两个按钮算出同一个处理方法名，会生成重复方法: " + method +
          "（按钮 \"" + owner.name + "\" 与 \"" + name + "\"）；请用 menuItems[].methodName 区分");
      }
      methods.push({ name: name, method: method });
    } else {
      inlineTodoCases.push({ name: name, reason: reason });
    }
  });
  return { methods: methods, inlineTodoCases: inlineTodoCases };
}

function itemBlock(kind, include) {
  const escaped = xmlAttr(include);
  if (kind === "Page") {
    return [
      "    <Page Include=\"" + escaped + "\">",
      "      <Generator>MSBuild:Compile</Generator>",
      "      <SubType>Designer</SubType>",
      "    </Page>"
    ].join("\n");
  }
  return "    <" + kind + " Include=\"" + escaped + "\" />";
}

function regexEscape(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function ensureItemInclude(text, kind, include) {
  const escaped = regexEscape(xmlAttr(include));
  if (new RegExp("<" + kind + "\\s+Include=[\"']" + escaped + "[\"']", "i").test(text)) {
    return text;
  }
  const groupRegex = /<ItemGroup>[\s\S]*?<\/ItemGroup>/gi;
  let match;
  while ((match = groupRegex.exec(text)) !== null) {
    if (!new RegExp("<" + kind + "\\s+Include=", "i").test(match[0])) continue;
    const block = match[0];
    const newlineAtEnd = block.lastIndexOf("\n");
    const insertion = block.slice(0, newlineAtEnd) + "\n" + itemBlock(kind, include) +
      block.slice(newlineAtEnd);
    return text.slice(0, match.index) + insertion + text.slice(match.index + block.length);
  }
  const projectClose = text.lastIndexOf("</Project>");
  if (projectClose < 0) fail("csproj 缺少 </Project>");
  const prefix = text.slice(0, projectClose).replace(/\s*$/, "");
  const suffix = text.slice(prefix.length, projectClose);
  const block = "\n  <ItemGroup>\n" + itemBlock(kind, include) + "\n  </ItemGroup>\n";
  return prefix + suffix + block + text.slice(projectClose);
}

function writeGenerated(filePath, content, overwrite, backups) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) {
    if (!overwrite) fail("目标文件已存在，未覆盖: " + filePath);
    backups.push(backupFile(filePath));
  }
  fs.writeFileSync(filePath, content, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadManifest(args.manifestPath);
  const contents = new Map([
    [config.files[0].relative, renderView(config)],
    [config.files[1].relative, renderCodeBehind(config)],
    [config.files[2].relative, renderViewModel(config)]
  ]);
  const outputPaths = [...contents.keys()].map(function (relative) {
    return projectPath(config.projectRoot, relative, "输出文件");
  });
  const existing = outputPaths.filter(fs.existsSync);
  if (existing.length && (!args.overwrite || !["modify-existing", "replace-existing"].includes(config.operation))) {
    fail("目标文件已存在，未覆盖: " + existing.join(", ") + "；如需修改已有页面，必须显式使用 operation=replace-existing");
  }
  const backups = [];
  [...contents.entries()].forEach(function (entry) {
    writeGenerated(projectPath(config.projectRoot, entry[0], "输出文件"),
      entry[1], args.overwrite, backups);
  });

  let csproj = config.csprojText;
  const registered = config.files.map(function (file) {
    return { kind: file.kind, include: projectInclude(file.relative) };
  });
  registered.forEach(function (item) {
    csproj = ensureItemInclude(csproj, item.kind, item.include);
  });
  if (csproj !== config.csprojText) {
    if (args.overwrite) backups.push(backupFile(config.csprojPath));
    const crlf = config.csprojText.includes("\r\n");
    fs.writeFileSync(config.csprojPath, crlf ? csproj.replace(/\r?\n/g, "\r\n") : csproj, "utf8");
  }
  console.log(JSON.stringify({
    projectRoot: config.projectRoot,
    generated: [...contents.keys()],
    registered,
    // ViewModel 按钮处理审计：命中英文方法名的按钮 vs 退回内联 TODO 的按钮（含原因）。
    viewModel: {
      buttonMethods: config.buttonHandlers.methods.map(function (item) {
        return item.name + " -> " + item.method;
      }),
      inlineTodoCases: config.buttonHandlers.inlineTodoCases
    },
    backups,
    overwrite: args.overwrite
  }, null, 2));
}

try { main(); } catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
