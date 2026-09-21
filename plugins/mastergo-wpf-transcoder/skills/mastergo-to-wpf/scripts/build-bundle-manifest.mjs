// 机械把 gen-mtslg-layout-manifest.js 的推导结果并进 Bundle 清单：
//   - 页面名 = Layout 清单里的 pageTarget（唯一真值源，不在这里另写一份）
//   - 其余路径全部由页面名 / 项目根机械推导，禁止写死某个页面的文件名
//   - menuItems / layoutStatus / layoutEvidence 照抄推导产物，不手写菜单
// 用法: node build-bundle-manifest.mjs <layout-manifest.json> <out-bundle.json> <projectRoot> [area] [--replace-existing]
import fs from "node:fs";
import path from "node:path";

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
  dslPath: "Generated/dsl.snapshot.json",
  visibilityPath: "Generated/visibility.json",
  svgPath: "Generated/extractSvg.json",
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
