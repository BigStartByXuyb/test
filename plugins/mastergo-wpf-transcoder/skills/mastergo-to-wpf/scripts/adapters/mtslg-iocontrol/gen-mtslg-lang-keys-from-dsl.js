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
 *   4. 该文案的英文译文（--translations / languages.translations）转 PascalCase：
 *      「工件边缘录入」→ Workpiece Edge Teaching → WorkpieceEdgeTeaching。
 *      脚本仍不翻译，只把 AI/工程师已给出的译文机械转成标识符；译文是数字/符号或
 *      首位不是字母时本条不成立，继续往下（菜单项在这一步与页面内容节点同规则）。
 *   5. 纯 ASCII 文案（AUX. / Diode）归一化成标识符后缀
 *   6. 值字面编码：数值/符号型文本（0.000 / 4321 / 9.0% / ～ / θ： / °）用值本身编码
 *      （Num0Dot000 / Num4321 / Num9Dot0Pct / SymWave / SymThetaColon / SymDeg）——这类值在
 *      设计稿上是示例值、没有业务语义名，按字面编码最稳定，也避免落临时键；词表外符号不猜
 *   7. DSL 图层英文名（过滤 Dir / F1 / CH1 之类的结构噪音）
 *   8. 兜底 {页面名}Text{序号}：页面内唯一、稳定，标记 provisional，报告里列出待改名
 *
 * 【同页同文案复用】同一页面内文案完全相同的页面内容节点共用一个 LanguageKey：
 * 第一个节点派生键名，其余节点登记进该键的 sourceRefs（运行时同一文案只维护一条翻译），
 * 不再产生 XxxText02 / Xxx2 这类重复键；复用结果记入报告 reusedTextKeys 与
 * sources.reusedByText。只有“不同文案撞出相同语义名”时才使用稳定数字后缀。
 *
 * 【全量多语言】设计稿给出的**每个 Value 都产键挂 LangName**，不按文本形态（数字 / 符号 / 版本号 /
 * 日期时间 / 型号…）做豁免。中英文写法完全相同的文本只是 EN 值等于原文，不会记入 pendingTranslations；
 * 逐条列在报告 identicalTextKeys 里供交付说明核对。不产键的只有两类：① 映射表在值槽位登记 langRefPolicy=none
 * 的节点（当前只有选择框 Value，运行时由数据决定），记入 valueLangExempt；② 空文本节点（Value 为空串，无文案可翻译）——
 * 照常发射 Value 空串、不挂 LangName，也不进任何豁免清单。
 * 另有两条硬要求（不是"不产键"的例外，而是必须产键的场景）：Layout 的 MenuItem 必须挂 LangName；
 * 按钮族（IconButton / Button / StatusButton）带文案的节点同样必须挂 LangName。
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
// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
// langValueText（字典值的换行 + 空白处理）由共享库提供唯一实现，本脚本不再自带一份。
const { readJson, failWithPrefix, normalizeNewlines, langValueText } = require(path.join(__dirname, "..", "..", "lib", "script-helpers.js"));
const fail = failWithPrefix("语言键派生失败");

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

function toText(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join("");
  return String(value);
}

function normalizeText(value) {
  return toText(value).replace(/\s+/g, " ").trim();
}

// 文本形态分类：只用于**留档**（报告 identicalTextKeys / buttonFamilyKeys 里的原因），
// 不再决定是否产键——全量多语言下每个 Value 都产键，中英文写法相同的文本 EN 值等于原文。
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

// 值字面编码：数值/符号类文本用**值本身**编码成稳定标识符后缀（全量多语言下这类文本同样产键，
// 但设计稿上它们是示例值、没有业务语义名，硬起语义名等于猜——所以按字面编码，稳定、可复现）：
//   0.000 → Num0Dot000   4321 → Num4321   9.0% → Num9Dot0Pct
//   ～ → SymWave         θ： → SymThetaColon   ° → SymDeg
// 含中文的文案不在这里处理（走译文 / 术语表 / 图层名那条语义名链）；
// 出现词表里没有的符号时返回空串，继续走后面的来源，不猜。
const LITERAL_SYMBOL_WORDS = {
  ".": "Dot", ",": "Comma", "，": "Comma", "、": "Enum",
  "%": "Pct", "‰": "Permille", "+": "Plus", "-": "Minus", "±": "PlusMinus",
  "°": "Deg", "℃": "Celsius", ":": "Colon", "：": "Colon",
  "~": "Wave", "～": "Wave", "θ": "Theta", "Θ": "Theta",
  "/": "Slash", "\\": "Backslash", "(": "LParen", ")": "RParen",
  "#": "Sharp", "*": "Star", "×": "Times", "≤": "Le", "≥": "Ge",
  "∞": "Inf", "→": "Arrow", "α": "Alpha", "β": "Beta", "μ": "Mu", "Δ": "Delta"
};
function valueLiteralSuffix(value) {
  const text = normalizeText(value);
  if (!text || /[\u4e00-\u9fa5]/.test(text)) return "";
  // 纯 ASCII 且以字母开头的文案已由 asciiSuffix 处理，这里只收「数字/符号型」字面值。
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(text)) return "";
  let encoded = "";
  for (const ch of Array.from(text)) {
    if (/[A-Za-z0-9]/.test(ch)) { encoded += ch; continue; }
    if (ch === " ") continue;
    const word = LITERAL_SYMBOL_WORDS[ch];
    if (!word) return "";
    encoded += word;
  }
  if (!encoded) return "";
  const suffix = (/\d/.test(text) ? "Num" : "Sym") + encoded;
  return KEY_RE.test(suffix) && suffix.length >= 4 ? suffix : "";
}

// 译文派生语义名：用该页已产出的英文译文做机械 PascalCase，中文文案 → 英文标识符。
//   "工件边缘录入" → "Workpiece Edge Teaching" → WorkpieceEdgeTeaching
//   "光源调整"     → "Light Source Adjust"     → LightSourceAdjust
// 算法（与 page-build-rules.md 第 3.1 节同口径）：按非字母数字字符切词 → 每个词首字母大写、其余字符原样保留 → 连接；
// 结果必须匹配 KEY_RE 且长度 ≥ 3，否则本条不成立、继续走后面的来源。
// 脚本仍然不翻译：译文是 AI / 工程师产出的 languages.translations，这里只做大小写与分词归一化；
// 纯数字/符号（+5、9.0%）或首位不是字母的译文会被 KEY_RE 拦下，继续走后面的来源（signNumber / 兜底）。
function translatedSuffix(cnText, translations) {
  const en = translations.get(normalizeText(cnText));
  if (!en) return "";
  const words = String(en).replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const pascal = words.map(function (word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join("");
  if (pascal.length < 3) return "";
  return KEY_RE.test(pascal) ? pascal : "";
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
  // 全量多语言下按钮族与其他文本一样产键，这里只是给数值/符号按钮多留一条审计记录。
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
  // 组件级固定语言键（映射表 langPolicy=fixed）：按最终 key 收口，同一 key 的多节点登记进 sourceRefs。
  const fixedKeyByKey = new Map();
  const keys = [];
  const noLangRefs = [];
  const report = {
    pageName,
    locales,
    titleKey: pageName + TITLE_SUFFIX,
    sources: {
      title: 0, menu: 0, catalog: 0, icon: 0, glossary: 0,
      translated: 0, signNumber: 0, asciiText: 0, valueLiteral: 0, dslLayerName: 0, fallback: 0, reusedByText: 0
    },
    provisionalKeys: [],
    pendingTranslations: [],
    buttonFamilyKeys: [],
    translatedFromCatalog: 0,
    translatedFromInput: 0,
    sharedKeys: [],
    // 中英文写法完全相同、EN 值等于 CN 的键（数字 / 符号 / 版本号 / 日期时间 / 功能键 / 型号…）：
    // 全量多语言下照样产键，这里逐条留档，供交付说明与复核对照。
    identicalTextKeys: [],
    // 槽位级 langRefPolicy=none 的值（如选择框的「默认选中的名称」）：不产键、不挂 LangName。
    valueLangExempt: [],
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
    // 字典 CN 值保留设计稿换行（归一成 LF）；中英文一致性的判定仍用压平值 cn。
    const cnValue = langValueText(cnText) || cn;
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
    const text = { CN: cnValue };
    let pending = false;
    for (const locale of locales) {
      if (locale === "CN") continue;
      if (locale === "EN" && english) {
        text[locale] = langValueText(english) || english;
      } else {
        text[locale] = cnValue;
        if (needTranslation) pending = true;
      }
    }
    if (source === "catalog") report.translatedFromCatalog += 1;
    if (source === "input") report.translatedFromInput += 1;
    return { text, pending };
  };

  // 1) 页面标题：{页面名}PageTitle，由 Layout <Page LangName> 引用。
  // 原值（保留换行）供字典值用；压平值供报告/待翻译判定用。
  const rawTitleText = normalizeNewlines(toText(opts.titleText)) || readDslRootName(opts.dsl) || pageName;
  const titleText = normalizeText(rawTitleText) || pageName;
  const titleKey = pageName + TITLE_SUFFIX;
  usedKeys.add(titleKey);
  const titleMade = makeText(rawTitleText || titleText, "");
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
    // rawName 保留换行（写进字典值）；name 是压平值（派生键名 / 查目标字典 / 报告）。
    const rawName = normalizeNewlines(toText(item.name));
    const name = normalizeText(rawName);
    if (!name) continue;
    const index = item.index === undefined || item.index === null ? null : Number(item.index);
    // 目标项目已登记菜单键优先复用：菜单项正是 MenuItem* 命名空间的拥有者。
    const menuHits = (catalog.get(name) || []).filter(function (hit) {
      return hit.key.indexOf(MENU_PREFIX) === 0;
    });
    if (menuHits.length === 1) {
      const hit = menuHits[0];
      const made = makeText(rawName || name, hit.EN);
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
    // 译文派生：该页已产出英文译文时，用它当语义名（中文文案的英文翻译 → PascalCase 标识符）。
    if (!suffix) {
      const translated = translatedSuffix(name, translations);
      if (translated) { suffix = translated; source = "translated"; }
    }
    if (!suffix) {
      const signed = signNumberSuffix(name);
      if (signed) { suffix = signed; source = "signNumber"; }
    }
    if (!suffix) {
      const ascii = asciiSuffix(name);
      if (ascii) { suffix = ascii; source = "asciiText"; }
    }
    // 值字面编码：菜单名是数值/符号型文本时（如 "0.000"）同样按值本身编码，与页面内容节点同口径。
    if (!suffix) {
      const literal = valueLiteralSuffix(name);
      if (literal) { suffix = literal; source = "valueLiteral"; }
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
    const made = makeText(rawName || name, hits.length === 1 ? hits[0].EN : "");
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
    if (source === "translated") report.sources.translated += 1;
    if (source === "signNumber") report.sources.signNumber += 1;
    if (source === "asciiText") report.sources.asciiText += 1;
    if (source === "valueLiteral") report.sources.valueLiteral += 1;
    if (source === "dslLayerName") report.sources.dslLayerName += 1;
    if (source === "fallback") report.sources.fallback += 1;
  }

  // 3) 页面内容：{页面名}{名称}，由页面 XML 内的控件引用。
  const nodes = Array.isArray(mapping.nodes) ? mapping.nodes : [];
  let fallbackSeq = 0;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    // 3.-1 组件级固定语言键（映射表登记 langPolicy=fixed）：key 由变体登记、不从设计文本派生，
    //      也**不要求设计文本存在**（设计稿只提供几何时同样必须产键）——因此必须放在
    //      valueSource=dsl.text 与非空文本两道门禁之前。缺该 locale 的文案时退回设计原文。
    const fixedLang = node.fixedLang;
    if (fixedLang && typeof fixedLang.keyTemplate === "string" && fixedLang.keyTemplate !== "") {
      const fixedRef = typeof node.sourceRef === "string" && node.sourceRef
        ? node.sourceRef
        : (typeof node.ref === "string" ? node.ref : "");
      if (fixedRef) {
        const fixedKey = fixedLang.keyTemplate.split("{page}").join(pageName);
        if (!KEY_RE.test(fixedKey)) {
          fail("组件级固定语言键不是合法标识符: " + fixedKey + "（节点 " + fixedRef + "）");
        }
        const fixedText = fixedLang.text && typeof fixedLang.text === "object" && !Array.isArray(fixedLang.text)
          ? fixedLang.text
          : {};
        const sourceFallback = normalizeNewlines(toText(node.sourceText));
        const existingFixed = fixedKeyByKey.get(fixedKey);
        if (existingFixed) {
          if (existingFixed.sourceRefs.indexOf(fixedRef) === -1) existingFixed.sourceRefs.push(fixedRef);
        } else {
          const localized = {};
          for (const locale of locales) {
            const value = fixedText[locale];
            localized[locale] = typeof value === "string" && value !== "" ? value : sourceFallback;
          }
          const entry = {
            key: fixedKey,
            group: CONTENT_GROUP,
            text: localized,
            sourceRef: fixedRef,
            sourceRefs: [fixedRef],
            comment: "组件级固定键（映射表登记，不由设计文本派生）"
          };
          usedKeys.add(fixedKey);
          fixedKeyByKey.set(fixedKey, entry);
          keys.push(entry);
          if (!Array.isArray(report.fixedKeys)) report.fixedKeys = [];
          report.fixedKeys.push({ key: fixedKey, sourceRef: fixedRef, text: fixedText });
        }
      }
      continue;
    }
    if (node.valueSource !== "dsl.text") continue;
    // rawText 保留换行（写进字典值）；text 是压平值（派生键名 / 判动态文本 / 报告）。
    const rawText = normalizeNewlines(toText(node.sourceText));
    const text = normalizeText(rawText);
    const ref = typeof node.sourceRef === "string" && node.sourceRef
      ? node.sourceRef
      : (typeof node.ref === "string" ? node.ref : "");
    if (!text || !ref) continue;
    // 槽位登记 langRefPolicy=none：该值不参与多语言——运行时由数据决定（例：选择框的默认选中名），
    // 不产语言键、不挂 LangName；单独登记进报告，供交付说明逐条列出。
    if (node.langRefPolicy === "none") {
      report.valueLangExempt.push({ sourceRef: ref, controlType: node.controlType || null, text });
      continue;
    }
    // 全量多语言：设计稿给出的**每个 Value 都产键挂 LangName**，不按文本形态（数字/符号/版本号/
    // 日期时间/型号…）做豁免——中英文写法一致的文本只是 EN 值等于原文，不记待翻译。
    // 不产键的两类在上面都已 continue 跳过：先跳过空文本节点（Value 为空串），再跳过槽位豁免节点
    // （映射表登记 langRefPolicy=none，如选择框 Value）；走到这里的每个节点都必须产键。
    // 原本会被"中英文一致"规则挡下的节点在这里改记 identicalTextKeys，供交付说明逐条核对。
    const dynamic = isDynamicText(text);
    if (dynamic.dynamic) {
      report.identicalTextKeys.push({ sourceRef: ref, text, reason: dynamic.reason });
      if (buttonControlTypes.has(String(node.controlType || ""))) {
        report.buttonFamilyKeys.push({
          sourceRef: ref,
          text,
          controlType: node.controlType,
          reason: "按钮族带文案一律挂 LangName（数值/符号按钮也产键）：" + dynamic.reason
        });
      }
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
      const made = makeText(rawText || text, hit.EN);
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
    } else if (translatedSuffix(text, translations)) {
      // 译文派生：该页已产出英文译文时，用它当语义名（中文文案的英文翻译 → PascalCase 标识符）。
      suffix = translatedSuffix(text, translations);
      source = "translated";
    } else {
      // 正负步进标签（+5 / -1 / +0.5）用稳定语义名 Plus5 / Minus1 / Plus0Dot5；
      // 其余数字/符号类文本走 ASCII / 图层名，仍取不到时落兜底临时键 TextNN。
      const signed = signNumberSuffix(text);
      const ascii = asciiSuffix(text);
      if (signed) {
        suffix = signed;
        source = "signNumber";
      } else if (ascii) {
        suffix = ascii;
        source = "asciiText";
      } else if (valueLiteralSuffix(text)) {
        suffix = valueLiteralSuffix(text);
        source = "valueLiteral";
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
    const made = makeText(rawText || text, "");
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

  // 4) 只合并调用方显式传入的 noLangRefs；生成器不自动往这个通道写任何条目。
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
  const titleText = normalizeNewlines(toText(args.titleText)) || titleFromMapping(mapping);
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
    identicalTextKeys: derived.report.identicalTextKeys.length,
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
      const text = normalizeNewlines(toText(item.sourceText));
      if (text) return text;
    }
  }
  for (const item of audit) {
    if (item && item.role === "page-title") {
      const text = normalizeNewlines(toText(item.sourceText));
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
  valueLiteralSuffix,
  parseDictionary,
  buildKeyCatalog,
  buildKeyCatalogFromFiles,
  readDslRootName,
  buildRefNameIndex,
  titleFromMapping,
  localesFrom,
  deriveLangSpec
};
