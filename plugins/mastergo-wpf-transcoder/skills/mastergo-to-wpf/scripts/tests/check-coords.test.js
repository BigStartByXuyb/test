'use strict';

// 「输出父容器原点」回归：0 是合法坐标，取不到父容器 pageAbs 必须失败（不猜原点）。
// 背景：旧写法 `(Number(pageAbsY) || 192)` 会把贴页面顶边（pageAbsY = 0）的父容器算成 192，
// 而 Bundle 同一处写的是 `|| 0` —— 同一份 mapping 被两个核对器算出相差 192 的原点。
// 现在两处都只调 lib/script-helpers.js 的 outputOrigin（唯一实现）。

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { outputOrigin } = require(path.join(__dirname, '..', 'lib', 'script-helpers.js'));
const script = path.join(__dirname, '..', 'adapters/mtslg-iocontrol', 'check-coords.mjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-coords-'));

// ① 唯一实现本身：根级 / 贴顶边（0）/ 缺值。
assert.deepStrictEqual(outputOrigin({ parentIsRoot: true }), { x: 0, y: 192 },
  '根级节点原点 = (0, 192)');
assert.deepStrictEqual(outputOrigin({ parentIsRoot: false, parentPageAbsX: 0, parentPageAbsY: 0 }), { x: 0, y: 0 },
  '父容器贴页顶（pageAbsY = 0）时原点必须是 0，不能被 falsy 兜底换成 192');
assert.deepStrictEqual(outputOrigin({ parentIsRoot: false, parentPageAbsX: 0, parentPageAbsY: 300, inset: { left: 1, top: 40 } }),
  { x: 1, y: 340 }, '嵌套节点原点 = 父容器 pageAbs + 内容区 inset');
assert.strictEqual(outputOrigin({ parentIsRoot: false, parentPageAbsX: 0 }), null,
  '缺父容器 pageAbsY 时必须返回 null（由调用方 fail-closed，不猜原点）');
assert.strictEqual(outputOrigin({ parentIsRoot: false, parentPageAbsX: 0, parentPageAbsY: 'NaN' }), null,
  '父容器 pageAbsY 不是有限数时同样返回 null');

// ② 端到端：mapping → coords.json（三条分支：根级 / 父 y=0 / 父 y=300）
const makeMapping = (groupY) => ({
  rootRef: 'page/root',
  contentOriginX: 0,
  contentOriginY: 192,
  sourceNodes: [
    { ref: 'page/root', type: 'COMPONENT', name: '页', parentRef: null, pageAbsX: 0, pageAbsY: 0, width: 1280, height: 1024 },
    Object.assign({ ref: 'page/root/group', type: 'INSTANCE', name: '信息分组-模块化', parentRef: 'page/root', pageAbsX: 100, width: 300, height: 200 },
      groupY === null ? {} : { pageAbsY: groupY }),
    { ref: 'page/root/group/label', type: 'TEXT', name: '周期名称', parentRef: 'page/root/group', pageAbsX: 120, pageAbsY: 60, width: 100, height: 20 },
    { ref: 'page/root/group2', type: 'INSTANCE', name: '信息模块-手动控制弹层', parentRef: 'page/root', pageAbsX: 400, pageAbsY: 300, width: 300, height: 200 },
    { ref: 'page/root/group2/label', type: 'TEXT', name: '标题', parentRef: 'page/root/group2', pageAbsX: 420, pageAbsY: 350, width: 100, height: 20 },
    { ref: 'page/root/btn', type: 'INSTANCE', name: '轴操作', parentRef: 'page/root', pageAbsX: 900, pageAbsY: 202, width: 40, height: 40 }
  ],
  nodes: [
    { ref: 'page/root/group', xmlId: 'grp', sourceRef: 'page/root/group', controlType: 'GroupBox', contentInset: { left: 1, top: 35 }, expectedWidth: 300, expectedHeight: 200 },
    { ref: 'page/root/group/label', xmlId: 'lbl', sourceRef: 'page/root/group/label', controlType: 'TextBlock', layoutParent: 'page/root/group', expectedHeight: 40 },
    { ref: 'page/root/group2', xmlId: 'grp2', sourceRef: 'page/root/group2', controlType: 'GroupBox', contentInset: { left: 1, top: 40 }, expectedWidth: 300, expectedHeight: 200 },
    { ref: 'page/root/group2/label', xmlId: 'lbl2', sourceRef: 'page/root/group2/label', controlType: 'TextBlock', layoutParent: 'page/root/group2', expectedHeight: 40 },
    { ref: 'page/root/btn', xmlId: 'btn', sourceRef: 'page/root/btn', controlType: 'IconButton', expectedWidth: 40, expectedHeight: 40 }
  ]
});

const runCoords = (mapping, name) => {
  const mappingPath = path.join(dir, name + '.mapping.json');
  const outPath = path.join(dir, name + '.coords.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2), 'utf8');
  const run = spawnSync(process.execPath, [script, mappingPath, outPath], { encoding: 'utf8' });
  return { run, outPath };
};

const ok = runCoords(makeMapping(0), 'nested-at-zero');
assert.strictEqual(ok.run.status, 0, ok.run.stderr);
const coords = new Map(JSON.parse(fs.readFileSync(ok.outPath, 'utf8')).map((item) => [item.id, item]));
assert.strictEqual(coords.get('grp').contentOriginY, 192, '根级容器原点 = 192');
assert.strictEqual(coords.get('btn').contentOriginY, 192, '根级按钮原点 = 192');
assert.strictEqual(coords.get('lbl').contentOriginY, 35,
  '父容器 pageAbsY = 0 + inset.top = 35 → 35（旧写法 `|| 192` 会算成 227）');
assert.strictEqual(coords.get('lbl2').contentOriginY, 340, '父容器 pageAbsY = 300 + inset.top = 40 → 340');

// ③ 父容器缺 pageAbsY：必须失败并点名节点（不猜原点），而不是拿 192/0 顶上。
const bad = runCoords(makeMapping(null), 'parent-without-y');
assert.notStrictEqual(bad.run.status, 0, '父容器缺 pageAbsY 时必须失败');
assert.match(bad.run.stderr, /无法确定输出父容器原点/);
assert.match(bad.run.stderr, /不能猜原点/);

console.log('PASS coords output-origin regression test');
