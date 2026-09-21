// 机械把 gen-mtslg-layout-manifest.js 的推导结果并进 Bundle 清单：
//   - 页面名 = Layout 清单里的 pageTarget（唯一真值源，不在这里另写一份）
//   - 其余路径全部由页面名 / 项目根机械推导，禁止写死某个页面的文件名
//   - menuItems / layoutStatus / layoutEvidence 照抄推导产物，不手写菜单
//   - **采集输入（dslPath / visibilityPath / svgPath）优先从运行登记表取**：给 --run-json 时
//     按登记表解析 + 校验，并把 sha256 写进清单（manifest.runRegistry.digests），Bundle 会复校；
//     不给 --run-json 时退回旧顶层路径并明确警告（旧路径与"按页归档"并存时就是静默用旧数据的来源）。
// 用法: node build-bundle-manifest.mjs <layout-manifest.json> <out-bundle.json> <projectRoot> [area]
//        [--run-json <run.json>] [--page-title <标题>] [--replace-existing]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const runRegistry = require("./lib/run-registry.js");

const positional = process.argv.slice(2).filter((value) => !value.startsWith("--"));
const [layoutManifestFile, outFile, projectRootArg, areaArg] = positional;
if (!layoutManifestFile || !outFile) {
  console.error("usage: node build-bundle-manifest.mjs <layout-manifest.json> <out-bundle.json> <projectRoot> [area] [--replace-existing]");
  process.exit(2);
}

const projectRoot = path.resolve(projectRootArg || ".");
const layout = JSON.parse(fs.readFileSync(layoutManifestFile, "utf8"));
const name = layout.pageTarget;
if (!name) throw new Error("Layout 清单缺少 pageTarget，无法推导页面名");

// 运行登记表（可选）：给了就只按登记表解析采集输入，不再自己拼路径。
const runJsonArg = (() => {
  const index = process.argv.indexOf("--run-json");
  return index >= 0 ? process.argv[index + 1] : null;
})();
const pageTitleArg = (() => {
  const index = process.argv.indexOf("--page-title");
  return index >= 0 ? process.argv[index + 1] : null;
})();
let runJsonFile = null;
let runJsonData = null;
let resolvedInputs = null;
if (runJsonArg) {
  runJsonFile = path.resolve(projectRoot, runJsonArg);
  runJsonData = runRegistry.loadRegistry(runJsonFile);
  resolvedInputs = {
    snapshot: runRegistry.resolveArtifact(runJsonData, "snapshot", { projectRoot }),
    visibility: runRegistry.resolveArtifact(runJsonData, "visibility", { projectRoot }),
    extractSvg: runRegistry.resolveArtifact(runJsonData, "extractSvg", { projectRoot })
  };
  // 旧布局影子文件：登记表之外的同名旧文件一律拒绝，避免"静默用旧数据"。
  runRegistry.assertNoLegacyShadow(runJsonData, "snapshot", { projectRoot });
  runRegistry.assertNoLegacyShadow(runJsonData, "visibility", { projectRoot });
  runRegistry.assertNoLegacyShadow(runJsonData, "extractSvg", { projectRoot });
}

const csprojs = fs.readdirSync(projectRoot).filter((file) => file.toLowerCase().endsWith(".csproj"));
if (csprojs.length !== 1) {
  throw new Error(`项目根下必须恰好有一个 .csproj（Bundle 会校验页面/Icon/语言/View/Layout 是否已登记），当前找到 ${csprojs.length} 个`);
}
const csproj = csprojs[0];
const projectName = path.basename(csproj, ".csproj");
const areaMatch = name.match(/^([A-Za-z]+\d+)/);
const area = areaArg || (areaMatch ? areaMatch[1] : name);
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
  dslPath: resolvedInputs ? runRegistry.projectRelative(projectRoot, resolvedInputs.snapshot) : "Generated/dsl.snapshot.json",
  visibilityPath: resolvedInputs ? runRegistry.projectRelative(projectRoot, resolvedInputs.visibility) : "Generated/visibility.json",
  svgPath: resolvedInputs ? runRegistry.projectRelative(projectRoot, resolvedInputs.extractSvg) : "Generated/extractSvg.json",
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
if (runJsonData) {
  manifest.runRegistry = {
    path: runRegistry.projectRelative(projectRoot, runJsonFile),
    runId: runJsonData.runId,
    digests: {
      snapshot: runJsonData.artifacts.snapshot.sha256,
      visibility: runJsonData.artifacts.visibility.sha256,
      extractSvg: runJsonData.artifacts.extractSvg.sha256
    }
  };
} else {
  console.error("警告: 未提供 --run-json，dslPath/visibilityPath/svgPath 仍按旧顶层路径写（Generated/*.json）；" +
    "若项目已按页归档（Generated/runs/<Target>/），这些路径可能指向别的运行的旧文件。");
}

// 页面标题（人工确认值）：优先命令行，其次登记表里的 inputs.pageTitleText。
const pageTitleText = pageTitleArg || (runJsonData && runJsonData.inputs && runJsonData.inputs.pageTitleText) || null;
if (pageTitleText) manifest.pageTitleText = pageTitleText;
else console.error("提示: 未提供页面标题（--page-title 或登记表 inputs.pageTitleText）；" +
  "标题将退回 mapping.textAudit 的设计原文（可能带设计页名编号）。");

if (process.argv.includes("--replace-existing")) {
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
