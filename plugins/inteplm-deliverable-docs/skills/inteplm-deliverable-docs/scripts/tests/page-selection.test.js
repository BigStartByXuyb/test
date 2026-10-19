const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveInteplmPage } = require("../page-selection.cjs");

const page = (url) => ({ url: () => url });

test("selects the only IntePLM tab when no index is supplied", () => {
  const inteplm = page("http://192.168.0.218:7002/project/1");
  assert.equal(resolveInteplmPage([page("about:blank"), inteplm]), inteplm);
});

test("requires an index when multiple IntePLM tabs are open", () => {
  assert.throws(
    () => resolveInteplmPage([page("http://192.168.0.218:7002/one"), page("http://192.168.0.218:7002/two")]),
    /使用 --page=<索引>/,
  );
});

test("rejects a missing IntePLM tab", () => {
  assert.throws(() => resolveInteplmPage([page("about:blank")]), /需要唯一的 IntePLM 标签页/);
});

test("selects the requested IntePLM tab by index", () => {
  const inteplm = page("http://192.168.0.218:7002/project/2");
  assert.equal(resolveInteplmPage([page("about:blank"), inteplm], 1), inteplm);
});

test("rejects an index that points to another site", () => {
  assert.throws(
    () => resolveInteplmPage([page("https://example.com")], 0),
    /不是 IntePLM 页面/,
  );
});

test("rejects invalid indices", () => {
  for (const index of [-1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => resolveInteplmPage([page("http://192.168.0.218:7002/")], index), /有效非负索引/);
  }
});
