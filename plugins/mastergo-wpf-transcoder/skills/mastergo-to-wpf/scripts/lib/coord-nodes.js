#!/usr/bin/env node
"use strict";

// 「坐标核对输入」（官方核对器 check-iocontrol-coords.js 的 nodes.json 内容）的**唯一实现**：
// 从 mapping 机械生成每个输出节点的页面绝对 bbox + 输出父容器原点。Bundle 第 10 步与
// check-coords.mjs（第 12 步）都调用本模块，禁止再各写一份。
//
// 口径（与生成器、provenance 校验一致）：
//   - 原点 = 该节点「输出父容器」的内容区原点（父容器优先级 layoutParent → parent → DSL parentRef），
//     根级用 (0, 192)（顶层公共栏 126 + 示例标题 66 只在根级扣一次），嵌套用父容器 pageAbs + contentInset；
//   - 表格列定义（nodeKind=table-column）按 columnTemplate 固定几何发射：x/y 取父容器原点本身、w = "NaN"；
//   - TextBlock 的 Width 固定 "NaN"；
//   - TextBlock 且 Align=Right：Left 不是 x − 原点，另外给出 expectedLeft（官方核对器优先采用）。

const path = require("path");
const { outputOrigin, parentOuterRightEdge, textBlockLeftValue, isRightAlignedTextBlock } =
  require(path.join(__dirname, "script-helpers.js"));

function buildCoordNodes(mapping, options) {
  const opts = options || {};
  const nodes = Array.isArray(mapping && mapping.nodes) ? mapping.nodes : [];
  const sourceByRef = new Map(((mapping && mapping.sourceNodes) || []).map((node) => [node.ref, node]));
  const nodeByRef = new Map(nodes.map((node) => [node.ref, node]));
  const rootRef = (mapping && mapping.rootRef) || null;
  const rootSource = rootRef ? (sourceByRef.get(rootRef) || null) : null;
  const alignSpec = opts.textBlockAlign || {};
  const fail = typeof opts.fail === "function" ? opts.fail : (message) => { throw new Error(message); };

  const number = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  return nodes.map((node) => {
    const source = sourceByRef.get(node.sourceRef || node.ref) || {};
    const outputParentRef = node.layoutParent !== undefined
      ? node.layoutParent
      : (node.parent !== undefined ? node.parent : (source.parentRef || null));
    const parentSource = outputParentRef ? (sourceByRef.get(outputParentRef) || null) : null;
    const parentIsRoot = !parentSource || (rootRef !== null && parentSource.ref === rootRef);
    const parentNode = outputParentRef ? nodeByRef.get(outputParentRef) : null;
    const parentInset = !parentIsRoot && parentNode && parentNode.contentInset ? parentNode.contentInset : null;
    // 原点口径的唯一实现在 lib/script-helpers.js（outputOrigin）：0 是合法坐标，取不到父容器 pageAbs
    // 时按「不猜原点」直接失败，不做 falsy 兜底。
    const origin = outputOrigin({
      parentIsRoot: parentIsRoot,
      parentPageAbsX: parentSource ? parentSource.pageAbsX : null,
      parentPageAbsY: parentSource ? parentSource.pageAbsY : null,
      inset: parentInset
    });
    if (!origin) {
      fail("无法确定输出父容器原点：节点 " + (node.xmlId || node.id || node.ref) + " 的输出父容器 " +
        outputParentRef + " 缺少 pageAbsX/pageAbsY（不能猜原点）");
    }
    const originX = origin.x;
    const originY = origin.y;
    const isTextBlock = (node.controlType || (node.attrs && node.attrs.ControlType)) === "TextBlock";
    if (node.nodeKind === "table-column") {
      return {
        id: node.xmlId || node.id || node.ref,
        x: originX,
        y: originY,
        w: "NaN",
        h: node.expectedHeight,
        contentOriginX: originX,
        contentOriginY: originY
      };
    }
    // TextBlock Align=Right：Left 的口径是"以控件右上角为原点，量到父容器外框右边缘"，
    // 不是 x − 原点；这里按同一实现独立算出并显式交给官方核对器。
    let expectedLeft = null;
    if (isRightAlignedTextBlock(node, alignSpec)) {
      expectedLeft = textBlockLeftValue({
        align: "Right",
        pageAbsX: number(source.pageAbsX !== undefined ? source.pageAbsX : node.absX),
        textWidth: number(node.dslWidth !== undefined ? node.dslWidth : source.width),
        parentOuterRightEdgeX: parentOuterRightEdge({
          parentIsRoot: parentIsRoot,
          parentPageAbsX: parentSource ? parentSource.pageAbsX : null,
          parentWidth: parentSource ? parentSource.width : null,
          rootWidth: rootSource ? rootSource.width : null
        })
      });
      if (expectedLeft === null) {
        fail("无法计算 TextBlock Align=Right 的 Left：节点 " + (node.xmlId || node.ref) +
          " 缺少页面/父容器宽度或设计稿 bbox 宽度（不能猜）");
      }
    }
    return Object.assign({
      id: node.xmlId || node.id || node.ref,
      x: number(source.pageAbsX !== undefined ? source.pageAbsX : node.absX),
      y: number(source.pageAbsY !== undefined ? source.pageAbsY : node.absY),
      w: isTextBlock ? "NaN" : number(node.expectedWidth !== undefined ? node.expectedWidth : source.width),
      h: number(node.expectedHeight !== undefined ? node.expectedHeight : source.height),
      contentOriginX: originX,
      contentOriginY: originY
    }, expectedLeft !== null ? { expectedLeft: expectedLeft } : {});
  });
}

module.exports = { buildCoordNodes };
