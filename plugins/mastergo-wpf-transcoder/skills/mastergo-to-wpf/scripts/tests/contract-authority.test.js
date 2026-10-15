#!/usr/bin/env node
"use strict";

// 契约文本的「单一权威」门禁。
//
// 背景：本插件的规则文本分四层——SKILL.md（常驻路由）/ references/（权威正文）/
// pipeline-contract.md（由 run-all.ps1 的 $Steps 生成）/ 仓库说明（README、ARCHITECTURE）。
// 历史问题不在某条规则本身，而在「同一条规则被复述到非权威层」：复述句会随脚本漂移，
// 而语义审计每轮只能挑出一条，于是同一主题反复返工。
//
// 这里把口径固定成机械断言：**实现级判据词只允许出现在权威文档**（bundle-manifest.md 第 7 节），
// SKILL.md 与生成物不得承载它们；文档里的 CLI 参数名必须与脚本 param 块同口径。
//
// 覆盖边界（不要高估本门禁）：它按**词表**拦（ASCII 判据词 + 少量固定中文口径词），不做语义判断——
// 换成同义写法的复述仍要靠人工评审。词表就是下面两个常量，加词即扩大覆盖。

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const PLUGIN_ROOT = path.join(__dirname, "..", "..", "..", "..");
const SKILL_ROOT = path.join(PLUGIN_ROOT, "skills", "mastergo-to-wpf");
const SKILL_MD = path.join(SKILL_ROOT, "SKILL.md");
const AUTHORITY_DOC = path.join(SKILL_ROOT, "references", "adapters", "mtslg-iocontrol", "bundle-manifest.md");
const GENERATED_CONTRACT = path.join(SKILL_ROOT, "references", "adapters", "mtslg-iocontrol", "pipeline-contract.md");
// 作业 A（mw-wpf）的规则文本（模式 / 产物规则 / 适配器描述符）参与文本门禁；只有框架手册快照例外——
// 它是从某次本地框架快照整理出的参考资料，不是本插件的规则文本（SKILL.md 已声明冲突时以本插件口径为准）。
const MANUAL_SNAPSHOT_PREFIX = path.join("references", "adapters", "mw-wpf", "framework-manual");

// 实现级判据词：出现它们就意味着在复述脚本行为，因此只允许出现在权威文档里。
const IMPLEMENTATION_TOKENS = ["--keep", "ARTIFACT_KEYS", "LEGACY_SHADOWS", "逐字节不变", "不得补写", "run-registry.mjs"];
// 续跑身份口径词：生成物只能承载 $Steps 里的步骤信息，不得承载身份判据。
// 中文词是 REVIEW 反馈补上的：只查 ASCII 会让「换身份」「身份口径」这类改写漏网。
const IDENTITY_TOKENS = ["identity", "--keep", "冻结", "回放", "不得补写", "换身份", "身份口径", "身份不可变"];

function collectDocs(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (full.includes(MANUAL_SNAPSHOT_PREFIX)) continue;
            collectDocs(full, out);
        } else if (entry.name.endsWith(".md")) {
            out.push(full);
        }
    }
    return out;
}

function hits(file, token) {
    const text = fs.readFileSync(file, "utf8");
    return text.split(/\r?\n/)
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter((item) => item.text.includes(token));
}

const relative = (file) => path.relative(PLUGIN_ROOT, file).replace(/\\/g, "/");

// 1) SKILL.md 只做路由与指针：不得承载脚本实现细节。
for (const token of ["--keep", "--key", "identity", "ARTIFACT_KEYS", "LEGACY_SHADOWS", "run-registry.mjs"]) {
    const found = hits(SKILL_MD, token);
    assert.strictEqual(found.length, 0,
        `SKILL.md 不得出现脚本实现细节 "${token}"（第 ${found.map((item) => item.line).join(", ")} 行）：` +
        "它是常驻上下文，只留路由与指针，判据写进 references/");
}

// 2) 生成物只承载 $Steps 里的步骤信息，不得承载续跑身份判据（否则与脚本/权威文档三处漂移）。
for (const token of IDENTITY_TOKENS) {
    const found = hits(GENERATED_CONTRACT, token);
    assert.strictEqual(found.length, 0,
        `pipeline-contract.md（生成物）不得出现续跑身份口径 "${token}"（第 ${found.map((item) => item.line).join(", ")} 行）：` +
        "它由 run-all.ps1 的 $Steps 生成，改不动也守不住这条规则");
}

// 3) 实现级判据词在全仓文档里只能有一处权威落点。
for (const token of IMPLEMENTATION_TOKENS) {
    const offenders = collectDocs(SKILL_ROOT)
        .flatMap((file) => hits(file, token))
        .filter((item) => path.resolve(item.file) !== path.resolve(AUTHORITY_DOC));
    assert.strictEqual(offenders.length, 0,
        `实现级判据 "${token}" 只允许出现在 ${relative(AUTHORITY_DOC)}：` +
        offenders.map((item) => `${relative(item.file)}:${item.line}`).join(", "));
}

// 4) 文档里的 CLI 参数名必须与脚本 param 块同口径：-PageName 是 run-all 转调 capture 的内层参数，
//    在文档里出现会让人以为它是 run-all 的开关（run-all 的公开名是 -DesignPageName）。
const pageNameOffenders = collectDocs(SKILL_ROOT)
    .concat([path.join(PLUGIN_ROOT, "README.md"), path.join(PLUGIN_ROOT, "ARCHITECTURE.md")])
    .filter((file) => fs.existsSync(file))
    .flatMap((file) => hits(file, "-PageName"));
assert.strictEqual(pageNameOffenders.length, 0,
    "文档不得使用内层参数名 -PageName（run-all 的公开参数是 -DesignPageName）：" +
    pageNameOffenders.map((item) => `${relative(item.file)}:${item.line}`).join(", "));

console.log("PASS 契约文本单一权威门禁（SKILL.md 无实现细节 / 生成物无身份口径 / 判据只在权威文档 / 参数名同口径）");
