const INTEPLM_ORIGIN = "http://192.168.0.218:7002";

const resolveInteplmPage = (pages, index = null) => {
  if (index !== null) {
    if (!Number.isSafeInteger(index) || index < 0 || !pages[index]) {
      throw new Error("--page 必须是 pages 输出中的有效非负索引");
    }
    if (new URL(pages[index].url()).origin !== INTEPLM_ORIGIN) {
      throw new Error(`--page=${index} 不是 IntePLM 页面`);
    }
    return pages[index];
  }

  const matches = pages.filter((page) => {
    try {
      return new URL(page.url()).origin === INTEPLM_ORIGIN;
    } catch {
      return false;
    }
  });
  if (matches.length !== 1) {
    throw new Error("需要唯一的 IntePLM 标签页；先运行 pages，并在有多个匹配页时使用 --page=<索引>");
  }
  return matches[0];
};

module.exports = { resolveInteplmPage };
