// 机械把 gen-mtslg-layout-manifest.js 的推导结果并进 Bundle 清单：
//   - 页面名 = Layout 清单里的 pageTarget（唯一真值源，不在这里另写一份）
//   - 其余路径全部由页面名 / 项目根机械推导，禁止写死某个页面的文件名
//   - menuItems / layoutStatus / layoutEvidence 照抄推导产物，不手写菜单
//   - **采集输入（dslPath / visibilityPath / svgPath）只从运行登记表取**：`--run-json` 是必填，
//     按登记表解析 + 校验，并把 sha256 写进清单（manifest.runRegistry.digests），Bundle 会复校；
//     没有 --run-json 直接报错（清单不允许自己拼采集输入路径）。
// 用法: node build-bundle-manifest.mjs <layout-manifest.json> <out-bundle.json> <projectRoot> <area>
//        --run-json <run.json> [--page-title <标题>] [--replace-existing]
//
// `area`（区域前缀）**必填且不做推导**：它决定 `UI/<区域>/View|ViewModel` 的输出目录，
// 唯一实现是 run-all.ps1 的取值链（命令行 -Ui → 项目登记表 pages[].ui → derivation 的 F<n>
// → Target 编号前缀 → Target 首词 → 报错）。本脚本再写一份推导就会出现两处口径不一致
// （例如无编号 Target 一处给 `HomeContent`、另一处给 `Home`），因此缺失就报错。
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const runRegistry = require("./lib/run-registry.js");

// 参数解析：带值开关（--run-json / --page-title）的取值必须从位置参数里剔除，
// 否则 `… <projectRoot> --run-json X` 这种少传 area 的调用会把 X 当成 area，绕过必填门禁。
const positional = [];
const flags = {};
for (let index = 0; index < process.argv.slice(2).length; index += 1) {
  const token = process.argv.slice(2)[index];
  if (token === "--replace-existing") { flags.replaceExisting = true; continue; }
  if (token === "--run-json" || token === "--page-title") {
    const value = process.argv.slice(2)[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(token + " 缺少取值");
    flags[token.slice(2)] = value;
    index += 1;
    continue;
  }
  if (token.startsWith("--")) throw new Error("未知参数: " + token);
  positional.push(token);
}
const [layoutManifestFile, outFile, projectRootArg, areaArg] = positional;
if (!layoutManifestFile || !outFile) {
  console.error("usage: node build-bundle-manifest.mjs <layout-manifest.json> <out-bundle.json> <projectRoot> <area> --run-json <run.json> [--page-title <标题>] [--replace-existing]");
  process.exit(2);
}
// area 必填：位置在 projectRoot 之后，因此"缺 area"优先于"缺 --run-json"报错（与参数顺序一致）。
if (!areaArg || !String(areaArg).trim()) {
  throw new Error("缺少区域前缀 area（第 4 个位置参数）：它决定 UI/<区域>/View|ViewModel 输出目录。" +
    "取值链的唯一实现在 run-all.ps1（-Ui → 项目登记表 pages[].ui → derivation 的 F<n> → Target 编号前缀 → Target 首词），" +
    "本脚本不再自行推导；手工调用请显式传入。");
}
const area = String(areaArg).trim();

const projectRoot = path.resolve(projectRootArg || ".");
const layout = JSON.parse(fs.readFileSync(layoutManifestFile, "utf8"));
const name = layout.pageTarget;
if (!name) throw new Error("Layout 清单缺少 pageTarget，无法推导页面名");

// 运行登记表（必填）：采集输入只按登记表解析，不再自己拼路径。
const runJsonArg = flags["run-json"] || null;
const pageTitleArg = flags["page-title"] || null;
// 采集输入**只从运行登记表取**：没有 --run-json 就没有输入来源，直接失败——
// 不再回落到顶层 `Generated/*.json`（那正是"旧文件静默顶替本次产物"的来源）。
if (!runJsonArg) {
  throw new Error("缺少 --run-json：采集输入（DSL 快照 / 可见性 / extractSvg）只从运行登记表 " +
    "Generated/runs/<Target>/run.json 取，本脚本不再按顶层 Generated/*.json 拼路径。" +
    "请用 run-all.ps1（它会自动传入），或手工显式给出 --run-json。");
}
const runJsonFile = path.resolve(projectRoot, runJsonArg);
const runJsonData = runRegistry.loadRegistry(runJsonFile);
runRegistry.assertBinding(runJsonData, { projectRoot, target: name, ui: area });
const resolvedInputs = {
  snapshot: runRegistry.resolveArtifact(runJsonData, "snapshot", { projectRoot }),
  visibility: runRegistry.resolveArtifact(runJsonData, "visibility", { projectRoot }),
  extractSvg: runRegistry.resolveArtifact(runJsonData, "extractSvg", { projectRoot })
};
// 旧布局影子文件：登记表之外的同名旧文件一律拒绝，避免"静默用旧数据"。
runRegistry.assertNoLegacyShadow(runJsonData, "snapshot", { projectRoot });
runRegistry.assertNoLegacyShadow(runJsonData, "visibility", { projectRoot });
runRegistry.assertNoLegacyShadow(runJsonData, "extractSvg", { projectRoot });

const csprojs = fs.readdirSync(projectRoot).filter((file) => file.toLowerCase().endsWith(".csproj"));
if (csprojs.length !== 1) {
  throw new Error(`项目根下必须恰好有一个 .csproj（Bundle 会校验页面/Icon/语言/View/Layout 是否已登记），当前找到 ${csprojs.length} 个`);
}
const csproj = csprojs[0];
const projectName = path.basename(csproj, ".csproj");
const inputs = (file) => `Generated/_inputs/${name}.${file}`;
const glossary = inputs("lang-glossary.json");

const manifest = {
  name,
  area,
  projectRoot,
  projectName,
  rootNamespace: projectName,
  csproj,
  scaffold: true,
  projectMode: "scaffold",
  dslPath: runRegistry.projectRelative(projectRoot, resolvedInputs.snapshot),
  visibilityPath: runRegistry.projectRelative(projectRoot, resolvedInputs.visibility),
  svgPath: runRegistry.projectRelative(projectRoot, resolvedInputs.extractSvg),
  iconMapPath: inputs("icon-map.json"),
  mappingPath: `Generated/_work/${name}.mapping.json`,
  layoutPath: layout.layoutPath,
  pageTarget: layout.pageTarget,
  pageLangName: layout.pageLangName,
  layoutStatus: layout.layoutStatus,
  layoutEvidence: layout.layoutEvidence,
  menuItems: layout.menuItems,
  nesting: { enabled: true },
  languages: {
    auto: true,
    locales: ["CN", "EN"],
    bindByText: true,
    requireLangName: true,
    translations: inputs("lang-translations.json")
  }
};

// 采集输入的指纹 + 运行身份：Bundle 会按这份记录复校（路径来源、sha256、legacy 影子）。
manifest.runRegistry = {
  path: runRegistry.projectRelative(projectRoot, runJsonFile),
  runId: runJsonData.runId,
  digests: {
    snapshot: runJsonData.artifacts.snapshot.sha256,
    visibility: runJsonData.artifacts.visibility.sha256,
    extractSvg: runJsonData.artifacts.extractSvg.sha256
  }
};

// 页面标题（人工确认值）：优先命令行，其次登记表里的 inputs.pageTitleText。
const pageTitleText = pageTitleArg || (runJsonData && runJsonData.inputs && runJsonData.inputs.pageTitleText) || null;
if (pageTitleText) manifest.pageTitleText = pageTitleText;
else console.error("提示: 未提供页面标题（--page-title 或登记表 inputs.pageTitleText）；" +
  "标题将退回 mapping.textAudit 的设计原文（可能带设计页名编号）。");

if (flags.replaceExisting) {
  manifest.operation = "replace-existing";
}
if (fs.existsSync(path.join(projectRoot, ...glossary.split("/")))) { manifest.langGlossary = glossary; }

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  out: outFile,
  name: manifest.name,
  area: manifest.area,
  csproj: manifest.csproj,
  menuItems: manifest.menuItems.length,
  layoutStatus: manifest.layoutStatus,
  layoutEvidence: manifest.layoutEvidence
}, null, 2));
