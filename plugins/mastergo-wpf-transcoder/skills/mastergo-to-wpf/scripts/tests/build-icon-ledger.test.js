#!/usr/bin/env node
"use strict";

// 台账登记门禁回归：命名表必须**恰好**覆盖 discover 判定为「要登记」的候选
// （mustName / registration.register）。少定名 = 槽位引用了却没登记；多定名 = 登记了
// 没有任何槽位引用的图形（Icons.xaml 里的死资源）。两类以前只能靠事后语义审计发现。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "..", "build-icon-ledger.mjs");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "icon-ledger-"));
const candidatesFile = path.join(dir, "candidates.json");
const namingFile = path.join(dir, "naming.json");
const outFile = path.join(dir, "icon-map.json");

const candidate = (sourceRef, registration, extra) => Object.assign({
  sourceRef: sourceRef,
  sourceId: sourceRef,
  nodeName: "路径",
  ownerText: extra && extra.ownerText ? extra.ownerText : "",
  ledgerFields: {
    sourceId: sourceRef,
    sourceRef: sourceRef,
    ledgerSourceRef: sourceRef,
    fromDsl: false,
    bakeAncestorTransform: false,
    iconSize: { width: 16, height: 16 }
  },
  registration: registration
}, extra || {});

// 三条候选：模板族有图标槽位 → 登记；底部栏菜单项 → 登记；宿主公共栏 → 不登记。
const candidates = [
  candidate("page/btn/icon", { register: true, basis: "icon-policy-single-path", source: "componentTemplates.variants.轴操作.iconPolicy=single-path" }, { ownerText: "向上" }),
  candidate("page/bar/menu/icon", { register: true, basis: "bottom-bar-menu-item", source: "layoutRules.bottomBar.variants" }, { ownerText: "对焦" }),
  candidate("page/shell/icon", { register: false, basis: "host-shell", source: "lib/mastergo-rules.js#HOST_SHELL_NAME_MARKERS" })
];
fs.writeFileSync(candidatesFile, JSON.stringify({
  registrationAvailable: true,
  mustName: [0, 1],
  candidates: candidates
}), "utf8");

const naming = (indices) => {
  const spec = {};
  for (const index of indices) spec[String(index)] = { name: "Icon" + index + "Geometry", comment: "图标 " + index };
  fs.writeFileSync(namingFile, JSON.stringify(spec), "utf8");
};
const run = () => spawnSync(process.execPath, [script, candidatesFile, outFile, namingFile], { encoding: "utf8" });

// 1) 恰好覆盖 mustName → 通过，台账条目照抄候选的 ledgerFields。
naming([0, 1]);
const ok = run();
assert.strictEqual(ok.status, 0, ok.stderr);
const ledger = JSON.parse(fs.readFileSync(outFile, "utf8"));
assert.strictEqual(ledger.icons.length, 2);
assert.deepStrictEqual(ledger.icons.map((icon) => icon.sourceRef), ["page/btn/icon", "page/bar/menu/icon"]);
assert.deepStrictEqual(ledger.icons.map((icon) => icon.name), ["Icon0Geometry", "Icon1Geometry"]);

// 2) 漏定名（槽位引用了却没登记）→ 失败，并点名下标与判据。
naming([0]);
const missing = run();
assert.strictEqual(missing.status, 1);
assert.match(missing.stderr, /台账缺少图标/);
assert.match(missing.stderr, /#1 basis=bottom-bar-menu-item/);

// 3) 多定名（没有任何槽位引用却登记）→ 失败，并点名下标与判据。
naming([0, 1, 2]);
const extra = run();
assert.strictEqual(extra.status, 1);
assert.match(extra.stderr, /台账多出图标/);
assert.match(extra.stderr, /#2 basis=host-shell/);

// 4) 候选清单没有登记结论（旧清单 / 未传 --dsl）→ 拒绝生成，不让判定退回人脑。
fs.writeFileSync(candidatesFile, JSON.stringify({
  registrationAvailable: false,
  mustName: [],
  candidates: [{ sourceRef: "page/btn/icon", ledgerFields: { sourceRef: "page/btn/icon" } }]
}), "utf8");
naming([0]);
const noRegistration = run();
assert.strictEqual(noRegistration.status, 1);
assert.match(noRegistration.stderr, /没有登记结论/);

console.log("PASS page icon ledger registration gate regression test");
