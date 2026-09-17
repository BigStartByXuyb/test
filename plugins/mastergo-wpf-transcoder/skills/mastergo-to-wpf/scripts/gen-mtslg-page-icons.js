#!/usr/bin/env node
/*
 * MasterGo extractSvg JSON + page icon map -> one page Icon ResourceDictionary.
 *
 * Usage:
 *   node gen-mtslg-page-icons.js <extractSvg.json> <page-icon-map.json> <PageIcons.xaml>
 *   node gen-mtslg-page-icons.js <extractSvg.json> <page-icon-map.json> <PageIcons.xaml> <dsl.snapshot.json>
 *
 * page-icon-map.json:
 * {
 *   "icons": [
 *     { "sourceId": "exact extractSvg entry id", "name": "ExitGeometry", "comment": "退出", "sourceRef": "MasterGo DSL ref" },
 *     { "sourceId": "DSL PATH 节点 id", "sourceRef": "同一 PATH 节点 id", "name": "AxisDownGeometry", "comment": "向下",
 *       "fromDsl": true, "bakeAncestorTransform": true },
 *     { "sourceId": "DSL 图标组 id", "sourceRef": "同一图标组 id", "name": "BothSidesGeometry", "comment": "双侧",
 *       "fromDsl": true }
 *   ]
 * }
 *
 * sourceId, name, comment and sourceRef are all required. `name` is the approved
 * English resource name; `comment` is the Chinese display name written to XAML.
 * Duplicate names receive deterministic numeric suffixes (2, 3, ...). This tool
 * never derives a name from a layer ID, location, or geometry.
 *
 * 「approved」的判定口径（避免误读为“必须来自外部/历史权威清单”）：
 *   1) approved = 该名称已登记在**本页图标台账**（icon-map 的 icons[]）中；本页自建的
 *      语义键与页面内唯一临时键（status=provisional）同样算 approved，不需要跨页复用；
 *   2) 图标是页面级资源：键只要求在本页 Icons.xaml 中唯一、且被本页（含 Layout 菜单）引用；
 *   3) 仍然禁止把图层 ID/坐标/几何外观当作名字（例如 MGIcon_<layer-id>）——这条禁令针对
 *      “由机器自动拼名”，不限制人按语义起名（SKILL 口径：优先中文语义对应的英文键）。
 *
 * 补充来源（extractSvg 去重导致条目缺失时）：
 *   extractSvg 只输出 PATH 自身的 d + transform，几何完全相同的复用实例会被去重
 *   （例如同一图标被旋转/翻转复用），因此某些方向按钮拿不到条目。此时可传入
 *   DSL 快照，并用 `fromDsl: true` 让脚本从 DSL 的 PATH 节点合成几何：
 *     - 默认只合成「原始 d + PATH 自身 matrix」，与 extractSvg 的输出保持一致；
 *     - **祖先朝向自动烘焙（机械兜底）**：只要图标节点的 PATH 祖先链上出现
 *       rotate / flipH / flipV（典型就是「方向按钮组」靠组级变换区分方向），脚本就自动
 *       改用「DSL + 烘焙」，**不依赖台账手写** `bakeAncestorTransform`——方向只存在于祖先
 *       变换上，extractSvg 与「DSL 但不烘焙」都表达不了它，漏写字段会静默产出方向错的几何。
 *       自动烘焙的图标会在 stdout 报告，可据此核对。祖先链无朝向时行为不变（仍走 extractSvg）。
 *     - `bakeAncestorTransform: true` 仍可显式声明；显式与自动的结果一致。
 *       烘焙是机械计算：按树序把祖先 rotate / flipH / flipV 烘进坐标，计算结果即产物。
 *       不做视觉判断、不读图、不识别图形外观；几何完全一致的复用实例按同一份几何出图，
 *       属设计侧缺图，登记待确认即可，不得自行镜像或猜测朝向。
 *     - `sourceRef` 可以指向 PATH 节点，也可以指向**图标组**：指向组时，收集组内
 *       全部 PATH（按树序）合成同一条 Geometry。多路径图标（例如「双侧箭头」由两条
 *       路径拼成）按 extractSvg 的口径就是一个条目、多条 d，必须走这条路才不会缺图形；
 *       组内一个 PATH 都没有时直接失败，不静默产出空图标。
 *   注意：`extractSvg` 条目与祖先朝向是两件独立的事。走 extractSvg 时**不会**带上
 *   祖先的 rotate/flip（它只给 PATH 自身的 d + transform）；祖先链上有朝向时，即使
 *   extractSvg 恰好有条目，也必须按设计稿的组级朝向出图——脚本会自动改用 DSL + 烘焙，
 *   台账显式写 `fromDsl` + `bakeAncestorTransform` 则与自动结果一致。
 *   自动判定需要第 4 个参数（DSL 快照）；不传快照时只保留显式声明这条路径。
 *
 * Geometry 默认只输出路径数据，不写 F0/F1 填充规则标记（框架解析器不使用该标记）。
 * 为保证去掉标记后外观不变，脚本会先对重复子路径安全去重，再用内置栅格化比较
 * EvenOdd 与 Nonzero 的渲染结果；只有两者确实不同时才补回 F1。详见 planGeometry。
 */
const fs = require('fs');
// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const { xmlAttr: escapeXml, readJson } = require(require('path').join(__dirname, 'lib', 'script-helpers.js'));

const [, , svgFile, mapFile, outFile, dslFile] = process.argv;
if (!svgFile || !mapFile || !outFile) {
  console.error('Usage: node gen-mtslg-page-icons.js <extractSvg.json> <page-icon-map.json> <PageIcons.xaml> [dsl.snapshot.json]');
  process.exit(1);
}

function parsePaths(svg, sourceId) {
  const paths = [];
  const pathRe = /<path\b([^>]*?)\/?>/gi;
  let match;
  while ((match = pathRe.exec(svg))) {
    const attrs = match[1];
    const attrValue = name => {
      const found = attrs.match(new RegExp(name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", 'i'));
      return found ? (found[1] ?? found[2]) : undefined;
    };
    const d = attrValue('d');
    if (d === undefined) continue;
    if (!d.trim()) continue;
    const fillRule = attrValue('fill-rule');
    const transform = attrValue('transform');
    const matrix = (transform && transform.match(/^matrix\(([^)]+)\)$/i) || [])[1];
    paths.push({ d, fillRule: fillRule === 'evenodd' ? 'EvenOdd' : 'Nonzero', transform, matrix });
  }
  if (paths.length === 0) throw new Error(`Source ${sourceId} has no supported SVG path`);
  return paths;
}

function parseMatrix(matrix, sourceId) {
  const values = String(matrix).split(/[\s,]+/).filter(Boolean).map(Number);
  if (values.length !== 6 || values.some(value => !Number.isFinite(value))) {
    throw new Error(`Source ${sourceId} has an invalid SVG matrix transform: ${matrix}`);
  }
  return values;
}

function formatNumber(value) {
  const rounded = Number(Number(value).toFixed(12));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function transformPathData(data, matrixText, sourceId) {
  const matrix = parseMatrix(matrixText, sourceId);
  const [a, b, c, d, e, f] = matrix;
  const tokens = String(data).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const parameterCount = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  let index = 0;
  let command = null;
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  const output = [];
  const isCommand = token => /^[A-Za-z]$/.test(token);
  const readNumber = () => {
    if (index >= tokens.length || isCommand(tokens[index])) {
      throw new Error(`Source ${sourceId} has incomplete SVG path data near token ${index}`);
    }
    const value = Number(tokens[index++]);
    if (!Number.isFinite(value)) throw new Error(`Source ${sourceId} has invalid SVG path number`);
    return value;
  };
  const transformPoint = ([x, y]) => [a * x + c * y + e, b * x + d * y + f];
  const pointText = ([x, y]) => `${formatNumber(x)},${formatNumber(y)}`;
  const relativePoint = (x, y, relative) => relative ? [currentX + x, currentY + y] : [x, y];

  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++];
    if (!command) throw new Error(`Source ${sourceId} has SVG coordinates without a command`);
    const upper = command.toUpperCase();
    const relative = command === command.toLowerCase();
    if (upper === 'Z') {
      output.push('Z');
      currentX = startX;
      currentY = startY;
      command = null;
      continue;
    }
    const count = parameterCount[upper];
    if (!count) throw new Error(`Source ${sourceId} uses unsupported SVG command ${command}`);
    if (upper === 'A') {
      throw new Error(`Source ${sourceId} uses an arc command with a matrix transform; refusing lossy conversion`);
    }
    let firstMove = upper === 'M';
    while (index < tokens.length && !isCommand(tokens[index])) {
      const values = Array.from({ length: count }, readNumber);
      let points;
      let end;
      if (upper === 'H') {
        end = relativePoint(values[0], 0, relative);
        points = [end];
      } else if (upper === 'V') {
        end = relativePoint(0, values[0], relative);
        points = [end];
      } else if (upper === 'M' || upper === 'L' || upper === 'T') {
        end = relativePoint(values[0], values[1], relative);
        points = [end];
      } else if (upper === 'C') {
        points = [
          relativePoint(values[0], values[1], relative),
          relativePoint(values[2], values[3], relative),
          relativePoint(values[4], values[5], relative)
        ];
        end = points[2];
      } else if (upper === 'S' || upper === 'Q') {
        points = [
          relativePoint(values[0], values[1], relative),
          relativePoint(values[2], values[3], relative)
        ];
        end = points[1];
      }
      const transformed = points.map(transformPoint);
      if (upper === 'H' || upper === 'V') {
        output.push(`L${pointText(transformed[0])}`);
      } else if (upper === 'M' || upper === 'L' || upper === 'T') {
        output.push(`${firstMove ? 'M' : upper}${pointText(transformed[0])}`);
      } else if (upper === 'C') {
        output.push(`C ${transformed.map(pointText).join(' ')}`);
      } else {
        output.push(`${upper} ${transformed.map(pointText).join(' ')}`);
      }
      currentX = end[0];
      currentY = end[1];
      if (upper === 'M') {
        if (firstMove) {
          startX = currentX;
          startY = currentY;
          firstMove = false;
        }
        command = relative ? 'l' : 'L';
      }
    }
  }
  return output.join(' ');
}

// ---------- DSL 补充来源：extractSvg 去重导致条目缺失时的合成几何 ----------
function multiplyMatrix(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

// 节点自带的 rotate / flipH / flipV（绕节点盒子中心），不含 relativeX/Y 平移：
// 合成结果只用于确定图形朝向，平移由消费端按 IconWidth/IconHeight 适配。
function nodeOrientationMatrix(node) {
  const ls = (node && node.layoutStyle) || {};
  const width = Number(ls.width) || 0;
  const height = Number(ls.height) || 0;
  const cx = width / 2;
  const cy = height / 2;
  const angle = (Number(ls.rotate) || 0) * Math.PI / 180;
  const flipH = ls.flipH === true ? -1 : 1;
  const flipV = ls.flipV === true ? -1 : 1;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // T(c) · R(θ) · F · T(-c)，即 p -> c + R·F·(p - c)
  return [
    cos * flipH,
    sin * flipH,
    -sin * flipV,
    cos * flipV,
    cx - (cos * flipH * cx + -sin * flipV * cy),
    cy - (sin * flipH * cx + cos * flipV * cy),
  ];
}

function buildDslIndex(snapshot) {
  const root = snapshot && snapshot.dsl && Array.isArray(snapshot.dsl.nodes) ? snapshot.dsl.nodes[0] : null;
  if (!root) throw new Error('DSL snapshot has no dsl.nodes[0]');
  const nodeById = new Map();
  const parentById = new Map();
  (function walk(node, parent) {
    if (!node || typeof node.id !== 'string') return;
    nodeById.set(node.id, node);
    parentById.set(node.id, parent ? parent.id : null);
    for (const child of node.children || []) walk(child, node);
  })(root, null);
  return { nodeById, parentById };
}

// 祖先 rotate/flip 合成矩阵（由外到内）。
function isIdentityMatrix(matrix) {
  return matrix[0] === 1 && matrix[1] === 0 && matrix[2] === 0
    && matrix[3] === 1 && matrix[4] === 0 && matrix[5] === 0;
}

function ancestorOrientationMatrix(index, nodeId) {
  const chain = [];
  let current = index.parentById.get(nodeId) || null;
  while (current) {
    chain.push(current);
    current = index.parentById.get(current) || null;
  }
  chain.reverse();
  let matrix = [1, 0, 0, 1, 0, 0];
  for (const id of chain) {
    const node = index.nodeById.get(id);
    const next = nodeOrientationMatrix(node);
    if (isIdentityMatrix(next)) continue;
    matrix = multiplyMatrix(matrix, next);
  }
  return matrix;
}

// 收集节点自身（若本身是 PATH）或其子树里的全部 PATH，按树序返回。
// 多路径图标（例如「双侧箭头」由两条路径拼成）在 extractSvg 里是「一个条目、多条 d」，
// 这里用同样的口径：sourceRef 指向图标组，就把组内所有 PATH 收进同一条 Geometry。
function collectPathNodes(index, node) {
  const found = [];
  (function walk(current) {
    if (!current) return;
    if (current.type === 'PATH' && Array.isArray(current.path) && current.path.length > 0) {
      found.push(current);
    }
    for (const child of current.children || []) walk(child);
  })(node);
  return found;
}

// 从 DSL 合成路径数据。
//   - sourceRef 可以是 PATH 节点（单路径图标），也可以是图标组（多路径图标）；
//   - bakeAncestor=true 时把每个 PATH 的祖先 rotate/flip 一并烘焙（组自身的变换也在链上）。
// 不烘焙时输出与 extractSvg 的口径一致：只取各 PATH 自身的 d + transform。
function synthesizeFromDsl(index, icon, bakeAncestor) {
  const node = index.nodeById.get(icon.sourceRef) || index.nodeById.get(icon.sourceId);
  if (!node) throw new Error(`DSL node not found for icon ${icon.name}: ${icon.sourceRef || icon.sourceId}`);
  const pathNodes = collectPathNodes(index, node);
  if (pathNodes.length === 0) {
    throw new Error(
      `DSL node has no PATH with path data: ${icon.name} (${node.type} ${icon.sourceRef || icon.sourceId})`
    );
  }
  const paths = [];
  for (const pathNode of pathNodes) {
    const ancestor = bakeAncestor
      ? ancestorOrientationMatrix(index, pathNode.id)
      : [1, 0, 0, 1, 0, 0];
    for (const entry of pathNode.path) {
      const data = entry && typeof entry.data === 'string' ? entry.data.trim() : '';
      if (!data) continue;
      const matrix = entry.transform
        ? parseMatrix(entry.transform.replace(/^matrix\(([^)]*)\)$/i, '$1'), icon.name)
        : [1, 0, 0, 1, 0, 0];
      const composed = multiplyMatrix(ancestor, matrix);
      paths.push({
        d: data,
        fillRule: 'Nonzero',
        matrix: composed.map(value => formatNumber(value)).join(','),
      });
    }
  }
  if (paths.length === 0) throw new Error(`DSL PATH has no usable path data: ${icon.name}`);
  return paths;
}

// ---------- 填充规则决策：重复子路径去重 + 是否需要 F0/F1 标记 ----------
// 框架解析器不使用 F0/F1 标记，因此默认不输出；只有当该图标在 EvenOdd 与
// Nonzero 下渲染结果不同时，才补回 F1，保证外观与设计稿一致。
// MasterGo 导出会把同一子路径重复输出（例如填充层+描边层合并），这种重复
// 会被安全去重：去重前后按"原始规则"栅格化必须逐像素一致，否则保持原样。
// 本模块不依赖 WPF，用自带栅格化比对两种填充规则。

const CURVE_STEPS = 24;
const SIGNATURE_SCALES = [160, 320];

function splitSubpaths(data) {
  const text = String(data);
  const chunks = [];
  let start = -1;
  for (const match of text.matchAll(/[Mm]/g)) {
    if (start >= 0) chunks.push(text.slice(start, match.index).trim());
    start = match.index;
  }
  if (start >= 0) chunks.push(text.slice(start).trim());
  return chunks.filter(Boolean);
}

function flattenSubpath(chunk) {
  const tokens = String(chunk).match(/[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  const points = [];
  let index = 0;
  let command = null;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  const next = () => Number(tokens[index++]);
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) {
      command = tokens[index];
      index += 1;
    } else if (!command) {
      throw new Error('path data starts without a command');
    } else if (command === 'M') {
      command = 'L';
    } else if (command === 'm') {
      command = 'l';
    }
    const upper = command.toUpperCase();
    const relative = command !== upper;
    if (upper === 'Z') {
      points.push([startX, startY]);
      cx = startX;
      cy = startY;
      continue;
    }
    if (upper === 'M' || upper === 'L') {
      const x = next();
      const y = next();
      cx = relative ? cx + x : x;
      cy = relative ? cy + y : y;
      points.push([cx, cy]);
      if (upper === 'M') {
        startX = cx;
        startY = cy;
      }
      continue;
    }
    if (upper === 'H' || upper === 'V') {
      const value = next();
      if (upper === 'H') cx = relative ? cx + value : value;
      else cy = relative ? cy + value : value;
      points.push([cx, cy]);
      continue;
    }
    if (upper === 'C') {
      const x1 = next();
      const y1 = next();
      const x2 = next();
      const y2 = next();
      const x = next();
      const y = next();
      const p1 = [relative ? cx + x1 : x1, relative ? cy + y1 : y1];
      const p2 = [relative ? cx + x2 : x2, relative ? cy + y2 : y2];
      const p3 = [relative ? cx + x : x, relative ? cy + y : y];
      for (let k = 1; k <= CURVE_STEPS; k += 1) {
        const t = k / CURVE_STEPS;
        const mt = 1 - t;
        points.push([
          mt * mt * mt * cx + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
          mt * mt * mt * cy + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
        ]);
      }
      cx = p3[0];
      cy = p3[1];
      continue;
    }
    if (upper === 'Q') {
      const x1 = next();
      const y1 = next();
      const x = next();
      const y = next();
      const p1 = [relative ? cx + x1 : x1, relative ? cy + y1 : y1];
      const p2 = [relative ? cx + x : x, relative ? cy + y : y];
      for (let k = 1; k <= CURVE_STEPS; k += 1) {
        const t = k / CURVE_STEPS;
        const mt = 1 - t;
        points.push([
          mt * mt * cx + 2 * mt * t * p1[0] + t * t * p2[0],
          mt * mt * cy + 2 * mt * t * p1[1] + t * t * p2[1],
        ]);
      }
      cx = p2[0];
      cy = p2[1];
      continue;
    }
    throw new Error('unsupported path command ' + command);
  }
  return points;
}

function rasterizeFill(polys, rule, cells) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polys) {
    for (const point of poly) {
      if (point[0] < minX) minX = point[0];
      if (point[0] > maxX) maxX = point[0];
      if (point[1] < minY) minY = point[1];
      if (point[1] > maxY) maxY = point[1];
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return '';
  const width = Math.max(maxX - minX, 1e-9);
  const height = Math.max(maxY - minY, 1e-9);
  const scale = cells / Math.max(width, height);
  const W = Math.max(1, Math.ceil(width * scale));
  const H = Math.max(1, Math.ceil(height * scale));
  const edges = [];
  for (const poly of polys) {
    const scaled = poly.map(point => [(point[0] - minX) * scale, (point[1] - minY) * scale]);
    if (scaled.length > 1) {
      const first = scaled[0];
      const last = scaled[scaled.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) scaled.push(first);
    }
    for (let i = 0; i + 1 < scaled.length; i += 1) {
      const a = scaled[i];
      const b = scaled[i + 1];
      if (a[1] !== b[1]) edges.push([a[0], a[1], b[0], b[1]]);
    }
  }
  const rows = [];
  for (let py = 0; py < H; py += 1) {
    const row = new Array(W).fill('0');
    const y = py + 0.5;
    const crossings = [];
    for (const edge of edges) {
      const [x0, y0, x1, y1] = edge;
      if ((y0 <= y) !== (y1 <= y)) {
        crossings.push([x0 + ((y - y0) * (x1 - x0)) / (y1 - y0), y1 > y0 ? 1 : -1]);
      }
    }
    if (crossings.length) {
      crossings.sort((a, b) => a[0] - b[0]);
      let winding = 0;
      let crossing = 0;
      let prev = crossings[0][0];
      for (const [x, direction] of crossings) {
        const inside = rule === 'Nonzero' ? winding !== 0 : crossing % 2 === 1;
        if (inside) {
          const from = Math.max(0, Math.round(prev));
          const to = Math.min(W, Math.round(x));
          for (let column = from; column < to; column += 1) row[column] = '1';
        }
        crossing += 1;
        winding += direction;
        prev = x;
      }
    }
    rows.push(row.join(''));
  }
  return rows.join('|');
}

function geometrySignature(chunks, rule) {
  const polys = chunks.map(flattenSubpath);
  return SIGNATURE_SCALES.map(cells => rasterizeFill(polys, rule, cells)).join('#');
}

// 返回最终写入 Geometry 的子路径块、是否需要保留 F1 标记与处理说明。
function planGeometry(rawData, sourceRule) {
  const chunks = rawData.reduce((all, data) => all.concat(splitSubpaths(data)), []);
  if (chunks.length === 0) return { chunks, keepFillRule: false, deduped: 0, note: '没有解析出子路径' };
  if (sourceRule === 'Mixed') {
    return { chunks, keepFillRule: true, deduped: 0, note: '同一图标混用 fill-rule，保留 F1' };
  }
  const rule = sourceRule === 'EvenOdd' ? 'EvenOdd' : 'Nonzero';
  const unique = [...new Set(chunks)];
  let originalSignature;
  let dedupSignature;
  try {
    originalSignature = geometrySignature(chunks, rule);
    dedupSignature = unique.length === chunks.length ? originalSignature : geometrySignature(unique, rule);
  } catch (error) {
    return {
      chunks,
      keepFillRule: sourceRule !== 'EvenOdd',
      deduped: 0,
      note: '路径指令暂不支持比对（' + error.message + '），按原规则保守处理',
    };
  }
  const deduped = dedupSignature === originalSignature ? unique : chunks;
  const removed = chunks.length - deduped.length;
  // 原始规则是 EvenOdd 时，WPF 默认就是 EvenOdd，永远不需要标记；
  // 只有当原始规则是 Nonzero 且两种规则渲染确实不同时才补回 F1。
  if (sourceRule === 'EvenOdd') {
    return {
      chunks: deduped,
      keepFillRule: false,
      deduped: removed,
      note: removed > 0 ? '重复子路径已去重，原始规则即默认规则，省略标记' : '原始规则即默认规则(EvenOdd)，省略标记',
    };
  }
  let evenSignature;
  let nonZeroSignature;
  try {
    evenSignature = geometrySignature(deduped, 'EvenOdd');
    nonZeroSignature = geometrySignature(deduped, 'Nonzero');
  } catch (error) {
    return { chunks: deduped, keepFillRule: true, deduped: chunks.length - deduped.length, note: '比对失败，保留 F1' };
  }
  const keepFillRule = evenSignature !== nonZeroSignature;
  return {
    chunks: deduped,
    keepFillRule,
    deduped: removed,
    note: keepFillRule
      ? 'EvenOdd 与 Nonzero 渲染不同，保留 F1'
      : (removed > 0 ? '重复子路径已去重，两种规则一致，省略标记' : '两种规则渲染一致，省略标记'),
  };
}

const svgData = readJson(svgFile, 'extractSvg JSON');
const iconMap = readJson(mapFile, 'page icon map');
if (!Array.isArray(svgData.svgs)) throw new Error('extractSvg JSON must contain svgs[]');
if (!Array.isArray(iconMap.icons)) throw new Error('page icon map must contain icons[]');
const dslIndex = dslFile ? buildDslIndex(readJson(dslFile, 'DSL snapshot JSON')) : null;
if (fs.existsSync(outFile)) {
  throw new Error(`页面 Icon 文件已存在，禁止覆盖: ${outFile}；请为新页面使用独立的 {name}Icons.xaml 文件`);
}

const svgById = new Map();
for (const item of svgData.svgs) {
  if (!item || typeof item.id !== 'string' || typeof item.svg !== 'string') continue;
  if (svgById.has(item.id)) throw new Error(`Duplicate extractSvg entry id: ${item.id}`);
  svgById.set(item.id, item.svg);
}

const keys = new Set();
function resolveKey(name) {
  if (/^MGIcon_/i.test(name)) {
    throw new Error(`Icon name must not use the layer-id prefix MGIcon_: ${name}`);
  }
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
    throw new Error(`Icon name must be an English identifier: ${name}`);
  }
  let key = name;
  let suffix = 2;
  while (keys.has(key)) key = `${name}${suffix++}`;
  keys.add(key);
  return key;
}
const output = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"',
  '                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"',
  '                    xmlns:o="http://schemas.microsoft.com/winfx/2006/xaml/presentation/options">'
];

const geometryReport = [];
for (const icon of iconMap.icons) {
  if (!icon || typeof icon.sourceId !== 'string' || typeof icon.name !== 'string' || typeof icon.comment !== 'string' || typeof icon.sourceRef !== 'string' || !icon.sourceId || !icon.name || !icon.comment || !icon.sourceRef) {
    throw new Error('Every icon requires non-empty sourceId, name, comment, and sourceRef');
  }
  const key = resolveKey(icon.name);
  const svg = svgById.get(icon.sourceId);
  // 机械兜底：只靠祖先 rotate / flipH / flipV 区分方向的图标（典型是「方向按钮组」），
  // extractSvg 与「DSL 但不烘焙」都表达不了方向——两者都会输出未带祖先变换的原图。
  // 台账没声明 bakeAncestorTransform 时由脚本自己判定并烘焙，避免漏写字段就静默出方向错的几何。
  const requestedBake = Boolean(icon.bakeAncestorTransform);
  let autoBaked = false;
  if (!requestedBake && dslIndex) {
    const iconNode = dslIndex.nodeById.get(icon.sourceRef) || dslIndex.nodeById.get(icon.sourceId);
    if (iconNode) {
      autoBaked = collectPathNodes(dslIndex, iconNode)
        .some(pathNode => !isIdentityMatrix(ancestorOrientationMatrix(dslIndex, pathNode.id)));
    }
  }
  const bake = requestedBake || autoBaked;
  const useDsl = Boolean(icon.fromDsl) || bake || !svg;
  let paths;
  let geometrySource;
  if (useDsl) {
    if (!dslIndex) {
      throw new Error(`Icon ${icon.name} needs the DSL snapshot (extractSvg 缺该条目): ${icon.sourceId}`);
    }
    paths = synthesizeFromDsl(dslIndex, icon, bake);
    geometrySource = bake ? 'dsl+ancestor-transform' : 'dsl';
  } else {
    paths = parsePaths(svg, icon.sourceId);
    if (paths.some(path => path.transform && !path.matrix)) {
      throw new Error(`Unsupported SVG transform (only matrix is supported): ${icon.sourceId}`);
    }
    geometrySource = 'extractSvg';
  }
  let pathData = paths.map(path => path.matrix
    ? transformPathData(path.d, path.matrix, icon.sourceId)
    : path.d.trim());
  // DSL 合成（含烘焙）的几何可能带偏移或负坐标，平移到原点后再发射，
  // 避免消费端在 Stretch=None 时把图形裁掉。
  if (geometrySource.indexOf('dsl') === 0) {
    let minX = Infinity;
    let minY = Infinity;
    for (const chunk of pathData.flatMap(splitSubpaths)) {
      for (const point of flattenSubpath(chunk)) {
        if (point[0] < minX) minX = point[0];
        if (point[1] < minY) minY = point[1];
      }
    }
    if (Number.isFinite(minX) && Number.isFinite(minY) && (minX !== 0 || minY !== 0)) {
      const translate = [1, 0, 0, 1, formatNumber(-minX), formatNumber(-minY)].join(',');
      pathData = pathData.map(data => transformPathData(data, translate, icon.sourceId));
    }
  }
  const sourceRule = paths.some(path => path.fillRule === 'EvenOdd') && paths.some(path => path.fillRule === 'Nonzero')
    ? 'Mixed'
    : paths[0].fillRule;
  const plan = planGeometry(pathData, sourceRule);
  geometryReport.push({
    key,
    geometrySource,
    autoBaked,
    sourceRule,
    keepFillRule: plan.keepFillRule,
    deduped: plan.deduped,
    note: plan.note,
  });
  output.push(`  <!-- ${escapeXml(icon.comment)} -->`);
  output.push(`  <Geometry o:Freeze="True" x:Key="${escapeXml(key)}">`);
  if (plan.keepFillRule) output.push('    F1');
  for (const chunk of plan.chunks) {
    for (const line of chunk.split(/\r?\n/)) output.push(`    ${line.trim()}`);
  }
  output.push('  </Geometry>', '');
}

output.push('</ResourceDictionary>', '');
fs.mkdirSync(require('path').dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, output.join('\n'), 'utf8');
console.log(`Generated ${keys.size} icon(s): ${outFile}`);
const dedupedIcons = geometryReport.filter(item => item.deduped > 0);
if (dedupedIcons.length > 0) {
  console.log(`  去重重复子路径: ${dedupedIcons.map(item => `${item.key}(-${item.deduped})`).join(', ')}`);
}
const fillRuleIcons = geometryReport.filter(item => item.keepFillRule);
if (fillRuleIcons.length > 0) {
  console.log(`  保留 F1（渲染依赖 Nonzero）: ${fillRuleIcons.map(item => item.key).join(', ')}`);
} else {
  console.log('  全部图标已无需填充规则标记');
}
const autoBakedIcons = geometryReport.filter(item => item.autoBaked);
if (autoBakedIcons.length > 0) {
  console.log(`  自动烘焙祖先朝向（台账未声明 bakeAncestorTransform）: ${autoBakedIcons.map(item => item.key).join(', ')}`);
}
