#!/usr/bin/env node
/**
 * gen-mtslg-lang-keys-from-dsl.js —— MTSLG 页面语言键机械派生器
 *
 * 设计稿只给中文，英文（或其它语言）**文案**不能由脚本凭空翻译；但语言**键**本身
 * 是结构信息，可以完全机械地从当前页 DSL / mapping / Layout 菜单项派生出来。
 * 本脚本只做这件事：产出 `languages` 清单（供 gen-mtslg-page-lang.js 发射字典，
 * 也供 gen-mastergo-page-bundle.js 在 XML/Layout 生成前绑定 LangName）。
 *
 * 命名约定（与 gen-mtslg-page-lang.js 的硬门禁一致）：
 *   页面标题  {页面名}PageTitle
 *   菜单项    MenuItem{名称}
 *   页面内容  {页面名}{名称}
 *
 * 语义名来源优先级（逐级回退，全部机械可复现）：
 *   1. 目标项目已登记语言字典里同文案的既有 key（scope=shared，直接复用）
 *   2. 节点 Icon 资源名去掉 Geometry 后缀（IconButton / 菜单项天然带英文语义名）
 *   3. --glossary 术语表（中文 → 英文标识符）
 *   4. 纯 ASCII 文案（AUX. / Diode）归一化成标识符后缀
 *   5. DSL 图层英文名（过滤 Dir / F1 / CH1 之类的结构噪音）
 *   6. 兜底 {页面名}Text{序号}：页面内唯一、稳定，标记 provisional，报告里列出待改名
 *
 * 【同页同文案复用】同一页面内文案完全相同的页面内容节点共用一个 LanguageKey：
 * 第一个节点派生键名，其余节点登记进该键的 sourceRefs（运行时同一文案只维护一条翻译），
 * 不再产生 XxxText02 / Xxx2 这类重复键；复用结果记入报告 reusedTextKeys 与
 * sources.reusedByText。只有“不同文案撞出相同语义名”时才使用稳定数字后缀。
 *
 * 【不需要翻译的文本】中英文写法一致的文本不生成语言键，自动进入 noLangRefs 并在报告里
 * 逐条列出原因：纯数字、符号、正负步进标签（+5 / -1 / ±0.5）、百分比、版本号、序列号、
 * IP、日期时间、功能键 F1 —— 即“不含中文且不含英文字母”的文本。
 * 例外：Layout 的 MenuItem 必须挂 LangName，所以菜单名仍会派生 key（命名也优先用 Icon 资源名）。
 *      按钮族（IconButton / Button / StatusButton）带文案的节点同样必须挂 LangName，
 *      因此数值/符号按钮（+5 / -1）也产键，结果记入报告 buttonFamilyKeys；
 *      按钮族清单可用 --button-control-types 覆盖（默认 IconButton,Button,StatusButton）。
 *
 * 【英文文案】取值优先级：
 *   1. 目标项目已登记字典里同 key 的英文（工程已确认，优先）
 *   2. --translations / languages.translations：中文文案 → 英文译文（由 AI 或工程师产出）
 *   3. 都没有时用中文占位并标记 pendingTranslation，必须列入交付说明
 * 本脚本不做翻译；译文是显式输入，脚本只机械套用，保证可追溯、可复核。
 *
 * 用法:
 *   node gen-mtslg-lang-keys-from-dsl.js \
 *     --page <页面名> \
 *     --mapping <mapping.json> \
 *     [--dsl <dsl.snapshot.json>] \
 *     [--layout-manifest <layout-manifest.json>] \
 *     [--key-catalog <CN.xaml> [--key-catalog <EN.xaml>]] \
 *     [--translations <translations.json>] \
 *     [--glossary <glossary.json>] \
 *     [--title-text <页面标题文案>] \
 *     [--locales CN,EN] \
 *     --out <lang.json> [--report <report.json>]
 */
"use strict";

const fs = require("fs");
const path = require("path");

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TITLE_SUFFIX = "PageTitle";
const MENU_PREFIX = "MenuItem";
const TITLE_GROUP = "页面标题";
const MENU_GROUP = "页面底部菜单名称";
const CONTENT_GROUP = "页面内容";
const DEFAULT_LOCALES = ["CN", "EN"];

// MasterGo 里随处可见的结构噪音图层名，不能当语义名使用。
const LAYER_NAME_NOISE = new Set([
  "Dir", "Group", "Frame", "Rectangle", "Vector", "Component", "Instance", "Text",
  "BG", "Bg", "Mask", "Line", "Path", "Union", "Merge", "Slice", "Image", "Container",
  "Layer", "LayerGroup", "Shape", "Ellipse", "Curve", "Arrow", "Backgroud", "Background"
]);

function fail(message) {
  throw new Error("语言键派生失败: " + message);
}

function toText(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join("");
  return String(value);
}

function normalizeText(value) {
  return toText(value).replace(/\s+/g, " ").trim();
}

// 不可翻译文本判定。核心原则：中英文一致的文本不需要语言键。
// 数字、符号、编号、版本、日期时间以及“只有数字+符号”的组合（+5 / -1 / ±0.5 / 9.0%）
// 在 CN 与 EN 里写法完全相同，一律不生成语言键，只记入 noLangRefs。
function isDynamicText(value) {
  const text = normalizeText(value);
  if (!text) return { dynamic: true, reason: "空文本" };
  if (!/[0-9A-Za-z\u4e00-\u9fa5]/.test(text)) return { dynamic: true, reason: "纯符号" };
  if (/^F\d{1,2}$/.test(text)) return { dynamic: true, reason: "功能键" };
  if (/^\d+(\.\d+)+$/.test(text)) return { dynamic: true, reason: "版本号" };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(text)) return { dynamic: true, reason: "IP 地址" };
  if (/^\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2})?)?/.test(text)) {
    return { dynamic: true, reason: "日期时间" };
  }
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) return { dynamic: true, reason: "时间" };
  if (/^\d{6,}$/.test(text)) return { dynamic: true, reason: "长数字/序列号" };
  if (/^\d+(\.\d+)?$/.test(text)) return { dynamic: true, reason: "纯数值" };
  if (/^\d+(\.\d+)?\s*(%|mm|um|μm|nm|s|ms|°|℃|A|V|W|Hz|kHz|MPa)$/.test(text)) {
    return { dynamic: true, reason: "数值+单位" };
  }
  // 关键规则：既没有中文、也没有英文字母 → 中英文写法一致，不需要翻译。
  // 覆盖 +5 / -5 / ±0.5 / 9.0% / 1.0.11.2222222 / 2026/03/01 12:00:23 等。
  if (!/[\u4e00-\u9fa5]/.test(text) && !/[A-Za-z]/.test(text)) {
    return { dynamic: true, reason: "数字/符号（中英文一致）" };
  }
  if (/^[\dA-Za-z][\dA-Za-z\-_.]*$/.test(text) && /\d/.test(text) && /\d{4,}/.test(text)) {
    return { dynamic: true, reason: "长数字/序列号" };
  }
  if (/^[A-Za-z0-9][A-Za-z0-9\-_.]*$/.test(text) && /\d/.test(text) && text.length >= 4) {
    return { dynamic: true, reason: "型号/编号标识符" };
  }
  return { dynamic: false, reason: "" };
}

// 从 Icon 资源名派生语义名：AutoOperationGeometry → AutoOperation。
function semanticFromIcon(icon) {
  if (typeof icon !== "string") return "";
  let name = icon.trim().replace(/\s+/g, "");
  if (!name) return "";
  name = name.replace(/Geometry$/i, "");
  if (!name) return "";
  if (KEY_RE.test(name)) return name;
  // Icon 名不是合法标识符时（含连字符等），做一次机械归一化再判定。
  const normalized = name.replace(/[^A-Za-z0-9_]/g, "");
  return KEY_RE.test(normalized) ? normalized : "";
}

// 正负步进标签（+5 / -1 / +0.5）转成稳定语义名：Plus5 / Minus1 / Plus0Dot5。
function signNumberSuffix(value) {
  const match = /^([+-])\s*(\d+(?:\.\d+)?)$/.exec(normalizeText(value));
  if (!match) return "";
  return (match[1] === "+" ? "Plus" : "Minus") + match[2].replace(/\./g, "Dot");
}

// 纯 ASCII 文案（AUX. / OK / Diode）直接归一化成标识符后缀。
function asciiSuffix(value) {
  const text = normalizeText(value);
  if (!text || !/^[\x20-\x7E]+$/.test(text)) return "";
  const cleaned = text.replace(/[^A-Za-z0-9]/g, "");
  if (cleaned.length < 2) return "";
  if (!/^[A-Za-z_]/.test(cleaned)) return "";
  return KEY_RE.test(cleaned) ? cleaned : "";
}

function decodeXml(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// 解析目标项目已登记的语言字典（<sys:String x:Key="Key">文案</sys:String>）。
function parseDictionary(xamlText) {
  const out = new Map();
  if (typeof xamlText !== "string" || !xamlText) return out;
  // 目标项目里有被注释掉的旧 key，先剥掉 XML 注释再解析。
  const body = xamlText.replace(/<!--[\s\S]*?-->/g, "");
  const re = /<sys:String\b[^>]*\bx:Key="([^"]+)"[^>]*>([\s\S]*?)<\/sys:String>/g;
  let match;
  while ((match = re.exec(body)) !== null) out.set(match[1], decodeXml(match[2]));
  return out;
}

// 按 CN 文案建立“已登记 key”索引：Map(CN 文案 → [{ key, EN }])。
// 同一个文案命中多个 key 属于歧义，派生器不猜，交由报告提示。
function buildKeyCatalog(dictionaryTexts) {
  const byText = new Map();
  const sources = Array.isArray(dictionaryTexts) ? dictionaryTexts : [dictionaryTexts];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const cn = source.cn instanceof Map ? source.cn : parseDictionary(source.cn);
    const en = source.en instanceof Map ? source.en : parseDictionary(source.en);
    for (const [key, text] of cn) {
      const cnText = normalizeText(text);
      if (!cnText) continue;
      if (!byText.has(cnText)) byText.set(cnText, []);
      const list = byText.get(cnText);
      if (list.some(function (item) { return item.key === key; })) continue;
      list.push({ key, EN: en.has(key) ? normalizeText(en.get(key)) : "" });
    }
  }
  return byText;
}

// 从目标项目语言文件按文件名主干配对 CN/EN
// （MaxWellClient_CN.xaml ↔ MaxWellClient_EN.xaml、MaxwellFramework_CN.xaml ↔ MaxwellFramework_EN.xaml）。
function buildKeyCatalogFromFiles(filePaths, readText) {
  const reader = typeof readText === "function" ? readText : function (file) {
    try { return fs.readFileSync(file, "utf8"); } catch (error) { return ""; }
  };
  const pairs = new Map();
  for (const file of Array.isArray(filePaths) ? filePaths : []) {
    if (typeof file !== "string" || !file.trim()) continue;
    const match = /_(EN|CN)\.xaml$/i.exec(file);
    const stem = match ? file.slice(0, file.length - match[0].length) : file;
    if (!pairs.has(stem)) pairs.set(stem, { cn: "", en: "" });
    const slot = pairs.get(stem);
    if (match && match[1].toUpperCase() === "EN") slot.en = reader(file);
    else slot.cn = reader(file);
  }
  const dictionaryTexts = [];
  for (const pair of pairs.values()) {
    if (pair.cn) dictionaryTexts.push(pair);
  }
  return buildKeyCatalog(dictionaryTexts);
}

// 从 DSL 快照里取根节点名，作为页面标题文案的机械来源。
function readDslRootName(dsl) {
  if (!dsl || typeof dsl !== "object") return "";
  const container = dsl.dsl && typeof dsl.dsl === "object" ? dsl.dsl : dsl;
  const nodes = container.nodes;
  if (Array.isArray(nodes) && nodes.length > 0 && nodes[0] && typeof nodes[0] === "object") {
    return normalizeText(nodes[0].name);
  }
  if (container.root && typeof container.root === "object") return normalizeText(container.root.name);
  return "";
}

// ref → 图层名索引；DSL 快照的节点是树，需要递归展开。
function buildRefNameIndex(dsl) {
  const index = new Map();
  if (!dsl || typeof dsl !== "object") return index;
  const container = dsl.dsl && typeof dsl.dsl === "object" ? dsl.dsl : dsl;
  const walk = function (node) {
    if (!node || typeof node !== "object") return;
    if (typeof node.id === "string" && typeof node.name === "string") {
      if (!index.has(node.id)) index.set(node.id, node.name);
    }
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  if (Array.isArray(container.nodes)) container.nodes.forEach(walk);
  if (Array.isArray(container.componentInstances)) container.componentInstances.forEach(walk);
  return index;
}

function layerNameToSuffix(layerName) {
  const name = normalizeText(layerName);
  if (!name || !KEY_RE.test(name)) return "";
  if (LAYER_NAME_NOISE.has(name)) return "";
  if (name.length < 3) return "";
  return name;
}

function localesFrom(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_LOCALES.slice();
  const list = Array.isArray(value) ? value : String(value).split(",");
  return list.map(function (item) { return String(item).trim(); }).filter(Boolean);
}

/**
 * 机械派生一页的 languages 清单。
 *
 * @param {object} options
 *   pageName     页面名（英文标识符，必须与 Bundle manifest.name 一致）
 *   mapping      已解析的 mapping 对象（含 nodes / textAudit）
 *   dsl          可选：dsl.snapshot.json 内容
 *   menuItems    可选：Layout 菜单项数组（{ index, name, icon }）
 *   keyCatalog   可选：buildKeyCatalog() 的产物
 *   translations 可选：{ 中文文案: 英文译文 }，由 AI / 工程师产出后显式传入
 *   glossary     可选：{ 中文文案: EnglishIdentifier }
 *   titleText    可选：页面标题文案（优先于 DSL 根节点名）
 *   locales      可选：语言列表，默认 ["CN", "EN"]
 * @returns {{ languages: object, report: object }}
 */
function deriveLangSpec(options) {
  const opts = options || {};
  const pageName = opts.pageName;
  if (typeof pageName !== "string" || !KEY_RE.test(pageName)) {
    fail("页面名必须是英文标识符: " + pageName);
  }
  const locales = localesFrom(opts.locales);
  if (locales.length === 0) fail("locales 不能为空");
  const mapping = opts.mapping && typeof opts.mapping === "object" ? opts.mapping : {};
  const menuItems = Array.isArray(opts.menuItems) ? opts.menuItems : [];
  const glossary = opts.glossary && typeof opts.glossary === "object" ? opts.glossary : {};
  // 译文清单：{ 中文文案: 英文译文 }，由 AI / 工程师产出，脚本只机械套用。
  const translations = (function () {
    const out = new Map();
    const source = opts.translations;
    if (!source || typeof source !== "object" || Array.isArray(source)) return out;
    for (const key of Object.keys(source)) {
      const cn = normalizeText(key);
      const en = normalizeText(source[key]);
      if (cn && en) out.set(cn, en);
    }
    return out;
  })();
  const usedTranslations = new Set();
  const catalog = opts.keyCatalog instanceof Map ? opts.keyCatalog : new Map();
  const refNames = buildRefNameIndex(opts.dsl);
  // 按钮族：带文案的按钮一律挂 LangName（SKILL 语言规则），数值/符号按钮也不例外，
  // 因此这一类节点不参与 isDynamicText 的自动豁免。
  const buttonControlTypes = new Set(
    Array.isArray(opts.buttonControlTypes) && opts.buttonControlTypes.length
      ? opts.buttonControlTypes.map(String)
      : ["IconButton", "Button", "StatusButton"]
  );

  const usedKeys = new Set();
  const sharedByKey = new Map();
  // 页面内“同一文案 → 同一个 LanguageKey”：文案相同的多个节点共用一个 key，
  // 其余节点登记进该 key 的 sourceRefs（运行时同一文案只维护一条翻译）。
  const contentEntryByText = new Map();
  const keys = [];
  const noLangRefs = [];
  const report = {
    pageName,
    locales,
    titleKey: pageName + TITLE_SUFFIX,
    sources: {
      title: 0, menu: 0, catalog: 0, icon: 0, glossary: 0,
      signNumber: 0, asciiText: 0, dslLayerName: 0, fallback: 0, reusedByText: 0
    },
    provisionalKeys: [],
    pendingTranslations: [],
    buttonFamilyKeys: [],
    translatedFromCatalog: 0,
    translatedFromInput: 0,
    sharedKeys: [],
    autoNoLangRefs: [],
    duplicateKeys: [],
    reusedTextKeys: [],
    warnings: []
  };

  const uniqueKey = function (base) {
    let key = base;
    let n = 2;
    while (usedKeys.has(key)) {
      key = base + n;
      n += 1;
    }
    usedKeys.add(key);
    return key;
  };

  // 英文文案优先级：目标项目已登记字典（工程已确认）→ translations（AI/工程师译文）→ 中文占位。
  // 其它语言没有译文时一律用中文占位并标记，脚本不做任何翻译推断。
  const makeText = function (cnText, catalogEn) {
    const cn = normalizeText(cnText);
    // 只有中文文案才需要翻译；中英文一致的 ASCII 标签（AUX. / Diode）不算待翻译。
    const needTranslation = /[\u4e00-\u9fa5]/.test(cn);
    let english = "";
    let source = "";
    const fromCatalog = normalizeText(catalogEn);
    if (fromCatalog && fromCatalog !== cn) {
      english = fromCatalog;
      source = "catalog";
    }
    if (!english && translations.has(cn)) {
      const provided = translations.get(cn);
      if (provided && provided !== cn) {
        english = provided;
        source = "input";
        usedTranslations.add(cn);
      }
    }
    const text = { CN: cnText };
    let pending = false;
    for (const locale of locales) {
      if (locale === "CN") continue;
      if (locale === "EN" && english) {
        text[locale] = english;
      } else {
        text[locale] = cnText;
        if (needTranslation) pending = true;
      }
    }
    if (source === "catalog") report.translatedFromCatalog += 1;
    if (source === "input") report.translatedFromInput += 1;
    return { text, pending };
  };

  // 1) 页面标题：{页面名}PageTitle，由 Layout <Page LangName> 引用。
  const titleText = normalizeText(opts.titleText)
    || readDslRootName(opts.dsl)
    || pageName;
  const titleKey = pageName + TITLE_SUFFIX;
  usedKeys.add(titleKey);
  const titleMade = makeText(titleText, "");
  const titleEntry = { key: titleKey, group: TITLE_GROUP, role: "page-title", text: titleMade.text };
  keys.push(titleEntry);
  report.sources.title = 1;
  if (titleMade.pending) {
    for (const locale of locales) {
      if (locale === "CN") continue;
      report.pendingTranslations.push({ key: titleKey, locale, text: titleText, sourceRef: "" });
    }
  }

  // 2) 菜单项：MenuItem{名称}，由 Layout <MenuItem LangName> 引用。
  for (const item of menuItems) {
    if (!item || typeof item !== "object") continue;
    const name = normalizeText(item.name);
    if (!name) continue;
    const index = item.index === undefined || item.index === null ? null : Number(item.index);
    // 目标项目已登记菜单键优先复用：菜单项正是 MenuItem* 命名空间的拥有者。
    const menuHits = (catalog.get(name) || []).filter(function (hit) {
      return hit.key.indexOf(MENU_PREFIX) === 0;
    });
    if (menuHits.length === 1) {
      const hit = menuHits[0];
      const made = makeText(name, hit.EN);
      const entry = {
        key: hit.key,
        group: MENU_GROUP,
        text: made.text,
        scope: "shared",
        comment: "复用目标项目已登记语言键"
      };
      if (index !== null && Number.isFinite(index)) entry.menuIndex = index;
      usedKeys.add(hit.key);
      keys.push(entry);
      report.sources.menu += 1;
      report.sources.catalog += 1;
      report.sharedKeys.push({ key: hit.key, menuIndex: index, text: name });
      if (made.pending) {
        for (const locale of locales) {
          if (locale === "CN") continue;
          report.pendingTranslations.push({ key: hit.key, locale, text: name, menuIndex: index });
        }
      }
      continue;
    }
    if (menuHits.length > 1) {
      report.warnings.push("菜单文案 \"" + name + "\" 在目标项目语言字典里命中多个 MenuItem key：" +
        menuHits.map(function (hit) { return hit.key; }).join(", ") + "；已改用页面内派生键");
    }
    let suffix = "";
    let source = "";
    const iconName = semanticFromIcon(item.icon);
    if (iconName) { suffix = iconName; source = "icon"; }
    if (!suffix && KEY_RE.test(String(glossary[name] || ""))) {
      suffix = String(glossary[name]);
      source = "glossary";
    }
    if (!suffix) {
      const signed = signNumberSuffix(name);
      if (signed) { suffix = signed; source = "signNumber"; }
    }
    if (!suffix) {
      const ascii = asciiSuffix(name);
      if (ascii) { suffix = ascii; source = "asciiText"; }
    }
    if (!suffix) {
      const layerName = layerNameToSuffix(refNames.get(item.sourceRef));
      if (layerName) { suffix = layerName; source = "dslLayerName"; }
    }
    let provisional = false;
    if (!suffix) {
      suffix = "Index" + (index === null ? "Unknown" : index);
      source = "fallback";
      provisional = true;
    }
    const base = MENU_PREFIX + suffix;
    const key = uniqueKey(base);
    if (key !== base) report.duplicateKeys.push({ base, key, menuIndex: index });
    // 菜单键必须落在 MenuItem 命名空间，因此只借用目标字典的英文文案，不借用它的 key。
    const hits = catalog.get(name) || [];
    const made = makeText(name, hits.length === 1 ? hits[0].EN : "");
    const entry = { key, group: MENU_GROUP, text: made.text };
    if (index !== null && Number.isFinite(index)) entry.menuIndex = index;
    if (provisional) {
      entry.comment = "临时键（待工程师改名为语义键）";
      report.provisionalKeys.push({ key, menuIndex: index, text: name });
    }
    if (made.pending) {
      for (const locale of locales) {
        if (locale === "CN") continue;
        report.pendingTranslations.push({ key, locale, text: name, menuIndex: index });
      }
    }
    keys.push(entry);
    report.sources.menu += 1;
    if (source === "icon") report.sources.icon += 1;
    if (source === "glossary") report.sources.glossary += 1;
    if (source === "signNumber") report.sources.signNumber += 1;
    if (source === "asciiText") report.sources.asciiText += 1;
    if (source === "dslLayerName") report.sources.dslLayerName += 1;
    if (source === "fallback") report.sources.fallback += 1;
  }

  // 3) 页面内容：{页面名}{名称}，由页面 XML 内的控件引用。
  const nodes = Array.isArray(mapping.nodes) ? mapping.nodes : [];
  let fallbackSeq = 0;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    if (node.valueSource !== "dsl.text") continue;
    const text = normalizeText(node.sourceText);
    const ref = typeof node.sourceRef === "string" && node.sourceRef
      ? node.sourceRef
      : (typeof node.ref === "string" ? node.ref : "");
    if (!text || !ref) continue;
    const dynamic = isDynamicText(text);
    const isButtonFamilyNode = buttonControlTypes.has(String(node.controlType || ""));
    if (dynamic.dynamic && !isButtonFamilyNode) {
      if (noLangRefs.indexOf(ref) === -1) noLangRefs.push(ref);
      report.autoNoLangRefs.push({ sourceRef: ref, text, reason: dynamic.reason });
      continue;
    }
    if (dynamic.dynamic && isButtonFamilyNode) {
      // 按钮族例外：带文案的 IconButton / Button / StatusButton 一律产键挂 LangName，
      // 数值/符号文案（+5 / -1 / 9.0%）在 CN 与 EN 里写法一致，但仍按运行时约定发键。
      report.buttonFamilyKeys.push({
        sourceRef: ref,
        text,
        controlType: node.controlType,
        reason: "按钮族带文案一律挂 LangName（数值/符号按钮也产键）：" + dynamic.reason
      });
    }

    // 3.0 页面内同文案复用：同一页面里文案完全相同的节点直接共用一个 LanguageKey，
    //     后续节点写入该 key 的 sourceRefs，不再派生 XxxText02 / Xxx2 这类重复键。
    const reused = contentEntryByText.get(text);
    if (reused) {
      if (!Array.isArray(reused.sourceRefs)) {
        reused.sourceRefs = reused.sourceRef ? [reused.sourceRef] : [];
      }
      if (reused.sourceRefs.indexOf(ref) === -1) reused.sourceRefs.push(ref);
      report.sources.reusedByText += 1;
      report.reusedTextKeys.push({ key: reused.key, text, sourceRef: ref });
      continue;
    }

    // 3.1 目标项目已登记 key：同一文案只命中一个 key 时直接复用（scope=shared）。
    // 菜单命名空间（MenuItem*）的键只给 Layout 菜单项用，页面内容节点不复用，
    // 否则会出现“页面按钮引用菜单键”的错位绑定。
    const hits = (catalog.get(text) || []).filter(function (hit) {
      return hit.key.indexOf(MENU_PREFIX) !== 0;
    });
    if (hits.length === 1) {
      const hit = hits[0];
      const existed = sharedByKey.get(hit.key);
      if (existed) {
        // 同一 key 被本页多个节点引用：登记到 sourceRefs，Bundle 会把 LangName 挂到全部节点。
        existed.sourceRefs.push(ref);
        continue;
      }
      const made = makeText(text, hit.EN);
      const entry = {
        key: hit.key,
        group: CONTENT_GROUP,
        text: made.text,
        sourceRef: ref,
        sourceRefs: [ref],
        scope: "shared",
        comment: "复用目标项目已登记语言键"
      };
      usedKeys.add(hit.key);
      sharedByKey.set(hit.key, entry);
      contentEntryByText.set(text, entry);
      keys.push(entry);
      report.sources.catalog += 1;
      report.sharedKeys.push({ key: hit.key, sourceRef: ref, text });
      if (made.pending) {
        for (const locale of locales) {
          if (locale === "CN") continue;
          report.pendingTranslations.push({ key: hit.key, locale, text, sourceRef: ref });
        }
      }
      continue;
    }
    if (hits.length > 1) {
      report.warnings.push("文案 \"" + text + "\"（" + ref + "）在目标项目语言字典里命中多个 key：" +
        hits.map(function (hit) { return hit.key; }).join(", ") + "；已改用页面内派生键");
    }

    // 3.2 逐级派生语义名。
    let suffix = "";
    let source = "";
    const iconName = semanticFromIcon(node.attrs && node.attrs.Icon);
    if (iconName) {
      suffix = iconName;
      source = "icon";
    } else if (KEY_RE.test(String(glossary[text] || ""))) {
      suffix = String(glossary[text]);
      source = "glossary";
    } else {
      // 数字/符号类文本已在 isDynamicText 里豁免，这里只可能是需要语义名的真实文案。
      const ascii = asciiSuffix(text);
      if (ascii) {
        suffix = ascii;
        source = "asciiText";
      } else {
        const layerName = layerNameToSuffix(refNames.get(ref));
        if (layerName) {
          suffix = layerName;
          source = "dslLayerName";
        }
      }
    }
    let provisional = false;
    if (!suffix) {
      fallbackSeq += 1;
      suffix = "Text" + String(fallbackSeq).padStart(2, "0");
      source = "fallback";
      provisional = true;
    }
    const base = pageName + suffix;
    const key = uniqueKey(base);
    if (key !== base) report.duplicateKeys.push({ base, key, sourceRef: ref });
    const made = makeText(text, "");
    const entry = { key, group: CONTENT_GROUP, text: made.text, sourceRef: ref };
    if (provisional) {
      entry.comment = "临时键（待工程师改名为语义键）";
      report.provisionalKeys.push({ key, sourceRef: ref, text });
    }
    if (made.pending) {
      for (const locale of locales) {
        if (locale === "CN") continue;
        report.pendingTranslations.push({ key, locale, text, sourceRef: ref });
      }
    }
    keys.push(entry);
    contentEntryByText.set(text, entry);
    report.sources[source] += 1;
  }

  // 4) 显式豁免（opts.noLangRefs）与自动豁免合并。
  const explicitNoLangRefs = Array.isArray(opts.noLangRefs) ? opts.noLangRefs.map(String).filter(Boolean) : [];
  report.explicitNoLangRefs = [];
  for (const ref of explicitNoLangRefs) {
    if (noLangRefs.indexOf(ref) === -1) noLangRefs.push(ref);
    report.explicitNoLangRefs.push(ref);
  }

  report.keyCount = keys.length;
  const languages = {
    locales,
    auto: true,
    bindByText: true,
    requireLangName: true,
    noLangRefs,
    keys
  };
  return { languages, report };
}

function parseArgs(argv) {
  const args = { keyCatalog: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--page") args.page = argv[++i];
    else if (flag === "--mapping") args.mapping = argv[++i];
    else if (flag === "--dsl") args.dsl = argv[++i];
    else if (flag === "--layout-manifest") args.layoutManifest = argv[++i];
    else if (flag === "--key-catalog") args.keyCatalog.push(argv[++i]);
    else if (flag === "--translations") args.translations = argv[++i];
    else if (flag === "--glossary") args.glossary = argv[++i];
    else if (flag === "--title-text") args.titleText = argv[++i];
    else if (flag === "--locales") args.locales = argv[++i];
    else if (flag === "--button-control-types") args.buttonControlTypes = String(argv[++i] || "").split(/[,\s]+/).filter(Boolean);
    else if (flag === "--out") args.out = argv[++i];
    else if (flag === "--report") args.report = argv[++i];
    else fail("未知参数: " + flag);
  }
  if (!args.page || !args.mapping || !args.out) {
    fail("必须提供 --page、--mapping 和 --out（用法见脚本头部注释）");
  }
  return args;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail("读取 " + label + " 失败: " + filePath + " - " + error.message);
  }
}

function readTextIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const mapping = readJson(args.mapping, "mapping");
  const dsl = args.dsl ? readJson(args.dsl, "DSL 快照") : null;
  const layoutManifest = args.layoutManifest ? readJson(args.layoutManifest, "Layout 清单") : null;
  const glossary = args.glossary ? readJson(args.glossary, "术语表") : {};
  const translations = args.translations ? readJson(args.translations, "译文清单") : {};
  const menuItems = layoutManifest && Array.isArray(layoutManifest.menuItems)
    ? layoutManifest.menuItems
    : (Array.isArray(args.menuItems) ? args.menuItems : []);
  const titleText = normalizeText(args.titleText) || titleFromMapping(mapping);
  const derived = deriveLangSpec({
    pageName: args.page,
    mapping,
    dsl,
    menuItems,
    keyCatalog: buildKeyCatalogFromFiles(args.keyCatalog, readTextIfExists),
    glossary,
    translations,
    titleText,
    locales: localesFrom(args.locales),
    buttonControlTypes: args.buttonControlTypes
  });
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(derived.languages, null, 2) + "\n", "utf8");
  if (args.report) {
    fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true });
    fs.writeFileSync(args.report, JSON.stringify(derived.report, null, 2) + "\n", "utf8");
  }
  console.log(JSON.stringify({
    pageName: args.page,
    keyCount: derived.report.keyCount,
    sources: derived.report.sources,
    provisionalKeys: derived.report.provisionalKeys.length,
    autoNoLangRefs: derived.report.autoNoLangRefs.length,
    translatedFromCatalog: derived.report.translatedFromCatalog,
    translatedFromInput: derived.report.translatedFromInput,
    pendingTranslations: derived.report.pendingTranslations.length,
    out: args.out,
    report: args.report || null
  }, null, 2));
}

// 页面标题文案：优先取 textAudit 里标记为 page-title 的文本。
function titleFromMapping(mapping) {
  const audit = mapping && Array.isArray(mapping.textAudit) ? mapping.textAudit : [];
  for (const item of audit) {
    if (item && item.role === "page-title" && item.decision !== "omit") {
      const text = normalizeText(item.sourceText);
      if (text) return text;
    }
  }
  for (const item of audit) {
    if (item && item.role === "page-title") {
      const text = normalizeText(item.sourceText);
      if (text) return text;
    }
  }
  return "";
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
  TITLE_SUFFIX,
  MENU_PREFIX,
  TITLE_GROUP,
  MENU_GROUP,
  CONTENT_GROUP,
  DEFAULT_LOCALES,
  isDynamicText,
  semanticFromIcon,
  signNumberSuffix,
  asciiSuffix,
  parseDictionary,
  buildKeyCatalog,
  buildKeyCatalogFromFiles,
  readDslRootName,
  buildRefNameIndex,
  titleFromMapping,
  localesFrom,
  deriveLangSpec
};
