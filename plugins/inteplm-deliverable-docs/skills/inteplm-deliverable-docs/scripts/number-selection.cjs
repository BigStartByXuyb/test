const resolveExactNumberOption = (options, expectedText) => {
  if (typeof expectedText !== "string" || !expectedText.trim()) {
    throw new Error("必须提供编号候选项的完整文本");
  }
  const matches = options.filter((option) => option === expectedText);
  if (matches.length !== 1) {
    throw new Error("编号候选项必须精确且唯一匹配；先运行 numberOptions 检查候选项");
  }
  return matches[0];
};

module.exports = { resolveExactNumberOption };
