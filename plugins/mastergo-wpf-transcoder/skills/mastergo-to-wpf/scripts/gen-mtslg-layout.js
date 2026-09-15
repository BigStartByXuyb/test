#!/usr/bin/env node
"use strict";

// 根据已经确认的页面注册字段创建或增量更新 Layout.xml。
// 本脚本不推断 Target、LangName、Index、权限或 IO 字段。

const fs = require("fs");
const path = require("path");
// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const { fail, xmlAttr, backupFile } = require(path.join(__dirname, "lib", "script-helpers.js"));

// MenuItem 属性顺序：与页面 XML 同一约定
//   Name → Icon → TopLeftContent/Index → LangName → PageName/IO* → UserRightId → IconWidth/IconHeight
// 即页面里的公共参数在 Layout 中保持相同的相对顺序（Icon 在前、LangName 在文本之后、
// 运行时字段居中、图标尺寸靠后）。
const ATTR_FIELDS = [
  ["Name", "name"], ["Icon", "icon"], ["TopLeftContent", "topLeftContent"], ["Index", "index"],
  ["LangName", "langName"], ["PageName", "pageName"], ["IOCommand", "ioCommand"], ["IOVisible", "ioVisible"],
  ["IOEnable", "ioEnable"], ["UserRightId", "userRightId"],
  // 设计稿标记（只在成立时由 layout 清单给出 true，其余不发射）：
  //   红字文案 → IsNeedRedMark；左上角状态方框 → IsShowStatus。
  ["IsShowStatus", "isShowStatus"], ["IsNeedRedMark", "isNeedRedMark"],
  ["IconWidth", "iconWidth"], ["IconHeight", "iconHeight"]
];

// MenuItem 常驻属性：与页面 XML 的按钮族（PageName/IOVisible/IOCommand/IOEnable 恒写）同一策略，
// 取不到来源时写空字符串占位，避免重新生成时把宿主要求的字段丢掉。
// 真值来源：模板表 layoutRules.bottomBar.menuItemAlwaysWrittenAttrs（--map 传入时读取）；
// 另外仍可由 manifest.menuItemAlwaysAttrs 追加。
const DEFAULT_MENU_ITEM_ALWAYS_ATTRS = ["LangName", "PageName", "IOCommand", "IOVisible", "IOEnable"];
let MENU_ITEM_ALWAYS_ATTRS = DEFAULT_MENU_ITEM_ALWAYS_ATTRS;

// 设计稿标记的属性名真值来源：模板表 layoutRules.bottomBar.menuItemFlags.*.attr。
// 这两个字段是“命中才写”，未命中不发射（不是常驻字段），因此不进入 MENU_ITEM_ALWAYS_ATTRS。
const DEFAULT_MENU_ITEM_FLAG_ATTRS = { statusBox: "IsShowStatus", redText: "IsNeedRedMark" };
const MENU_ITEM_FLAG_FIELDS = new Set(["isShowStatus", "isNeedRedMark"]);
let MENU_ITEM_FLAG_ATTRS = DEFAULT_MENU_ITEM_FLAG_ATTRS;

function loadMenuItemFlagAttrs(mapPath) {
  if (!mapPath) return DEFAULT_MENU_ITEM_FLAG_ATTRS;
  let templateMap;
  try { templateMap = JSON.parse(fs.readFileSync(mapPath, "utf8")); }
  catch (error) { fail("读取模板表失败: " + mapPath + " - " + error.message); }
  const flags = templateMap.layoutRules && templateMap.layoutRules.bottomBar
    ? templateMap.layoutRules.bottomBar.menuItemFlags : null;
  if (!flags) return DEFAULT_MENU_ITEM_FLAG_ATTRS;
  const statusBox = flags.statusBox && typeof flags.statusBox.attr === "string" && flags.statusBox.attr.trim()
    ? flags.statusBox.attr.trim() : DEFAULT_MENU_ITEM_FLAG_ATTRS.statusBox;
  const redText = flags.redText && typeof flags.redText.attr === "string" && flags.redText.attr.trim()
    ? flags.redText.attr.trim() : DEFAULT_MENU_ITEM_FLAG_ATTRS.redText;
  return { statusBox: statusBox, redText: redText };
}

// 把表里登记的属性名套用到发射顺序表上（改表即改产物，不在脚本里另存一份名字）。
function applyMenuItemFlagAttrs(flagAttrs) {
  MENU_ITEM_FLAG_ATTRS = flagAttrs;
  ATTR_FIELDS.forEach(function (pair) {
    if (pair[1] === "isShowStatus") pair[0] = flagAttrs.statusBox;
    if (pair[1] === "isNeedRedMark") pair[0] = flagAttrs.redText;
  });
}

function loadMenuAlwaysAttrs(mapPath) {
  if (!mapPath) return DEFAULT_MENU_ITEM_ALWAYS_ATTRS;
  let templateMap;
  try { templateMap = JSON.parse(fs.readFileSync(mapPath, "utf8")); }
  catch (error) { fail("读取模板表失败: " + mapPath + " - " + error.message); }
  const spec = templateMap.layoutRules && templateMap.layoutRules.bottomBar;
  if (!spec || !Array.isArray(spec.menuItemAlwaysWrittenAttrs)) return DEFAULT_MENU_ITEM_ALWAYS_ATTRS;
  return spec.menuItemAlwaysWrittenAttrs.map(String);
}

function parseArgs(argv) {
  let manifestPath = null;
  let overwrite = false;
  let mapPath = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--manifest") manifestPath = argv[++i];
    else if (argv[i] === "--map") mapPath = argv[++i];
    else if (argv[i] === "--overwrite") overwrite = true;
    else {
      console.error("用法: node gen-mtslg-layout.js --manifest <layout.json> [--overwrite] [--map mtslg-iocontrol-map.json]");
      process.exit(2);
    }
  }
  if (!manifestPath) {
    console.error("用法: node gen-mtslg-layout.js --manifest <layout.json> [--overwrite] [--map mtslg-iocontrol-map.json]");
    process.exit(2);
  }
  return { manifestPath, overwrite, mapPath };
}

function attrEntries(item) {
  return ATTR_FIELDS.filter(function (pair) {
    const value = item[pair[1]];
    if (value === undefined || value === null) return false;
    // 设计稿标记只在 true 时发射：false / 空串一律不写这个属性。
    // 该过滤只作用于这两个标记字段，不得影响 IO* 等“恒写”字段（它们即使取到布尔 false 也必须发射）。
    if (MENU_ITEM_FLAG_FIELDS.has(pair[1])) {
      if (value === false) return false;
      if (typeof value === "string" && !value.trim()) return false;
    }
    return true;
  }).map(function (pair) {
    return [pair[0], item[pair[1]]];
  });
}

function menuItemAlwaysAttrs(manifest) {
  const extra = Array.isArray(manifest.menuItemAlwaysAttrs)
    ? manifest.menuItemAlwaysAttrs.map(function (value) { return String(value); })
    : [];
  return MENU_ITEM_ALWAYS_ATTRS.concat(extra.filter(function (value) {
    return MENU_ITEM_ALWAYS_ATTRS.indexOf(value) < 0;
  }));
}

function withAlwaysAttrs(item, alwaysAttrs) {
  const copy = Object.assign({}, item);
  alwaysAttrs.forEach(function (attrName) {
    const field = ATTR_FIELDS.filter(function (pair) { return pair[0] === attrName; })[0];
    if (!field) fail("menuItemAlwaysAttrs 不支持 MenuItem 属性: " + attrName);
    if (copy[field[1]] === undefined || copy[field[1]] === null) copy[field[1]] = "";
  });
  return copy;
}

// 图标尺寸与页面 XML 按钮族同一规则：有 Icon 必须有 iconSize（图标图形节点 bbox），
// 取整后写 IconWidth/IconHeight；没有图标槽位时不写这三项。
function withIconSize(item) {
  const copy = Object.assign({}, item);
  const icon = typeof copy.icon === "string" ? copy.icon.trim() : "";
  if (!icon) {
    delete copy.iconWidth;
    delete copy.iconHeight;
    delete copy.iconSize;
    return copy;
  }
  const size = copy.iconSize;
  if (!size || !Number.isFinite(Number(size.width)) || !Number.isFinite(Number(size.height))) {
    fail("MenuItem 带 Icon=\"" + icon + "\"（Index=" + copy.index +
      "）但缺少 iconSize（图标图形节点 bbox）：请先在清单里补齐尺寸，禁止猜图标尺寸");
  }
  copy.iconWidth = Math.round(Number(size.width));
  copy.iconHeight = Math.round(Number(size.height));
  return copy;
}

function renderMenuItem(item, alwaysAttrs) {
  const attrs = attrEntries(withIconSize(withAlwaysAttrs(item, alwaysAttrs))).map(function (entry) {
    return entry[0] + "=\"" + xmlAttr(entry[1]) + "\"";
  }).join(" ");
  return "      <MenuItem " + attrs + " />";
}

function validateLayoutManifest(manifest) {
  if (!Array.isArray(manifest.menuItems)) fail("menuItems 必须是数组");

  const status = manifest.layoutStatus;
  if (!["complete", "none", "pending"].includes(status)) {
    fail("Layout 清单不完整：layoutStatus 必须是 complete、none 或 pending。不是拒绝生成页面，而是禁止用不完整清单生成空 Layout；请先补齐 Layout 映射后重试");
  }

  const evidence = manifest.layoutEvidence;
  if (!evidence || !Number.isInteger(Number(evidence.matchedBottomBarItems)) ||
      !Number.isInteger(Number(evidence.unresolvedBottomBarItems))) {
    fail("Layout 清单不完整：layoutEvidence 必须包含 matchedBottomBarItems 和 unresolvedBottomBarItems。不是拒绝生成页面，而是禁止用不完整清单生成空 Layout");
  }

  const matched = Number(evidence.matchedBottomBarItems);
  const unresolved = Number(evidence.unresolvedBottomBarItems);
  if (matched < 0 || unresolved < 0) {
    fail("layoutEvidence 中的组件数量不能为负数");
  }
  // 右下角“右侧底部-常驻button”分组内的实例不计入 Menu（2026-09 规则）：
  // matchedBottomBarItems 仍统计全部命中变体实例，常驻分组内的数量单独登记。
  const residentRaw = evidence.residentGroupItems;
  const resident = residentRaw === undefined || residentRaw === null ? 0 : Number(residentRaw);
  if (!Number.isInteger(resident) || resident < 0) {
    fail("layoutEvidence.residentGroupItems 必须是 0 或正整数（右下角常驻分组内不生成 MenuItem 的实例数）");
  }

  if (status === "pending") {
    fail("Layout 映射仍为 pending，禁止生成 Layout.xml；请先处理未决底部栏组件");
  }
  if (status === "none") {
    if (matched !== 0 || unresolved !== 0 || resident !== 0 || manifest.menuItems.length !== 0) {
      fail("layoutStatus=none 时，Layout 证据（含 residentGroupItems）和 menuItems 必须全部为空");
    }
    return;
  }

  if (matched === 0) {
    fail("layoutStatus=complete 但没有任何已命中的底部栏组件；无菜单页面必须标记为 none");
  }
  if (unresolved !== 0) {
    fail("Layout 仍存在未决底部栏组件（" + unresolved + " 个）：底部栏里既非装饰、又不在常驻分组、" +
      "也没按 layoutRules.bottomBar.match 登记的键命中 variants 的实例。" +
      "请在映射表登记该变体（或修正实例/组件名），不要让它静默消失");
  }
  if (manifest.menuItems.length + resident !== matched) {
    fail("Layout 映射数量不一致：matchedBottomBarItems=" + matched +
      "，menuItems=" + manifest.menuItems.length + "，residentGroupItems=" + resident +
      "（右下角“右侧底部-常驻button”分组内的实例不生成 MenuItem）");
  }
}

function renderPage(manifest) {
  const target = manifest.pageTarget;
  if (typeof target !== "string" || !target.trim()) fail("pageTarget 必须由项目或用户明确提供");
  validateLayoutManifest(manifest);
  const lines = [
    "  <Page Target=\"" + xmlAttr(target) + "\"" +
       (manifest.pageLangName !== undefined && manifest.pageLangName !== null
         ? " LangName=\"" + xmlAttr(manifest.pageLangName) + "\"" : "") + ">",
    "    <Menu>"
  ];
  const alwaysAttrs = menuItemAlwaysAttrs(manifest);
  const seenIndexes = new Set();
  manifest.menuItems.forEach(function (item, index) {
    if (!item || typeof item !== "object") fail("menuItems[" + index + "] 无效");
    if (item.index === undefined || item.index === null || !Number.isInteger(Number(item.index))) {
      fail("menuItems[" + index + "].index 必须是当前页面已确认的整数顺序");
    }
    const menuIndex = Number(item.index);
    if (menuIndex < 1) {
      fail("menuItems[" + index + "].index 必须从 1 起（菜单项连续序号；右下角常驻分组的按钮由框架单独处理，不占 Index）");
    }
    if (seenIndexes.has(menuIndex)) fail("menuItems 存在重复 Index: " + menuIndex);
    seenIndexes.add(menuIndex);
    lines.push(renderMenuItem(item, alwaysAttrs));
  });
  // Index = 菜单项自己的连续序号（从 1 起）。底栏右下角常驻分组不生成 MenuItem、也不占 Index，
  // 因此不允许出现空档或跳号：旧版"按底栏物理槽位编号、为常驻按钮留空档"的清单必须重新推导。
  for (let expected = 1; expected <= manifest.menuItems.length; expected += 1) {
    if (!seenIndexes.has(expected)) {
      fail("menuItems 的 Index 必须是 1.." + manifest.menuItems.length + " 的连续编号" +
        "（右下角常驻分组不占 Index）；缺少 Index=" + expected +
        "，当前 = [" + [...seenIndexes].join(",") + "]");
    }
  }
  lines.push("    </Menu>");
  lines.push("  </Page>");
  return lines.join("\n");
}

function insertNewPage(existing, page, pageTarget) {
  const pagesOpen = /<Pages\b[^>]*>/i.exec(existing);
  if (pagesOpen) {
    const pagesClose = existing.indexOf("</Pages>", pagesOpen.index + pagesOpen[0].length);
    if (pagesClose < 0) fail("已有 Layout.xml 的 <Pages> 缺少 </Pages>: " + pageTarget);
    const before = existing.slice(0, pagesClose).replace(/\s*$/, "");
    return before + "\n" + page + "\n" + existing.slice(pagesClose);
  }
  const bodyOpen = /<Body\b[^>]*>/i.exec(existing);
  if (bodyOpen) {
    const bodyClose = existing.indexOf("</Body>", bodyOpen.index + bodyOpen[0].length);
    if (bodyClose < 0) fail("已有 Layout.xml 的 <Body> 缺少 </Body>: " + pageTarget);
    const bodyContent = existing.slice(bodyOpen.index + bodyOpen[0].length, bodyClose);
    const toolBoundary = bodyContent.search(/<(?:LeftToolBox|ToolBox)\b/i);
    const insertAt = toolBoundary >= 0 ? bodyOpen.index + bodyOpen[0].length + toolBoundary : bodyClose;
    const before = existing.slice(0, insertAt).replace(/\s*$/, "");
    const after = existing.slice(insertAt);
    return before + "\n    <Pages>\n" + page.split("\n").map(line => "  " + line).join("\n") + "\n    </Pages>\n" + after.replace(/^\s*/, "");
  }
  const layoutClose = existing.lastIndexOf("</Layout>");
  if (layoutClose < 0) fail("已有 Layout.xml 缺少 </Layout>");
  const footerOpen = /<Footer\b/i.exec(existing);
  const insertAt = footerOpen ? footerOpen.index : layoutClose;
  const before = existing.slice(0, insertAt).replace(/\s*$/, "");
  const after = existing.slice(insertAt).replace(/^\s*/, "");
  return before + "\n  <Body>\n    <Pages>\n" + page.split("\n").map(line => "      " + line).join("\n") + "\n    </Pages>\n    <LeftToolBox />\n    <ToolBox />\n  </Body>\n" + after;
}

function renderNewLayout(manifest, page) {
  const attrs = [];
  if (manifest.windowHeight !== undefined) attrs.push("WindowHeight=\"" + xmlAttr(manifest.windowHeight) + "\"");
  if (manifest.windowWidth !== undefined) attrs.push("WindowWidth=\"" + xmlAttr(manifest.windowWidth) + "\"");
  if (manifest.version) attrs.push("Version=\"" + xmlAttr(manifest.version) + "\"");
  const headerAttrs = manifest.headerTitle
    ? " Title=\"" + xmlAttr(manifest.headerTitle) + "\""
    : "";
  const headerItems = Array.isArray(manifest.headerItems) ? manifest.headerItems.map(function (item) {
    const itemAttrs = [];
    if (item.id !== undefined && item.id !== null && item.id !== "") itemAttrs.push("Id=\"" + xmlAttr(item.id) + "\"");
    if (item.target !== undefined && item.target !== null && item.target !== "") itemAttrs.push("Target=\"" + xmlAttr(item.target) + "\"");
    return "    <HeaderItem " + itemAttrs.join(" ") + " />";
  }) : [];
  const pageLines = page.split("\n").map(function (line) { return "    " + line; });
  const leftToolBox = manifest.leftToolBoxTarget
    ? "    <LeftToolBox Target=\"" + xmlAttr(manifest.leftToolBoxTarget) + "\" />"
    : "    <LeftToolBox />";
  const toolBox = manifest.toolBoxTarget
    ? "    <ToolBox Target=\"" + xmlAttr(manifest.toolBoxTarget) + "\" />"
    : "    <ToolBox />";
  const footer = manifest.footerTarget
    ? "  <Footer Target=\"" + xmlAttr(manifest.footerTarget) + "\" />"
    : "  <Footer />";
  return [
    "<?xml version=\"1.0\" encoding=\"utf-8\"?>",
    "<Layout" + (attrs.length ? " " + attrs.join(" ") : "") + ">",
    "  <Header" + headerAttrs + ">",
    ...headerItems,
    "  </Header>",
    "  <Body>",
    "    <Pages>",
    ...pageLines,
    "    </Pages>",
    leftToolBox,
    toolBox,
    "  </Body>",
    footer,
    "</Layout>",
    ""
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(path.resolve(args.manifestPath), "utf8"));
  if (args.mapPath) MENU_ITEM_ALWAYS_ATTRS = loadMenuAlwaysAttrs(args.mapPath);
  // 即使不传 --map 也要把默认属性名套用一次，保证 ATTR_FIELDS 与 MENU_ITEM_FLAG_ATTRS 一致。
  applyMenuItemFlagAttrs(args.mapPath ? loadMenuItemFlagAttrs(args.mapPath) : DEFAULT_MENU_ITEM_FLAG_ATTRS);
  if (typeof manifest.layoutPath !== "string" || !manifest.layoutPath.trim()) {
    fail("layoutPath 必须提供");
  }
  const layoutPath = path.resolve(manifest.layoutPath);
  const page = renderPage(manifest);
  let output;
  let backup = null;

  if (!fs.existsSync(layoutPath)) {
    output = renderNewLayout(manifest, page);
  } else {
    const existing = fs.readFileSync(layoutPath, "utf8");
    if (manifest.layoutStatus === "none") {
      // No Layout mapping for this page: preserve the existing host Layout
      // instead of replacing an existing Page with an empty Menu.
      output = existing;
    } else {
    const targetPattern = new RegExp("<Page\\s+[^>]*Target=[\"']" +
      xmlAttr(manifest.pageTarget).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&") + "[\"']", "i");
    if (targetPattern.test(existing)) {
      if (!args.overwrite) {
        fail("Layout.xml 已存在相同 Target，禁止重复注册: " + manifest.pageTarget);
      }
      const pagePattern = new RegExp("<Page\\s+[^>]*Target=[\"']" +
        xmlAttr(manifest.pageTarget).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&") +
        "[\"'](?:[\\s\\S]*?<\\/Page>|\\s*\\/>)", "i");
      if (!pagePattern.test(existing)) {
        fail("Layout.xml 中相同 Target 的 Page 节点结构无效: " + manifest.pageTarget);
      }
      // 替换场景：pagePattern 从 "<Page" 开始匹配，原行首缩进会保留，
      // 因此这里去掉 page 首行自带的缩进，避免出现 4 空格的双重缩进。
      output = existing.replace(pagePattern, page.replace(/^[ \t]{0,2}/, ""));
      backup = backupFile(layoutPath);
    } else {
      output = insertNewPage(existing, page, manifest.pageTarget);
      backup = backupFile(layoutPath);
    }
    }
  }

  if (fs.existsSync(layoutPath) && !args.overwrite && backup) {
    // 增量注册本身是显式页面生成动作；仍保留备份，不静默覆盖原文件。
  }
  fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
  fs.writeFileSync(layoutPath, output, "utf8");
  console.log(JSON.stringify({
    layoutPath,
    pageTarget: manifest.pageTarget,
    menuItemCount: manifest.menuItems.length,
    menuItemAlwaysAttrs: menuItemAlwaysAttrs(manifest),
    residentGroupItems: manifest.layoutEvidence && manifest.layoutEvidence.residentGroupItems
      ? Number(manifest.layoutEvidence.residentGroupItems) : 0,
    created: !backup,
    backup
  }, null, 2));
}

try { main(); } catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
