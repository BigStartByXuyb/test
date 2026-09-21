#!/usr/bin/env node
// 扫描页面 Icon 资源字典（<页面名>Icons.xaml）里的 Geometry 路径数据：
// 找出坐标没有归一到原点的图标——路径最小坐标明显为负时，Viewbox 缩放会把图标画到画布外。
//
// 现行产物形态是 gen-mtslg-page-icons.js 发射的
//   <Geometry o:Freeze="True" x:Key="<键>">…路径数据…</Geometry>
// （页面级 Geometry 键，页面 XML / Layout 只引用这些键）。
// 页面可以没有页面级 Geometry（全部图标由运行时提供，Icons.xaml 是空字典）——那是合法产物，
// 本脚本按"无页面级 Geometry，跳过扫描"报告，不把它当成通过。
//
// 用法: node scan-icon-coords.js <Icons.xaml路径>
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('用法: node scan-icon-coords.js <Icons.xaml>'); process.exit(2); }
if (!fs.existsSync(file)) { console.error('文件不存在: ' + file); process.exit(2); }

const xml = fs.readFileSync(file, 'utf8');
const geometryRe = /<Geometry\b[^>]*\bx:Key="([^"]+)"[^>]*>([\s\S]*?)<\/Geometry>/g;

let match;
let scanned = 0;
let bad = 0;
while ((match = geometryRe.exec(xml))) {
  const key = match[1];
  scanned += 1;
  // 先剔除颜色值，否则 #003261 里的数字会被当成坐标
  const body = match[2].replace(/#[0-9A-Fa-f]{3,8}/g, '');
  const nums = (body.match(/-?\d+\.?\d*(?:[eE][-+]?\d+)?/g) || [])
    .map(Number).filter((value) => Number.isFinite(value));
  if (!nums.length) {
    console.log(`${key.padEnd(24)} 没有路径数值（空路径？）`);
    continue;
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const offOrigin = min < -5;
  const huge = max > 20000;
  if (offOrigin || huge) bad += 1;
  const tag = offOrigin ? '  <<< 最小坐标 < -5：路径需要平移到原点'
    : (huge ? '  <<< 坐标量级异常，人工确认' : '');
  console.log(`${key.padEnd(24)} 范围 ${min.toFixed(1)} ~ ${max.toFixed(1)}${tag}`);
}

if (!scanned) {
  console.log('本页没有页面级 Geometry（Icon 文件是空字典）：跳过图标坐标扫描');
  process.exit(0);
}
console.log(bad
  ? `\n${bad} 个图标坐标需要修复（把路径最小坐标平移到 0）`
  : `\n${scanned} 个图标坐标正常`);
