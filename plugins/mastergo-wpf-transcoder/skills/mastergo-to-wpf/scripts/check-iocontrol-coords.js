#!/usr/bin/env node
/**
 * check-iocontrol-coords.js —— IOContorl 页面坐标核对器
 *
 * 核对生成的页面 XML 的几何（Left/Top/Width/Height）与设计稿节点 bbox 是否逐项一致。
 * MTSLG 页面生成后必须执行此检查。
 *
 * 节点输入 JSON（由 check-coords.mjs 从页面 mapping 机械生成 page-absolute bbox；不由人或模型逐节点抄录）：
 *   [
 *     { "id": "dsl-node-id（与 XML 的 ID 属性一致；XML 无 ID 的节点用 ref）",
 *       "x": 10, "y": 35, "w": 160, "h": 150,          // 控件自身 page-absolute bbox，double
 *       "contentOriginX": 0, "contentOriginY": 192 },     // 该节点 XML 父容器的页面绝对坐标
 *     ...
 *   ]
 * 对照规则：XML.Left ≈ x - contentOriginX，XML.Top ≈ y - contentOriginY，XML.Width ≈ w，XML.Height ≈ h
 * （容差 --tolerance 默认 0.5）；NaN 只与 NaN/缺失 算匹配，NaN 与具体数值算 MISMATCH。
 * TextBlock 的 Width 固定为 NaN（自适应），节点表按 NaN 传入即可。
 * contentOriginX/contentOriginY 的取值 = 该节点在 XML 里的父容器页面绝对坐标：
 *   - 根级节点（父容器是页面根）：X 用 0，Y 用 192（顶层公共栏 126 + 示例标题 66，只在根级扣一次）；
 *   - 嵌套节点：用父容器的 pageAbsX / pageAbsY（生成器对嵌套节点按父容器相对发射，不再扣 192）。
 * 与 validate-iocontrol-provenance.js 的 expectedLeft/expectedTop 计算口径一致。
 *
 * 用法：
 *   node check-iocontrol-coords.js --xml <page.xml> --nodes <nodes.json> [--tolerance 0.5]
 * 退出码：0 = 全部匹配；1 = 存在 MISMATCH/MISSING；2 = 参数或文件错误。
 */
'use strict';

const path = require('path');
// 数值解析的唯一实现（见 scripts/lib/script-helpers.js；本检查器与 provenance 校验器共用同一口径）。
const { numberOrNull: num } = require(path.join(__dirname, 'lib', 'script-helpers.js'));

const fs = require('fs');

const args = process.argv.slice(2);
function argVal(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
const xmlPath = argVal('--xml');
const nodesPath = argVal('--nodes');
const tolerance = parseFloat(argVal('--tolerance') || '0.5');

if (!xmlPath || !nodesPath) {
  console.error('用法: node check-iocontrol-coords.js --xml <page.xml> --nodes <nodes.json> [--tolerance 0.5]');
  process.exit(2);
}
if (!fs.existsSync(xmlPath) || !fs.existsSync(nodesPath)) {
  console.error('文件不存在: ' + (!fs.existsSync(xmlPath) ? xmlPath : nodesPath));
  process.exit(2);
}

const xml = fs.readFileSync(xmlPath, 'utf8');
const nodes = JSON.parse(fs.readFileSync(nodesPath, 'utf8'));
if (!Array.isArray(nodes)) {
  console.error('nodes JSON 必须是数组');
  process.exit(2);
}

// 提取所有 <IOContorl .../> 叶子/开标签的属性表
const tagRe = /<IOContorl\b([^<>]*?)(\/)?>/g;
const attrRe = /([A-Za-z][\w]*)\s*=\s*"([^"]*)"/g;
const xmlNodes = [];
let m;
while ((m = tagRe.exec(xml)) !== null) {
  const attrs = {};
  let a;
  while ((a = attrRe.exec(m[1])) !== null) attrs[a[1]] = a[2];
  if (attrs.ID === '' && !attrs.ControlType) continue; // 跳过根节点
  if (attrs.ID || attrs.ControlType || attrs.Left !== undefined) xmlNodes.push(attrs);
}

function close(a, b, tol) {
  const aAbsent = a === 'NaN' || a === null;
  const bAbsent = b === 'NaN' || b === null;
  if (aAbsent || bAbsent) return aAbsent === bAbsent; // NaN 只对 NaN/缺失算匹配
  return Math.abs(a - b) <= tol;
}

const results = [];
let ok = 0, mismatch = 0, missing = 0, extra = 0, untracked = 0;

// 按 id / ref 匹配
const usedNode = new Set();
for (const xn of xmlNodes) {
  const key = xn.ID || null;
  let src = null;
  if (key) src = nodes.find(n => (n.id === key || n.ref === key) && !usedNode.has(n));
  // 禁止 ControlType + 坐标自动兜底：相同组件实例可能结构和坐标都相似，
  // 位置匹配会掩盖错误的实例/子节点来源绑定。必须使用唯一 ID/ref。
  if (!src) {
    untracked++;
    results.push(`UNTRACKED ID="${xn.ID || ''}" ControlType="${xn.ControlType || ''}" (XML 有、节点表无)`);
    continue;
  }
  usedNode.add(src);

  const xl = num(xn.Left), xt = num(xn.Top), xw = num(xn.Width), xh = num(xn.Height);
  // 度量缺失必须先报出来：否则 x/y 为 null 时后续算术会把 null 当 0 参与比较，报出的
  // "dsl=0" 会误导排查。缺度量一律记 MISMATCH，绝不允许被跳过。
  const missingFields = [];
  for (const field of ['x', 'y', 'w', 'h']) {
    const value = src[field];
    if (value === undefined || value === null || value === '') missingFields.push(field);
  }
  if (missingFields.length > 0) {
    mismatch++;
    results.push('MISMATCH id="' + (src.id || src.ref || '?') + '" 缺少设计稿度量: ' +
      missingFields.join(', ') + '（节点表必须给出该节点自身的 bbox，缺度量不允许跳过核对）');
    continue;
  }
  // 原点 = 该节点 XML 父容器的页面绝对坐标（根级节点为 0 / 192；嵌套节点为父容器的 pageAbs 坐标）。
  const originX = src.contentOriginX === undefined || src.contentOriginX === null ? 0 : Number(src.contentOriginX);
  const originY = src.contentOriginY === undefined || src.contentOriginY === null ? 192 : Number(src.contentOriginY);
  if (!Number.isFinite(originX) || !Number.isFinite(originY)) {
    mismatch++;
    results.push('MISMATCH id="' + (src.id || src.ref || '?') + '" contentOriginX/Y 必须是数值，当前为 ' +
      JSON.stringify([src.contentOriginX, src.contentOriginY]));
    continue;
  }
  const sl = num(src.x - originX), st = num(src.y - originY), sw = num(src.w), sh = num(src.h);
  const problems = [];
  if (!close(xl, sl, tolerance)) problems.push(`Left xml=${xl} dsl=${sl}`);
  if (!close(xt, st, tolerance)) problems.push(`Top xml=${xt} dsl=${st}`);
  if (!close(xw, sw, tolerance)) problems.push(`Width xml=${xw} dsl=${sw}`);
  if (!close(xh, sh, tolerance)) problems.push(`Height xml=${xh} dsl=${sh}`);

  if (problems.length === 0) {
    ok++;
    results.push(`OK id="${src.id || src.ref || '?'}" ${describe(xn)}`);
  } else {
    mismatch++;
    results.push(`MISMATCH id="${src.id || src.ref || '?'}" ${problems.join(', ')} | xml ${describe(xn)}`);
  }
}

for (const n of nodes) {
  if (!usedNode.has(n)) {
    extra++;
    results.push(`EXTRA id="${n.id || n.ref || '?'}" x=${n.x} y=${n.y} w=${n.w} h=${n.h} (节点表有、XML 无)`);
  }
}

function describe(a) {
  return `Left=${a.Left} Top=${a.Top} Width=${a.Width} Height=${a.Height} (${a.ControlType || 'container'})`;
}

console.log(results.join('\n'));
console.log(`\n汇总: OK=${ok} MISMATCH=${mismatch} EXTRA=${extra} UNTRACKED=${untracked}`);
process.exit(mismatch > 0 || extra > 0 ? 1 : 0);
