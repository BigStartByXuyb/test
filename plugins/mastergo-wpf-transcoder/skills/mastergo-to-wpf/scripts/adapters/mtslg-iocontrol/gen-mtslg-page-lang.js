#!/usr/bin/env node
/**
 * gen-mtslg-page-lang.js —— MTSLG 页面多语言资源字典发射器
 *
 * 为单个页面发射 `Resources/Pages/<页面名>/<页面名>_<LOCALE>.xaml`。
 * 语言键与文案必须由调用方提供（设计稿只给中文，英文等其它语言不能猜）；
 * 本脚本负责机械发射、键格式/唯一性校验，以及「各语言 key 完全一致」的强制保证。
 *
 * 语言清单（--manifest）:
 * {
 *   "locales": ["CN", "EN"],              // 可选，默认 ["CN", "EN"]
 *   "bindByText": true,                   // 可选，默认 true：按 CN 文案自动匹配 key
 *   "requireLangName": true,              // 可选，默认 true：文本控件必须挂 LangName
 *   "noLangRefs": ["1:42"],               // 可选：动态值/无需翻译节点的显式豁免
 *   "keys": [
 *     { "key": "DemoRecipePageTitle", "group": "页面标题",
 *       "text": { "CN": "配方管理", "EN": "Recipe" } },
 *     { "key": "DemoRecipeMenuRecipe", "group": "页面底部菜单名称",
 *       "text": { "CN": "配方", "EN": "Recipe" }, "menuIndex": 1 },
 *     { "key": "DemoRecipeStartButton", "group": "页面内容",
 *       "text": { "CN": "开始", "EN": "Start" }, "sourceRef": "1:23" }
 *   ]
 * }
 *
 * key / text / locales 是必填事实；group 只作为 XAML 分组注释。
 * `sourceRef`（页面节点 DSL ref）、`menuIndex`（Layout MenuItem 的 Index）、
 * `role: "page-title"` 是可选绑定提示，由 Bundle 用来把 LangName 写回到
 * 对应控件/菜单项，本脚本本身不解释它们。
 *
 * 用法:
 *   node gen-mtslg-page-lang.js --page <页面名> --manifest <lang.json> --out-dir <目录>
 */
"use strict";

const fs = require("fs");
const path = require("path");
// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
// 字典值是 XAML 元素内容：换行口径与页面 XML 一致（&#x0a;）。实现真值源是
// scripts/lib/script-helpers.js（xmlElementText / normalizeNewlines）；映射表 textNewlinePolicy
// 只登记同一口径供人读与回归断言比对，不是本脚本的运行期输入。
const { failWithPrefix, xmlElementText: xmlText } = require(path.join(__dirname, "..", "..", "lib", "script-helpers.js"));
// 多语言发射的失败口径（模块前缀由共享工厂装配，本脚本不再自建 fail）。
const fail = failWithPrefix("页面多语言生成失败");

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LOCALE_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;
const DEFAULT_LOCALES = ["CN", "EN"];
// 命名约定（与目标项目现有语言文件一致）：
//   页面标题  {页面名}PageTitle        —— 由 Layout 的 <Page LangName> 引用
//   菜单项    MenuItem{名称}           —— 由 Layout 的 <MenuItem LangName> 引用
//   页面内容  {页面名}{名称}           —— 由页面 XML 内的控件引用
const TITLE_SUFFIX = "PageTitle";
const MENU_PREFIX = "MenuItem";
const GROUP_TITLE = "页面标题";
const GROUP_MENU = "页面底部菜单名称";
const GROUP_CONTENT = "页面内容";
const GROUP_ORDER = [GROUP_TITLE, GROUP_MENU, GROUP_CONTENT];

function titleKeyFor(pageName) {
  return pageName + TITLE_SUFFIX;
}

// 语言清单归一化。各语言 key 完全一致是结构保证：keys[] 是唯一真值源，
// 每个 locale 都必须为每个 key 提供文案，缺一个直接失败。
function normalizeSpec(spec, pageName) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) fail("缺少 languages 配置");
  const locales = spec.locales === undefined ? DEFAULT_LOCALES.slice() : spec.locales;
  if (!Array.isArray(locales) || locales.length === 0) fail("locales 必须是非空数组");
  const seenLocale = new Set();
  for (const locale of locales) {
    if (typeof locale !== "string" || !LOCALE_RE.test(locale)) {
      fail("locale 名称非法（应为英文标识符，如 CN / EN）: " + locale);
    }
    if (seenLocale.has(locale)) fail("locale 重复: " + locale);
    seenLocale.add(locale);
  }
  if (!Array.isArray(spec.keys) || spec.keys.length === 0) {
    fail("keys 必须是非空数组：多语言文件不允许生成空字典");
  }
  const seenKey = new Set();
  const keys = spec.keys.map(function (entry, index) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail("keys[" + index + "] 无效");
    const key = entry.key;
    if (typeof key !== "string" || !KEY_RE.test(key)) {
      fail("LanguageKey 必须是英文标识符（字母或下划线开头）: " + (key || "(missing)"));
    }
    if (seenKey.has(key)) fail("LanguageKey 重复: " + key);
    seenKey.add(key);
    if (!entry.text || typeof entry.text !== "object" || Array.isArray(entry.text)) {
      fail("LanguageKey " + key + " 缺少 text 对象");
    }
    const values = {};
    for (const locale of locales) {
      const value = entry.text[locale];
      if (value === undefined) {
        fail("LanguageKey " + key + " 缺少 " + locale + " 文案；各语言 key 必须完全一致");
      }
      if (typeof value !== "string") fail("LanguageKey " + key + " 的 " + locale + " 文案必须是字符串");
      values[locale] = value;
    }
    const extra = Object.keys(entry.text).filter(function (locale) { return !locales.includes(locale); });
    if (extra.length > 0) {
      fail("LanguageKey " + key + " 提供了未登记语言的文案: " + extra.join(", ") +
        "；请先在 locales 中登记，或删除多余语言");
    }
    return {
      key,
      group: typeof entry.group === "string" ? entry.group : "",
      values,
      ...(typeof entry.sourceRef === "string" && entry.sourceRef ? { sourceRef: entry.sourceRef } : {}),
      // 同一文案在本页出现多次时，一个 key 可以绑定多个节点：sourceRefs 是 sourceRef 的复数形式。
      ...(Array.isArray(entry.sourceRefs) && entry.sourceRefs.length > 0
        ? {
            sourceRefs: (function () {
              const refs = [];
              for (const ref of entry.sourceRefs) {
                if (typeof ref !== "string" || !ref) {
                  fail("LanguageKey " + key + " 的 sourceRefs 必须是 DSL ref 字符串数组");
                }
                if (refs.indexOf(ref) === -1) refs.push(ref);
              }
              return refs;
            })()
          }
        : {}),
      ...(entry.menuIndex === undefined || entry.menuIndex === null
        ? {} : { menuIndex: Number(entry.menuIndex) }),
      ...(typeof entry.role === "string" && entry.role ? { role: entry.role } : {}),
      ...(entry.scope === "shared" ? { scope: "shared" } : {}),
      ...(typeof entry.comment === "string" && entry.comment ? { comment: entry.comment } : {})
    };
  });
  // 命名约定校验 + 分组推导 + 稳定排序（页面标题 → 页面底部菜单名称 → 页面内容）。
  const titleKey = titleKeyFor(pageName);
  for (const entry of keys) {
    const isTitle = entry.key === titleKey;
    const isMenu = entry.key.indexOf(MENU_PREFIX) === 0;
    const isContent = !isTitle && entry.key.indexOf(pageName) === 0;
    if (!isTitle && !isMenu && !isContent && entry.scope !== "shared") {
      fail("LanguageKey " + entry.key + " 不符合命名约定：页面标题必须是 " + titleKey +
        "、菜单项必须是 " + MENU_PREFIX + "<名称>、页面内容必须是 " + pageName +
        "<名称>；跨页面共享字典的 key 请显式标注 scope=\"shared\"");
    }
    if (entry.role === "page-title" && !isTitle) {
      fail("LanguageKey " + entry.key + " 被标为页面标题，但页面标题必须是 " + titleKey);
    }
    entry.isTitle = isTitle;
    if (!entry.group) {
      entry.group = isTitle ? GROUP_TITLE : (isMenu ? GROUP_MENU : GROUP_CONTENT);
    }
  }
  keys.sort(function (a, b) {
    const ia = GROUP_ORDER.indexOf(a.group);
    const ib = GROUP_ORDER.indexOf(b.group);
    return (ia === -1 ? GROUP_ORDER.length : ia) - (ib === -1 ? GROUP_ORDER.length : ib);
  });
  const noLangRefs = spec.noLangRefs === undefined ? [] : spec.noLangRefs;
  if (!Array.isArray(noLangRefs) || noLangRefs.some(function (ref) { return typeof ref !== "string" || !ref; })) {
    fail("noLangRefs 必须是 DSL ref 字符串数组（动态值等不需要 LangName 的节点）");
  }
  return {
    pageName,
    titleKey,
    locales,
    keys,
    bindByText: spec.bindByText === undefined ? true : Boolean(spec.bindByText),
    requireLangName: spec.requireLangName === undefined ? true : Boolean(spec.requireLangName),
    noLangRefs
  };
}

// 文案索引：设计稿是中文，因此按 CN 文案匹配。同一个文案对应多个 key 属于歧义，
// 由调用方（Bundle）报错要求显式 sourceRef，本函数只如实返回候选。
function indexKeysByText(spec) {
  const index = new Map();
  for (const entry of spec.keys) {
    const text = entry.values.CN;
    if (typeof text !== "string" || text === "") continue;
    if (!index.has(text)) index.set(text, []);
    index.get(text).push(entry.key);
  }
  return index;
}

function renderDictionary(spec, locale) {
  const lines = [];
  lines.push('<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"');
  lines.push('                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"');
  lines.push('                    xml:space="preserve"');
  lines.push('xmlns:sys="clr-namespace:System;assembly=mscorlib">');
  lines.push('');
  lines.push('    <!-- ' + spec.pageName + ' 页面多语言资源（' + locale + '）。' +
    '各语言文件的 x:Key 必须完全一致。 -->');
  let lastGroup = null;
  for (const entry of spec.keys) {
    if (entry.group && entry.group !== lastGroup) {
      lines.push('');
      lines.push('    <!-- ' + entry.group + ' -->');
      lastGroup = entry.group;
    }
    lines.push('    <sys:String x:Key="' + entry.key + '">' + xmlText(entry.values[locale]) + '</sys:String>');
  }
  lines.push('');
  lines.push('</ResourceDictionary>');
  lines.push('');
  return lines.join("\n");
}

// 从已生成（或工程师维护）的字典文件里机械读出 key 顺序，用于跨语言一致性校验。
function readDictionaryKeys(xamlText) {
  const keys = [];
  const re = /<sys:String\b[^>]*\bx:Key="([^"]*)"[^>]*>/g;
  let match;
  while ((match = re.exec(xamlText)) !== null) keys.push(match[1]);
  return keys;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--page") args.page = argv[++i];
    else if (argv[i] === "--manifest") args.manifest = argv[++i];
    else if (argv[i] === "--out-dir") args.outDir = argv[++i];
    else fail("未知参数: " + argv[i] + "（用法: --page <页面名> --manifest <lang.json> --out-dir <目录>）");
  }
  if (!args.page || !args.manifest || !args.outDir) {
    fail("必须提供 --page、--manifest 和 --out-dir");
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!KEY_RE.test(args.page)) fail("页面名必须是英文标识符: " + args.page);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(args.manifest, "utf8"));
  } catch (error) {
    fail("读取语言清单失败: " + args.manifest + " - " + error.message);
  }
  const spec = normalizeSpec(raw, args.page);
  fs.mkdirSync(args.outDir, { recursive: true });
  const written = [];
  for (const locale of spec.locales) {
    const file = path.join(args.outDir, args.page + "_" + locale + ".xaml");
    const text = renderDictionary(spec, locale);
    fs.writeFileSync(file, text, "utf8");
    // 逐文件回读校验：各语言 key 集合与顺序必须完全一致。
    const keys = readDictionaryKeys(text);
    if (keys.length !== spec.keys.length) {
      fail("生成的 " + path.basename(file) + " key 数量与清单不一致");
    }
    keys.forEach(function (key, index) {
      if (key !== spec.keys[index].key) {
        fail("生成的 " + path.basename(file) + " key 顺序与清单不一致: " + key);
      }
    });
    written.push({ locale, file, keys: keys.length });
  }
  console.log(JSON.stringify({
    pageName: spec.pageName,
    locales: spec.locales,
    keyCount: spec.keys.length,
    files: written
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  KEY_RE,
  LOCALE_RE,
  DEFAULT_LOCALES,
  TITLE_SUFFIX,
  MENU_PREFIX,
  GROUP_TITLE,
  GROUP_MENU,
  GROUP_CONTENT,
  GROUP_ORDER,
  titleKeyFor,
  normalizeSpec,
  renderDictionary,
  readDictionaryKeys,
  indexKeysByText
};
